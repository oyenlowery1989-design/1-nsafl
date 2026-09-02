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

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return fail('q is required', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()
  const wallets = createStellarWalletRepository(supabase)
  const games = createGamesRepository(supabase)
  const leaderboard = createLeaderboardRepository(supabase)

  // Build query — numeric = search by telegram_id, otherwise by username
  const isNumeric = /^\d+$/.test(q)
  let userQuery = supabase
    .from('users')
    .select('telegram_id, telegram_username, telegram_first_name, telegram_photo_url, favorite_team, is_blocked, referred_by, created_at, opt_in_telegram_notifications, bonus_spins')

  userQuery = isNumeric
    ? userQuery.eq('telegram_id', Number(q))
    : userQuery.ilike('telegram_username', `%${q}%`)

  const { data: users, error } = await userQuery.limit(10)
  if (error) return fail('DB error', 'DB_ERROR', 500)
  if (!users || users.length === 0) return fail('No user found', 'NOT_FOUND', 404)

  // Enrich each user with wallet, balance, win count, referral count
  const enriched = await Promise.all(users.map(async (u) => {
    // Wallets + balances
    const userWallets = await wallets.listWallets(u.telegram_id)

    // Win count
    const winCount = await games.countWins(u.telegram_id)

    // Referral count
    const refCount = await leaderboard.countReferrals(u.telegram_id)

    return {
      ...u,
      wallets: userWallets,
      winCount,
      referralCount: refCount,
    }
  }))

  return ok({ users: enriched, total: enriched.length })
}
