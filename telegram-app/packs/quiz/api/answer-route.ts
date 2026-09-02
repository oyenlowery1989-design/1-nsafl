import { NextRequest } from 'next/server'
import { requireFeature } from '@/lib/feature-gate'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'
import { checkRateLimit } from '@/lib/rate-limit'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const disabled = requireFeature('quiz')
  if (disabled) return disabled

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

  const limited = checkRateLimit(req, 30, `quiz:answer:${telegramId}`)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body?.sessionId || !body?.questionId || !body?.chosen) {
    return fail('Missing fields', 'BAD_REQUEST', 400)
  }
  const { sessionId, questionId, chosen } = body

  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('quiz_sessions')
    .select('telegram_id, status, question_ids, answers_given, expires_at')
    .eq('id', sessionId)
    .single()

  if (!session) return fail('Session not found', 'NOT_FOUND', 404)
  if (session.telegram_id !== telegramId) return fail('Forbidden', 'FORBIDDEN', 403)
  if (session.status !== 'in_progress') return fail('Session not active', 'SESSION_DONE', 409)
  if (new Date(session.expires_at) < new Date()) return fail('Session expired', 'EXPIRED', 410)
  if (!session.question_ids.includes(questionId)) return fail('Question not in session', 'BAD_QUESTION', 400)

  // answers_given is jsonb — application convention is Record<questionId, chosenOption>
  const answersGiven = (session.answers_given as Record<string, string> | null) ?? {}
  if (answersGiven[questionId]) return fail('Already answered', 'ALREADY_ANSWERED', 409)

  const { data: q } = await supabase
    .from('quiz_questions')
    .select('correct_option, explanation')
    .eq('id', questionId)
    .single()

  if (!q) return fail('Question not found', 'NOT_FOUND', 404)

  const correct = chosen === q.correct_option
  const updatedAnswers = { ...answersGiven, [questionId]: chosen }
  await supabase
    .from('quiz_sessions')
    .update({ answers_given: updatedAnswers })
    .eq('id', sessionId)

  return ok({
    correct,
    correctOption: q.correct_option,
    explanation: q.explanation ?? null,
  })
}
