import { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { resolveDisplayName } from '@/lib/display-name'
import { PRIMARY_CUSTOM_ASSET_CODE as ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER as ASSET_ISSUER, HORIZON_URL } from '@/lib/constants'

function formatAmount(value: number): string {
  if (value >= 1_000_000_000) {
    const b = value / 1_000_000_000
    return b % 1 === 0 ? `${b}B` : `${parseFloat(b.toFixed(1))}B`
  }
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(1))}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return k % 1 === 0 ? `${k}k` : `${parseFloat(k.toFixed(1))}k`
  }
  return String(Math.round(value))
}

// Fetch asset stats from Stellar Horizon (issuer account + asset endpoint)
async function fetchStellarTokenStats() {
  const defaults = {
    totalSupply: '0',
    circulatingSupply: '0',
    holderCount: 0,
    issuerXlmBalance: '0',
  }

  try {
    // Fetch issuer account (gives us total issued - what remains in issuer = circulating)
    const [issuerRes, assetRes] = await Promise.all([
      ASSET_ISSUER
        ? fetch(`${HORIZON_URL}/accounts/${ASSET_ISSUER}`, { next: { revalidate: 60 } })
        : Promise.resolve(null),
      ASSET_ISSUER
        ? fetch(
            `${HORIZON_URL}/assets?asset_code=${ASSET_CODE}&asset_issuer=${ASSET_ISSUER}&limit=1`,
            { next: { revalidate: 60 } }
          )
        : Promise.resolve(null),
    ])

    let totalSupply = 0
    let issuerBalance = 0
    let issuerXlmBalance = '0'
    let holderCount = 0

    // Parse issuer account
    if (issuerRes?.ok) {
      const issuerData = await issuerRes.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const balances = issuerData.balances as any[]
      const native = balances.find((b: { asset_type: string }) => b.asset_type === 'native')
      issuerXlmBalance = native ? parseFloat(native.balance).toFixed(2) : '0'

      // Issuer's own holdings of the token
      const ownToken = balances.find(
        (b: { asset_code?: string }) => b.asset_code === ASSET_CODE
      )
      issuerBalance = ownToken ? parseFloat(ownToken.balance) : 0
    }

    // Parse asset endpoint (gives num_accounts = holders, and amount = total issued)
    if (assetRes?.ok) {
      const assetData = await assetRes.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const record = assetData._embedded?.records?.[0] as any
      if (record) {
        totalSupply = parseFloat(record.balances?.authorized ?? record.amount ?? '0')
        holderCount = parseInt(record.accounts?.authorized ?? record.num_accounts ?? '0', 10)
      }
    }

    const circulatingSupply = totalSupply - issuerBalance

    return {
      totalSupply: formatAmount(totalSupply),
      totalSupplyRaw: totalSupply,
      circulatingSupply: formatAmount(circulatingSupply > 0 ? circulatingSupply : totalSupply),
      circulatingSupplyRaw: circulatingSupply > 0 ? circulatingSupply : totalSupply,
      holderCount,
      issuerXlmBalance,
    }
  } catch {
    return defaults
  }
}

