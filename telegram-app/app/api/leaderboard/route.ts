import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'
import { getTierForBalance } from '@/config/tiers'
import { resolveDisplayName } from '@/lib/display-name'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export interface LeaderboardEntry {
  rank: number
  displayName: string   // resolved per user's display_preference (address by default)
  stellarAddress: string
  balance: number
  favoriteTeam: string | null
  tierId: string
  inApp: boolean        // true = has connected to the Homecoming Hub
}

// Fetch all Stellar accounts holding the NSAFL token, sorted by balance desc.
// Horizon paginates at 200 — we fetch up to 3 pages (600 holders max).
async function fetchHorizonHolders(): Promise<{ address: string; balance: number }[]> {
  const assetCode    = process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'
  const assetIssuer  = process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''
  const horizonUrl   = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'
  const excludeAddrs = new Set(
    [
      process.env.NEXT_PUBLIC_DISTRIBUTION_ADDRESS,
      assetIssuer,  // always exclude the issuer itself
    ].filter(Boolean).map((a) => a!.toLowerCase())
  )
  if (!assetIssuer) return []
  const assetParam = `${assetCode}:${assetIssuer}`
  const holders: { address: string; balance: number }[] = []
  let url: string | null =
    `${horizonUrl}/accounts?asset=${encodeURIComponent(assetParam)}&limit=200&order=desc`

  for (let page = 0; page < 3 && url; page++) {
    const res: Response = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records: any[] = data._embedded?.records ?? []
    for (const account of records) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenBalance = (account.balances as any[]).find(
        (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer
      )
      if (tokenBalance) {
        const bal = parseFloat(tokenBalance.balance)
        if (bal > 0 && !excludeAddrs.has(account.account_id.toLowerCase()))
          holders.push({ address: account.account_id, balance: bal })
      }
    }
    // Follow next page link
    url = data._links?.next?.href ?? null
  }

  // Sort descending by balance
  holders.sort((a, b) => b.balance - a.balance)
  return holders
}

export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req, 60)
  if (rateLimitError) return rateLimitError

  const initData = req.headers.get('x-telegram-init-data') ?? ''

  if (!isDev) {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
  }

  try {
    const supabase = createServiceClient()

    // Fetch Stellar holders + app users in parallel
    const [horizonHolders, walletsResult] = await Promise.all([
      fetchHorizonHolders(),
      supabase
        .from('wallets')
        .select('stellar_address, users(telegram_username, telegram_first_name, favorite_team, display_preference)'),
    ])

    if (walletsResult.error) {
      return fail('Failed to load app users', 'DB_ERROR', 500)
    }

    // Build a lookup map: stellar_address (lowercase) → app user info
    type WalletRow = {
      stellar_address: string
      users: {
        telegram_username: string | null
        telegram_first_name: string | null
        favorite_team: string | null
        display_preference: string | null
      } | null
    }
    const appWallets = new Map<string, WalletRow['users']>()
    for (const w of (walletsResult.data ?? []) as WalletRow[]) {
      appWallets.set(w.stellar_address.toLowerCase(), w.users)
    }

    // Build leaderboard: all on-chain holders, enriched with app data
    const entries: LeaderboardEntry[] = horizonHolders.slice(0, 100).map((h, i) => {
      const appUser = appWallets.get(h.address.toLowerCase()) ?? null
      const tier = getTierForBalance(h.balance)
      const displayName = resolveDisplayName({
        displayPreference: appUser?.display_preference ?? 'address',
        stellarAddress: h.address,
        telegramUsername: appUser?.telegram_username ?? null,
        telegramFirstName: appUser?.telegram_first_name ?? null,
      })
      return {
        rank: i + 1,
        displayName,
        stellarAddress: h.address,
        balance: h.balance,
        favoriteTeam: appUser?.favorite_team ?? null,
        tierId: tier.id,
        inApp: appWallets.has(h.address.toLowerCase()),
      }
    })

    return ok({ entries, total: horizonHolders.length })
  } catch {
    return fail('Unexpected error', 'INTERNAL_ERROR', 500)
  }
}
