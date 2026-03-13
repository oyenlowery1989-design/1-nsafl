import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'

const MODE_Q: Record<string, number> = { quick: 5, standard: 10, champion: 20 }
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

  const mode = req.nextUrl.searchParams.get('mode') ?? 'quick'
  if (!MODE_Q[mode]) return fail('Invalid mode', 'INVALID_MODE', 400)
  const numQ = MODE_Q[mode]

  const supabase = createServiceClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await (supabase as any)
    .from('quiz_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('mode', mode)
    .neq('status', 'abandoned')
    .gte('created_at', today.toISOString())

  const used = count ?? 0
  if (used >= DAILY_LIMIT) {
    return fail(`Daily limit reached (${DAILY_LIMIT} plays per mode per day)`, 'DAILY_LIMIT', 429)
  }

  const { data: allQ } = await (supabase as any)
    .from('quiz_questions')
    .select('id, question, option_a, option_b, option_c, option_d, category, difficulty')
    .eq('active', true)

  if (!allQ || allQ.length < numQ) {
    return fail('Not enough questions available', 'INSUFFICIENT_QUESTIONS', 503)
  }

  const shuffled = [...allQ]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const questions = shuffled.slice(0, numQ)
  const questionIds = questions.map((q: { id: string }) => q.id)

  const { data: session, error } = await (supabase as any)
    .from('quiz_sessions')
    .insert({
      telegram_id: telegramId,
      mode,
      total_questions: numQ,
      question_ids: questionIds,
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (error || !session) return fail('Failed to create session', 'DB_ERROR', 500)

  return ok({
    sessionId: session.id,
    mode,
    playsUsedToday: used + 1,
    playsRemainingToday: DAILY_LIMIT - used - 1,
    questions,
  })
}
