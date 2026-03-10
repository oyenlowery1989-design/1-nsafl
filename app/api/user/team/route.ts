import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'
import { AFL_CLUBS } from '@/config/afl'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

function getUser(req: NextRequest): TelegramUser | null {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const realUser = initData ? validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!) : null
  if (realUser) return realUser
  if (isDev) return { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  return null
}

// GET — fetch current team + any pending request
export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const supabase = createServiceClient()

  const [{ data: userRow }, { data: pendingRow }] = await Promise.all([
    supabase
      .from('users')
      .select('favorite_team')
      .eq('telegram_id', telegramUser.id)
      .single(),
    supabase
      .from('team_change_requests')
      .select('id, requested_team, status, created_at, admin_note')
      .eq('telegram_id', telegramUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return ok({
    favoriteTeam: userRow?.favorite_team ?? null,
    pendingRequest: pendingRow ?? null,
  })
}

// POST — submit a team change request (not instant)
export async function POST(req: NextRequest) {
  const rateLimitError = checkRateLimit(req, 5)
  if (rateLimitError) return rateLimitError

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const body = await req.json()
  const { teamId } = body as { teamId: string }

  if (!teamId || typeof teamId !== 'string') {
    return fail('Missing team ID', 'MISSING_TEAM')
  }

  if (!AFL_CLUBS.find((c) => c.id === teamId)) {
    return fail('Invalid team', 'INVALID_TEAM')
  }

  const supabase = createServiceClient()

  // Block if they already have a pending request
  const { data: existing } = await supabase
    .from('team_change_requests')
    .select('id')
    .eq('telegram_id', telegramUser.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return fail('You already have a pending team change request', 'ALREADY_PENDING')
  }

  // Check they're not requesting the same team they already have
  const { data: userRow } = await supabase
    .from('users')
    .select('favorite_team')
    .eq('telegram_id', telegramUser.id)
    .single()

  if (userRow?.favorite_team === teamId) {
    return fail('That is already your current team', 'SAME_TEAM')
  }

  const { error } = await supabase
    .from('team_change_requests')
    .insert({ telegram_id: telegramUser.id, requested_team: teamId })

  if (error) return fail('Failed to submit request', 'DB_ERROR', 500)

  return ok({ requested: true, teamId })
}
