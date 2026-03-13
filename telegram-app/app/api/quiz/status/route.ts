import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'

const MODES = ['quick', 'standard', 'champion']
const DAILY_LIMIT = 3
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  let telegramId: number
  if (DEV_BYPASS && !initData) {
    telegramId = 0
  } else {
    const valid = validateTelegramInitData(initData, BOT_TOKEN)
    if (!valid) return fail('Unauthorized', 'UNAUTHORIZED', 401)
    const user = parseTelegramUser(initData)
    if (!user) return fail('No user', 'NO_USER', 400)
    telegramId = user.id
  }

  const supabase = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [sessionRows, userData] = await Promise.all([
    (supabase as any)
      .from('quiz_sessions')
      .select('mode')
      .eq('telegram_id', telegramId)
      .neq('status', 'abandoned')
      .gte('created_at', today.toISOString()),
    (supabase as any)
      .from('users')
      .select('quiz_points')
      .eq('telegram_id', telegramId)
      .single(),
  ])

  const playsLeft: Record<string, number> = {}
  for (const mode of MODES) {
    const used = (sessionRows.data ?? []).filter((r: { mode: string }) => r.mode === mode).length
    playsLeft[mode] = Math.max(0, DAILY_LIMIT - used)
  }

  return ok({
    playsLeft,
    quizPoints: userData.data?.quiz_points ?? 0,
  })
}
