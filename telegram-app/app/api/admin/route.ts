import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isPackEnabled } from '@/config/app'
import { getDonationsAdminData } from '@/packs/donations/admin/data'
import { getGamesAdminData } from '@/packs/games/admin/data'
import { getLeaderboardAdminData } from '@/packs/leaderboard/admin/data'
import { getSportsAdminData } from '@/packs/sports/admin/data'
import { getWalletAdminData } from '@/packs/stellar-wallet/admin/data'

export function verifyAdminToken(req: NextRequest): boolean {
  if (checkRateLimit(req, 30, `admin:${req.headers.get('x-forwarded-for') ?? 'local'}`)) return false
  const token = req.headers.get('x-admin-token') ?? ''   // header only — no query param
  const secret = process.env.ADMIN_SECRET_TOKEN ?? ''
  if (!token || !secret) return false
  const a = crypto.createHash('sha256').update(token).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)  // hash first: equal length, constant-time
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()

  const [{ data: users }, { data: accessAttempts }] = await Promise.all([
    // Core identity data only. Domain data is composed below by enabled packs.
    supabase
      .from('users')
      .select(`
        id, telegram_id, telegram_username, telegram_first_name, telegram_photo_url, telegram_phone,
        display_preference, opt_in_telegram_notifications, is_blocked, created_at, updated_at
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('access_attempts')
      .select('id, ip, user_agent, tg_sdk_present, tg_sdk_fake, devtools_opened, screen, timezone, language, url, telegram_id, telegram_username, telegram_first_name, geo_location, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const allUsers = users ?? []
  const [walletData, sportsData, gamesData, donationsData, leaderboardData] = await Promise.all([
    isPackEnabled('stellar-wallet') ? getWalletAdminData(supabase) : null,
    isPackEnabled('sports') ? getSportsAdminData(supabase) : null,
    isPackEnabled('games') ? getGamesAdminData(supabase) : null,
    isPackEnabled('donations') ? getDonationsAdminData(supabase) : null,
    isPackEnabled('leaderboard') ? getLeaderboardAdminData(supabase) : null,
  ])

  const referred = leaderboardData?.referredUsers ?? []
  const referredByTelegramId = new Map(referred.map((user) => [user.telegram_id, user.referred_by]))

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
    const referrer = allUsers.find((u) => u.telegram_id === referrerId)
    return {
      referrer_id: referrerId,
      referrer_name: referrer?.telegram_first_name ?? null,
      referrer_username: referrer?.telegram_username ?? null,
      referral_count: stats.count,
      last_referral_at: stats.lastAt,
    }
  }).sort((a, b) => b.referral_count - a.referral_count)

  const adminUsers = allUsers.map(({ id, ...user }) => ({
    ...user,
    favorite_team: sportsData?.teamsByTelegramId.get(user.telegram_id) ?? null,
    referred_by: referredByTelegramId.get(user.telegram_id) ?? null,
    bonus_balls: gamesData?.bonusesByTelegramId.get(user.telegram_id)?.bonus_balls ?? 0,
    bonus_spins: gamesData?.bonusesByTelegramId.get(user.telegram_id)?.bonus_spins ?? 0,
    wallets: walletData?.walletsByUserId.get(id) ?? [],
  }))

  return ok({
    users: adminUsers,
    teamRequests: sportsData?.teamRequests ?? [],
    gameSessions: gamesData?.gameSessions ?? [],
    donations: donationsData?.donations ?? [],
    purchases: walletData?.purchases ?? [],
    accessAttempts: accessAttempts ?? [],
    referralStats,
    referredUsers: referred,
    trustlineSubmissions: walletData?.trustlineSubmissions ?? [],
    totalNsafl: walletData?.totalNsafl,
    totalXlm: walletData?.totalXlm,
  })
}
