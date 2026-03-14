import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { getTierForBalance, TIERS } from '@/config/tiers'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

async function getDailySpinLimit(supabase: ReturnType<typeof createServiceClient>, telegramId: number): Promise<number> {
  // Get primary wallet → nsafl_balance
  const { data: userRow } = await (supabase as any)
    .from('users')
    .select('id, bonus_spins')
    .eq('telegram_id', telegramId)
    .single()

  let tierIndex = 0
  if (userRow?.id) {
    const { data: wallet } = await (supabase as any)
      .from('wallets')
      .select('id')
      .eq('user_id', userRow.id)
      .eq('is_primary', true)
      .single()

    if (wallet?.id) {
      const { data: balanceRow } = await (supabase as any)
        .from('wallet_balances')
        .select('nsafl_balance')
        .eq('wallet_id', wallet.id)
        .single()

      if (balanceRow?.nsafl_balance != null) {
        const tier = getTierForBalance(Number(balanceRow.nsafl_balance))
        tierIndex = Math.max(0, TIERS.findIndex((t) => t.id === tier.id))
      }
    }
  }

  // Count referrals
  const { count: referralCount } = await (supabase as any)
    .from('users')
    .select('telegram_id', { count: 'exact', head: true })
    .eq('referred_by', telegramId)

  const bonusSpins = userRow?.bonus_spins ?? 0
  // minimum 1 so everyone gets at least 1 spin
  return Math.max(1, tierIndex + (referralCount ?? 0) + bonusSpins)
}

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const supabase = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [{ count }, dailyLimit] = await Promise.all([
    (supabase as any)
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', user.id)
      .eq('prize_source', 'lucky_draw')
      .gte('created_at', today.toISOString()),
    IS_DEV ? Promise.resolve(99) : getDailySpinLimit(supabase, user.id),
  ])

  const spinsUsed = count ?? 0
  return ok({
    spinsUsed,
    dailyLimit,
    spinsRemaining: Math.max(0, dailyLimit - spinsUsed),
    canSpin: spinsUsed < dailyLimit,
  })
}

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const body = await req.json().catch(() => null)
  if (!body?.code || !body?.prize) return fail('Missing fields', 'BAD_REQUEST')

  const supabase = createServiceClient()

  // Require the user to hold the primary asset — no free rides
  if (!IS_DEV) {
    const { data: userRow } = await (supabase as any)
      .from('users').select('id').eq('telegram_id', user.id).single()
    if (userRow?.id) {
      const { data: w } = await (supabase as any)
        .from('wallets').select('id').eq('user_id', userRow.id).eq('is_primary', true).single()
      if (w?.id) {
        const { data: bal } = await (supabase as any)
          .from('wallet_balances').select('nsafl_balance').eq('wallet_id', w.id).single()
        if (!bal || Number(bal.nsafl_balance) < 100) {
          return fail('Tier 1 required (100+ NSAFL) to play', 'NO_BALANCE', 403)
        }
      }
    }
  }

  // Server-side daily limit check
  if (!IS_DEV) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [{ count }, dailyLimit] = await Promise.all([
      (supabase as any)
        .from('lucky_draw_wins')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_id', user.id)
        .eq('prize_source', 'lucky_draw')
        .gte('created_at', today.toISOString()),
      getDailySpinLimit(supabase, user.id),
    ])

    if ((count ?? 0) >= dailyLimit) {
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
