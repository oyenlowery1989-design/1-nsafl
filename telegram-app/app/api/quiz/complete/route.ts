import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'
import { checkRateLimit } from '@/lib/rate-limit'
import { incrementBonusPool } from '@/lib/gamePool'
import { nanoid } from 'nanoid'
import { WRAPPED_PRIMARY_ASSET_CODE } from '@/lib/rewardAssets'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

const MODE_MULT: Record<string, number> = { quick: 1, standard: 1.5, champion: 2 }
const BASE_POINTS = 10

const PERFECT_PRIZES = [
  { label: '1000 XLM', prize: 'xlm_1000', weight: 10 },
  { label: '100 XLM', prize: 'xlm_100', weight: 20 },
  { label: `100 ${WRAPPED_PRIMARY_ASSET_CODE}`, prize: 'token_100', weight: 30 },
  { label: `50 ${WRAPPED_PRIMARY_ASSET_CODE}`, prize: 'token_50', weight: 40 },
  { label: `25 ${WRAPPED_PRIMARY_ASSET_CODE}`, prize: 'token_25', weight: 50 },
  { label: '+1 Ball', prize: 'ball', weight: 170 },
  { label: 'Better luck next time!', prize: 'none', weight: 680 },
]

function pickPrize() {
  const total = PERFECT_PRIZES.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (const p of PERFECT_PRIZES) {
    r -= p.weight
    if (r <= 0) return p
  }
  return PERFECT_PRIZES[PERFECT_PRIZES.length - 1]
}

export async function POST(req: NextRequest) {
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

  const limited = checkRateLimit(req, 10, `quiz:complete:${telegramId}`)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body?.sessionId) return fail('Missing sessionId', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('quiz_sessions')
    .select('telegram_id, mode, status, question_ids, answers_given, expires_at, total_questions')
    .eq('id', body.sessionId)
    .single()

  if (!session) return fail('Session not found', 'NOT_FOUND', 404)
  if (session.telegram_id !== telegramId) return fail('Forbidden', 'FORBIDDEN', 403)
  if (session.status !== 'in_progress') return fail('Already completed', 'SESSION_DONE', 409)
  if (new Date(session.expires_at) < new Date()) return fail('Session expired', 'EXPIRED', 410)

  // answers_given is jsonb — application convention is Record<questionId, chosenOption>
  const answersGiven = (session.answers_given as Record<string, string> | null) ?? {}
  const answeredIds = Object.keys(answersGiven)
  let correctCount = 0

  if (answeredIds.length > 0) {
    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('id, correct_option')
      .in('id', answeredIds)

    for (const q of (questions ?? [])) {
      if (answersGiven[q.id] === q.correct_option) correctCount++
    }
  }

  const mult = MODE_MULT[session.mode] ?? 1
  const pointsEarned = Math.round(correctCount * BASE_POINTS * mult)
  const isPerfect = correctCount === session.total_questions && session.total_questions > 0

  await supabase
    .from('quiz_sessions')
    .update({
      status: 'completed',
      correct_count: correctCount,
      score: correctCount,
      is_perfect: isPerfect,
      points_earned: pointsEarned,
    })
    .eq('id', body.sessionId)

  if (pointsEarned > 0 && telegramId !== 0) {
    const { data: userData } = await supabase
      .from('users')
      .select('quiz_points')
      .eq('telegram_id', telegramId)
      .single()
    const currentPoints = (userData as unknown as { quiz_points: number } | null)?.quiz_points ?? 0
    await supabase
      .from('users')
      .update({ quiz_points: currentPoints + pointsEarned })
      .eq('telegram_id', telegramId)
  }

  let prize = null
  if (isPerfect && telegramId !== 0) {
    const picked = pickPrize()
    if (picked.prize !== 'none') {
      const winCode = nanoid(10).toUpperCase()
      await supabase.from('lucky_draw_wins').insert({
        telegram_id: telegramId,
        prize: picked.label,
        amount: null,
        win_code: winCode,
        payout_status: 'pending',
        prize_source: 'quiz',
      })
      prize = { label: picked.label, winCode }

      if (picked.label === '+1 Ball') {
        await incrementBonusPool(supabase, telegramId, 'bonus_balls', 1, picked.label)
      }
    }
  }

  return ok({ correctCount, totalQuestions: session.total_questions, pointsEarned, isPerfect, prize })
}
