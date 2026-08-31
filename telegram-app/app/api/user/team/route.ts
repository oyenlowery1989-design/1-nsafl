import { NextRequest } from 'next/server'
import { requireFeature } from '@/lib/feature-gate'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'
import { ALL_CLUBS } from '@/config/afl'

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

// GET — fetch current team
export async function GET(req: NextRequest) {
  const disabled = requireFeature('sports')
  if (disabled) return disabled

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const supabase = createServiceClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('favorite_team, favorite_wafl_team')
    .eq('telegram_id', telegramUser.id)
    .single() as { data: { favorite_team: string | null; favorite_wafl_team: string | null } | null }

  return ok({ favoriteTeam: userRow?.favorite_team ?? null, favoriteWaflTeam: userRow?.favorite_wafl_team ?? null })
}

// POST — instantly update team (no approval needed)
export async function POST(req: NextRequest) {
  const disabled = requireFeature('sports')
  if (disabled) return disabled

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const rateLimitError = checkRateLimit(req, 10, `team:${telegramUser.id}`)
  if (rateLimitError) return rateLimitError

  const body = await req.json()
  const { teamId, waflTeamId } = body as { teamId: string; waflTeamId?: string | null }

  if (!teamId || typeof teamId !== 'string') {
    return fail('Missing team ID', 'MISSING_TEAM')
  }

  if (!ALL_CLUBS.find((c) => c.id === teamId)) {
    return fail('Invalid team', 'INVALID_TEAM')
  }

  if (waflTeamId !== undefined && waflTeamId !== null && !ALL_CLUBS.find((c) => c.id === waflTeamId)) {
    return fail('Invalid WAFL team', 'INVALID_TEAM')
  }

  const supabase = createServiceClient()

  const updatePayload: Record<string, string | null> = { favorite_team: teamId }
  if (waflTeamId !== undefined) updatePayload.favorite_wafl_team = waflTeamId ?? null

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('telegram_id', telegramUser.id)

  if (error) return fail('Failed to update team', 'DB_ERROR', 500)

  return ok({ teamId, waflTeamId: waflTeamId ?? null })
}
