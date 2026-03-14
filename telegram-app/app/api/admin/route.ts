import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'

export function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') ?? req.nextUrl.searchParams.get('token')
  return !!token && token === process.env.ADMIN_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()

  const [
    { data: users },
    { data: teamRequests },
    { data: gameSessions },
    { data: donations },
    { data: purchases },
    { data: accessAttempts },
    { data: referredUsers },
    { data: trustlineSubmissions },
    { data: allBalances },
  ] = await Promise.all([
    // Users + wallets + balances in one shot
    (supabase as any)
      .from('users')
      .select(`
        telegram_id, telegram_username, telegram_first_name, telegram_photo_url, telegram_phone,
        favorite_team, display_preference, opt_in_telegram_notifications, is_blocked,
        referred_by, bonus_balls, bonus_spins, created_at, updated_at,
        wallets (
          id, stellar_address, label, is_primary, created_at, last_connected_at,
          wallet_balances ( nsafl_balance, xlm_balance, balance_week_ago, last_synced_at )
        )
      `)
      .order('created_at', { ascending: false }),

    // All team change requests
    supabase
      .from('team_change_requests')
      .select('id, telegram_id, requested_team, status, admin_note, created_at, resolved_at')
      .order('created_at', { ascending: false }),

    // Game sessions
    supabase
      .from('game_sessions')
      .select('id, telegram_id, wallet_id, kicks, balls_spawned, duration_seconds, created_at')
      .order('created_at', { ascending: false })
      .limit(200),

    // Donations
    supabase
      .from('donations')
      .select('id, wallet_id, amount, asset_code, donation_type, donation_target, stellar_tx_hash, verified, created_at')
      .order('created_at', { ascending: false }),

    // Purchases
    supabase
      .from('purchases')
      .select('id, wallet_id, xlm_amount, token_amount, stellar_tx_hash, purchase_type, verified, created_at')
      .order('created_at', { ascending: false }),

    // Access attempts (last 100)
    supabase
      .from('access_attempts')
      .select('id, ip, user_agent, tg_sdk_present, tg_sdk_fake, devtools_opened, screen, timezone, language, url, telegram_id, telegram_username, telegram_first_name, geo_location, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    // Users who were referred (have referred_by set) - for referral stats
    supabase
      .from('users')
      .select('telegram_id, telegram_first_name, telegram_username, referred_by, created_at')
      .not('referred_by', 'is', null)
      .order('created_at', { ascending: false }),

    // Trustline submissions (last 50)
    (supabase as any)
      .from('trustline_submissions')
      .select('id, ip, xdr, horizon_result, success, tx_hash, created_at')
      .order('created_at', { ascending: false })
      .limit(50),

    // Aggregate totals directly — avoids relying on nested JS aggregation
    supabase.from('wallet_balances').select('nsafl_balance, xlm_balance'),

  ])

  // Build referral stats from referred users list + users lookup
  const allUsers = users ?? []
  const referred = referredUsers ?? []

  // Group referred users by their referrer
  const referrerMap = new Map<number, { count: number; lastAt: string }>()
  for (const r of referred) {
    if (!r.referred_by) continue
    const existing = referrerMap.get(r.referred_by)
    if (existing) {
      existing.count++
      if ((r.created_at ?? '') > existing.lastAt) existing.lastAt = r.created_at ?? ''
    } else {
      referrerMap.set(r.referred_by, { count: 1, lastAt: r.created_at ?? '' })
    }
  }

  const referralStats = Array.from(referrerMap.entries()).map(([referrerId, stats]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const referrer = allUsers.find((u: any) => u.telegram_id === referrerId)
    return {
      referrer_id: referrerId,
      referrer_name: referrer?.telegram_first_name ?? null,
      referrer_username: referrer?.telegram_username ?? null,
      referral_count: stats.count,
      last_referral_at: stats.lastAt,
    }
  }).sort((a, b) => b.referral_count - a.referral_count)

  const totalNsafl = (allBalances ?? []).reduce((s, b) => s + Number(b.nsafl_balance ?? 0), 0)
  const totalXlm   = (allBalances ?? []).reduce((s, b) => s + Number(b.xlm_balance ?? 0), 0)

  return ok({
    users: allUsers,
    teamRequests: teamRequests ?? [],
    gameSessions: gameSessions ?? [],
    donations: donations ?? [],
    purchases: purchases ?? [],
    accessAttempts: accessAttempts ?? [],
    referralStats,
    referredUsers: referred,
    trustlineSubmissions: trustlineSubmissions ?? [],
    totalNsafl,
    totalXlm,
  })
}