export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const supabase = createServiceClient()

    // Run all queries in parallel
    const [aggregateResult, supporterResult, userCountResult, tokenStats, teamResult] = await Promise.all([
      // 1. Aggregate from wallet_balances
      supabase
        .from('wallet_balances')
        .select('nsafl_balance, xlm_balance, balance_week_ago, updated_at'),

      // 2. Top supporters
      supabase
        .from('wallet_balances')
        .select('nsafl_balance, wallets(stellar_address, users(telegram_username, telegram_first_name, display_preference))')
        .order('nsafl_balance', { ascending: false })
        .limit(10),

      // 3. Total registered users
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true }),

      // 4. Stellar token stats
      fetchStellarTokenStats(),

      // 5. Team distribution
      supabase
        .from('users')
        .select('favorite_team')
        .not('favorite_team', 'is', null),
    ])

    // --- Process aggregate data ---
    type BalanceRow = { nsafl_balance: number; xlm_balance: number; balance_week_ago: number; updated_at: string }
    const rows = ((aggregateResult.data ?? []) as BalanceRow[])

    const totalCurrent = rows.reduce((sum, r) => sum + (Number(r.nsafl_balance) || 0), 0)
    const totalWeekAgo = rows.reduce((sum, r) => sum + (Number(r.balance_week_ago) || 0), 0)
    const totalXlm = rows.reduce((sum, r) => sum + (Number(r.xlm_balance) || 0), 0)
    const walletCount = rows.length
    const activeWallets = rows.filter((r) => Number(r.nsafl_balance) > 0).length

    // Weekly change
    let weeklyChange: string
    if (totalWeekAgo <= 0) {
      weeklyChange = totalCurrent > 0 ? '+New' : '0%'
    } else {
      const pct = ((totalCurrent - totalWeekAgo) / totalWeekAgo) * 100
      const sign = pct >= 0 ? '+' : ''
      weeklyChange = `${sign}${pct.toFixed(1)}%`
    }

    // Chart data — 5-bar growth curve
    let chartData: number[]
    if (totalCurrent <= 0) {
      chartData = [30, 45, 60, 75, 100]
    } else {
      const base = totalCurrent * 0.2
      const steps = [base, base * 1.6, base * 2.4, base * 3.2, totalCurrent]
      const max = steps[steps.length - 1]
      chartData = steps.map((v) => Math.round((v / max) * 100))
    }

    // Tier distribution from balances
    const tierBuckets = { preTier: 0, tier1_4: 0, tier5_8: 0, tier9_12: 0 }
    for (const r of rows) {
      const bal = Number(r.nsafl_balance) || 0
      if (bal < 100) tierBuckets.preTier++
      else if (bal <= 5000) tierBuckets.tier1_4++
      else if (bal <= 100000) tierBuckets.tier5_8++
      else tierBuckets.tier9_12++
    }

    // Regional — hardcoded until we have geo data
    const regional = [
      { name: 'Swan Districts', pct: 45, color: 'bg-blue-500' },
      { name: 'South Fremantle', pct: 30, color: 'bg-red-500' },
      { name: 'Other Regions', pct: 25, color: 'bg-gray-500' },
    ]

    // --- Process top supporters ---
    type SupporterRow = {
      nsafl_balance: number
      wallets: {
        stellar_address: string
        users: {
          telegram_username: string | null
          telegram_first_name: string | null
          display_preference: string | null
        } | null
      } | null
    }
    const supporterRows = (supporterResult.data ?? []) as SupporterRow[]
    const topSupporters = supporterRows
      .filter((r) => Number(r.nsafl_balance) > 0)
      .map((r, i) => {
        const wallet = r.wallets
        const user = wallet?.users ?? null
        const stellarAddress = wallet?.stellar_address ?? ''
        const name = resolveDisplayName({
          displayPreference: user?.display_preference ?? 'address',
          stellarAddress,
          telegramUsername: user?.telegram_username ?? null,
          telegramFirstName: user?.telegram_first_name ?? null,
        })
        const hub = stellarAddress.length >= 6
          ? `...${stellarAddress.slice(-6)}`
          : 'Unknown'
        return {
          rank: i + 1,
          name,
          hub,
          amount: formatAmount(Number(r.nsafl_balance)),
        }
      })

    const totalUsers = userCountResult.count ?? 0

    // Team distribution — count users per team
    type TeamRow = { favorite_team: string }
    const teamRows = (teamResult.data ?? []) as TeamRow[]
    const teamCounts: Record<string, number> = {}
    for (const r of teamRows) {
      teamCounts[r.favorite_team] = (teamCounts[r.favorite_team] || 0) + 1
    }

    return ok({
      // Existing
      totalFunding: formatAmount(totalCurrent),
      totalFundingRaw: totalCurrent,
      weeklyChange,
      chartData,
      target: '3M',
      regional,
      topSupporters: topSupporters.length > 0 ? topSupporters : [
        { rank: 1, name: 'Be the first!', hub: 'Connect wallet', amount: '0' },
      ],

      // New — community stats
      walletCount,
      activeWallets,
      totalUsers,
      totalXlm: formatAmount(totalXlm),

      // New — token stats from Stellar
      tokenStats: {
        totalSupply: tokenStats.totalSupply,
        circulatingSupply: tokenStats.circulatingSupply,
        holderCount: tokenStats.holderCount,
        issuerXlmReserve: tokenStats.issuerXlmBalance,
      },

      // New — holder distribution
      tierDistribution: tierBuckets,

      // Team distribution
      teamDistribution: teamCounts,
    })
  } catch {
    return ok({
      totalFunding: '0',
      totalFundingRaw: 0,
      weeklyChange: '0%',
      chartData: [30, 45, 60, 75, 100],
      target: '3M',
      regional: [],
      topSupporters: [],
      walletCount: 0,
      activeWallets: 0,
      totalUsers: 0,
      totalXlm: '0',
      tokenStats: { totalSupply: '0', circulatingSupply: '0', holderCount: 0, issuerXlmReserve: '0' },
      tierDistribution: { preTier: 0, tier1_4: 0, tier5_8: 0, tier9_12: 0 },
      teamDistribution: {},
    })
  }
}
