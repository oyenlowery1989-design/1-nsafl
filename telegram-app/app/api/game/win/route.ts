import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
const DAILY_SPIN_LIMIT = 1

export async function GET(req: NextRequest) {
  // Returns how many spins the user has used today
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const supabase = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const { count } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', user.id)
    .eq('prize_source', 'lucky_draw')
    .gte('created_at', today.toISOString())

  const spinsUsed = count ?? 0
  return ok({
    spinsUsed,
    spinsRemaining: Math.max(0, DAILY_SPIN_LIMIT - spinsUsed),
    canSpin: spinsUsed < DAILY_SPIN_LIMIT,
  })
}

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const body = await req.json().catch(() => null)
  if (!body?.code || !body?.prize) return fail('Missing fields', 'BAD_REQUEST')

  const supabase = createServiceClient()

  // Server-side daily limit check
  if (!IS_DEV) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { count } = await (supabase as any)
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', user.id)
      .eq('prize_source', 'lucky_draw')
      .gte('created_at', today.toISOString())

    if ((count ?? 0) >= DAILY_SPIN_LIMIT) {
      return fail('Daily spin limit reached', 'DAILY_LIMIT', 429)
    }
  }

  const { error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: body.prize,
      amount: body.amount ?? null,
      win_code: body.code,
      wallet_address: body.wallet ?? null,
      claimed: false,
      prize_source: 'lucky_draw',
    })

  if (error) {
    console.error('lucky_draw_wins insert error:', error.message)
    return fail('Failed to save win', 'DB_ERROR', 500)
  }

  return ok({ saved: true })
}
