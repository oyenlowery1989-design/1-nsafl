/**
 * GET /api/admin/user-search?q={telegramId|username}
 * Looks up a user by Telegram ID (numeric) or username (string).
 * Returns user info, wallets, balances, win count, referral count.
 */
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return fail('q is required', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()

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
    const { data: idRow } = await supabase.from('users').select('id').eq('telegram_id', u.telegram_id).single()
    const { data: wallets } = idRow
      ? await supabase
          .from('wallets')
          .select('id, stellar_address, is_primary, label, wallet_balances(primary_asset_balance, xlm_balance, last_synced_at)')
          .eq('user_id', idRow.id)
          .limit(5)
      : { data: [] }

    // Win count
    const { count: winCount } = await supabase
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', u.telegram_id)
      .neq('prize', 'Better Luck')

    // Referral count
    const { count: refCount } = await supabase
      .from('users')
      .select('telegram_id', { count: 'exact', head: true })
      .eq('referred_by', u.telegram_id)

    return {
      ...u,
      wallets: wallets ?? [],
      winCount: winCount ?? 0,
      referralCount: refCount ?? 0,
    }
  }))

  return ok({ users: enriched, total: enriched.length })
}
