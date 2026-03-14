import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'

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

// GET — returns the caller's current server-side bonus ball count
export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('users')
    .select('bonus_balls')
    .eq('telegram_id', telegramUser.id)
    .single()

  return ok({ bonusBalls: data?.bonus_balls ?? 0 })
}

// POST — increments bonus_balls by 1 (called when Lucky Draw "+1 Ball" prize is won)
export async function POST(req: NextRequest) {
  const rateLimitError = checkRateLimit(req, 20)
  if (rateLimitError) return rateLimitError

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const supabase = createServiceClient()

  const { data: current } = await (supabase as any)
    .from('users')
    .select('bonus_balls')
    .eq('telegram_id', telegramUser.id)
    .single()

  const next = (current?.bonus_balls ?? 0) + 1

  await (supabase as any)
    .from('users')
    .update({ bonus_balls: next })
    .eq('telegram_id', telegramUser.id)

  return ok({ bonusBalls: next })
}
