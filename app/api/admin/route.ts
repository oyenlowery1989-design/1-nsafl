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
  ] = await Promise.all([
    // Users + wallets + balances in one shot
    supabase
      .from('users')
      .select(`
        telegram_id, telegram_username, telegram_first_name, telegram_photo_url, telegram_phone,
        favorite_team, display_preference, opt_in_telegram_notifications, is_blocked,
        referred_by, created_at, updated_at,
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
  ])

  return ok({
    users: users ?? [],
    teamRequests: teamRequests ?? [],
    gameSessions: gameSessions ?? [],
    donations: donations ?? [],
    purchases: purchases ?? [],
    accessAttempts: accessAttempts ?? [],
  })
}
