import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'
import { isValidStellarAddress, fetchAllShownBalances } from '@/lib/stellar'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const rateLimitError = checkRateLimit(req, 20) // stricter: 20/min for auth
  if (rateLimitError) return rateLimitError

  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramUser: TelegramUser
  if (isDev) {
    telegramUser = { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  } else {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramUser = parsed
  }

  const body = await req.json()
  const { stellarAddress, referredBy } = body as { stellarAddress: string; referredBy?: number | null }
  if (!stellarAddress || !isValidStellarAddress(stellarAddress))
    return fail('Invalid Stellar address', 'INVALID_ADDRESS')

  const supabase = createServiceClient()

  // 1. Upsert user (profile fields only — referred_by is set separately below)
  const { data: userData } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username ?? null,
        telegram_first_name: telegramUser.first_name,
        telegram_photo_url: telegramUser.photo_url ?? null,
      },
      { onConflict: 'telegram_id' }
    )
    .select('id, created_at, favorite_team, referred_by')
    .single()

  // 2. Save referral on first connect — only if valid, not self-referral, not already set
  if (
    userData &&
    typeof referredBy === 'number' &&
    !isNaN(referredBy) &&
    referredBy !== telegramUser.id &&
    userData.referred_by === null
  ) {
    // Verify the referrer actually exists before saving
    const { data: referrerExists } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('telegram_id', referredBy)
      .maybeSingle()

    if (referrerExists) {
      await supabase
        .from('users')
        .update({ referred_by: referredBy })
        .eq('telegram_id', telegramUser.id)
    }
  }

  if (!userData) return fail('Failed to upsert user', 'DB_ERROR', 500)

  // 3. Upsert wallet (one user can have many wallets, but not the same address twice)
  // last_connected_at is always updated so we know when each address was last used
  const { data: walletData } = await supabase
    .from('wallets')
    .upsert(
      { user_id: userData.id, stellar_address: stellarAddress, last_connected_at: new Date().toISOString() },
      { onConflict: 'user_id,stellar_address' }
    )
    .select('id')
    .single()

  // 4. Fetch live balances from Stellar and save to wallet_balances
  if (walletData) {
    try {
      const assets = await fetchAllShownBalances(stellarAddress)
      const tokenBal = parseFloat(assets[PRIMARY_CUSTOM_ASSET_CODE] ?? '0')
      const xlmBal = parseFloat(assets['XLM'] ?? '0')

      await supabase
        .from('wallet_balances')
        .upsert(
          {
            wallet_id: walletData.id,
            nsafl_balance: tokenBal,
            xlm_balance: xlmBal,
            balance_week_ago: tokenBal, // first sync — set week ago to current
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'wallet_id' }
        )
    } catch {
      // Balance sync failure shouldn't block wallet connection
    }
  }

  return ok({
    telegramId: telegramUser.id,
    telegramUsername: telegramUser.username ?? null,
    telegramFirstName: telegramUser.first_name,
    telegramPhotoUrl: telegramUser.photo_url ?? null,
    stellarAddress,
    memberSince: userData.created_at,
    favoriteTeam: userData.favorite_team ?? null,
  })
}
