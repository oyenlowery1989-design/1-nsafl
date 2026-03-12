import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const VALID_PREFS = ['address', 'name', 'username'] as const
type DisplayPref = (typeof VALID_PREFS)[number]
const DEV_TELEGRAM_ID = 999999999

function getTelegramId(req: NextRequest, isDev: boolean): number | null {
  // Always try real initData first; fall back to mock only when absent
  const initData = req.headers.get('x-telegram-init-data')
  const tgUser = initData ? validateTelegramInitData(initData, BOT_TOKEN) : null
  if (tgUser?.id) return tgUser.id
  if (isDev) return DEV_TELEGRAM_ID
  return null
}

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
  const telegramId = getTelegramId(req, isDev)
  const rateLimitErr = checkRateLimit(req, 60, `display-pref-get:${telegramId ?? 'anon'}`)
  if (rateLimitErr) return rateLimitErr
  if (!telegramId) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('display_preference')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  return ok({ displayPreference: (data?.display_preference ?? 'address') as DisplayPref })
}

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
  const telegramId = getTelegramId(req, isDev)
  const rateLimitErr = checkRateLimit(req, 20, `display-pref:${telegramId ?? 'anon'}`)
  if (rateLimitErr) return rateLimitErr
  if (!telegramId) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  const body = await req.json() as { displayPreference: string }
  const pref = body.displayPreference

  if (!VALID_PREFS.includes(pref as DisplayPref)) {
    return fail('Invalid preference value', 'INVALID_DATA')
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ display_preference: pref })
    .eq('telegram_id', telegramId)

  if (error) return fail('Failed to save preference', 'DB_ERROR', 500)

  return ok({ saved: true, displayPreference: pref })
}
