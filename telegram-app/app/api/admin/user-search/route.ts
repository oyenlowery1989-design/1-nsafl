/**
 * GET /api/admin/user-search?q={telegramId|username}
 * Looks up a user by Telegram ID (numeric) or username (string).
 * Returns user info, wallets, balances, win count, referral count.
 */
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'
import { createStellarWalletRepository } from '@/packs/stellar-wallet/repository'
import { createGamesRepository } from '@/packs/games/repository'
import { createLeaderboardRepository } from '@/packs/leaderboard/repository'
import { createSportsRepository } from '@/packs/sports/repository'
import { isPackEnabled } from '@/config/app'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return fail('q is required', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()
  const wallets = createStellarWalletRepository(supabase)
  const games = createGamesRepository(supabase)
  const leaderboard = createLeaderboardRepository(supabase)
  const sports = createSportsRepository(supabase)

  // Build query — numeric = search by telegram_id, otherwise by username
  const isNumeric = /^\d+$/.test(q)
  let userQuery = supabase
    .from('users')
    .select('telegram_id, telegram_username, telegram_first_name, telegram_photo_url, is_blocked, created_at, opt_in_telegram_notifications')

  userQuery = isNumeric
    ? userQuery.eq('telegram_id', Number(q))
    : userQuery.ilike('telegram_username', `%${q}%`)

  const { data: users, error } = await userQuery.limit(10)
  if (error) return fail('DB error', 'DB_ERROR', 500)
  if (!users || users.length === 0) return fail('No user found', 'NOT_FOUND', 404)

  // Domain fields are composed only by their enabled packs.
  const enriched = await Promise.all(users.map(async (u) => {
    return {
      telegram_id: u.telegram_id,
      telegram_username: u.telegram_username,
      telegram_first_name: u.telegram_first_name,
      telegram_photo_url: u.telegram_photo_url,
      is_blocked: u.is_blocked,
      created_at: u.created_at,
      opt_in_telegram_notifications: u.opt_in_telegram_notifications,
      ...(isPackEnabled('stellar-wallet') ? { wallets: await wallets.listWallets(u.telegram_id) } : {}),
      ...(isPackEnabled('sports') ? { favorite_team: await sports.getFavoriteTeam(u.telegram_id) } : {}),
      ...(isPackEnabled('games') ? {
        bonus_spins: await games.getBonusSpins(u.telegram_id),
        winCount: await games.countWins(u.telegram_id),
      } : {}),
      ...(isPackEnabled('leaderboard') ? { referralCount: await leaderboard.countReferrals(u.telegram_id) } : {}),
    }
  }))

  return ok({ users: enriched, total: enriched.length })
}
