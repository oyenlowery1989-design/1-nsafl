import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { getTierForBalance, TIERS } from '@/config/tiers'
import { prizeToAsset } from '@/lib/rewardAssets'
import { sendPrizePayment, REWARD_SENDER_SECRET, notifyPrizeSent } from '@/lib/stellar-payment'
import { checkRateLimit } from '@/lib/rate-limit'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// Slot machine has its own separate daily spin pool (independent of Lucky Draw)
const DAILY_SPINS_TIER1_PLUS = 3
const WELCOME_SPINS_TIER0 = 3

interface SpinStatus {
  baseLimit: number
  bonusSpins: number
  spinsUsed: number
  spinsRemaining: number
  canSpin: boolean
}

async function getSlotStatus(supabase: ReturnType<typeof createServiceClient>, telegramId: number): Promise<SpinStatus> {
  const { data: userRow } = await (supabase as any)
    .from('users')
    .select('id, bonus_spins')
    .eq('telegram_id', telegramId)
    .single()

  let tierIndex = 0
  if (userRow?.id) {
    const { data: wallet } = await (supabase as any)
      .from('wallets').select('id').eq('user_id', userRow.id).eq('is_primary', true).single()
    if (wallet?.id) {
      const { data: balanceRow } = await (supabase as any)
        .from('wallet_balances').select('nsafl_balance').eq('wallet_id', wallet.id).single()
      if (balanceRow?.nsafl_balance != null) {
        const tier = getTierForBalance(Number(balanceRow.nsafl_balance))
        tierIndex = Math.max(0, TIERS.findIndex((t) => t.id === tier.id))
      }
    }
  }

  const isTier0 = tierIndex === 0
  const dailyBase = isTier0 ? 0 : DAILY_SPINS_TIER1_PLUS

  // Slot machine shares the bonus_spins pool with Lucky Draw
  let bonusSpins = userRow?.bonus_spins ?? 0

  // Auto-seed welcome spins for first-time Tier 0 users (check slot_machine source)
  if (isTier0 && bonusSpins === 0 && userRow?.id) {
    const { count: everPlayed } = await (supabase as any)
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', telegramId)
      .eq('prize_source', 'slot_machine')
    if ((everPlayed ?? 0) === 0) {
      await (supabase as any)
        .from('users')
        .update({ bonus_spins: WELCOME_SPINS_TIER0 })
        .eq('telegram_id', telegramId)
      bonusSpins = WELCOME_SPINS_TIER0
    }
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const { count } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('prize_source', 'slot_machine')
    .gte('created_at', today.toISOString())

  const spinsUsed = count ?? 0
  const spinsRemaining = Math.max(0, (dailyBase - spinsUsed)) + bonusSpins

  return {
    baseLimit: dailyBase,
    bonusSpins,
    spinsUsed,
    spinsRemaining,
    canSpin: spinsUsed < dailyBase || bonusSpins > 0,
  }
}

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  if (IS_DEV) return ok({ spinsUsed: 0, dailyLimit: 99, spinsRemaining: 99, canSpin: true, bonusSpins: 0 })

  const supabase = createServiceClient()
  const status = await getSlotStatus(supabase, user.id)

  return ok({
    spinsUsed: status.spinsUsed,
    dailyLimit: status.baseLimit,
    bonusSpins: status.bonusSpins,
    spinsRemaining: status.spinsRemaining,
    canSpin: status.canSpin,
  })
}

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const limited = checkRateLimit(req, 10, `game-slot:${user.id}`)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body?.prize) return fail('Missing fields', 'BAD_REQUEST')

  const supabase = createServiceClient()

  const isFreeSpin = body.prize === 'Free Spin'

  if (!IS_DEV && !isFreeSpin) {
    const status = await getSlotStatus(supabase, user.id)

    if (!status.canSpin) {
      return fail('No spins remaining', 'DAILY_LIMIT', 429)
    }

    // Consume bonus spin if daily base is exhausted
    if (status.spinsUsed >= status.baseLimit && status.bonusSpins > 0) {
      const { data: decremented } = await (supabase as any)
        .from('users')
        .update({ bonus_spins: status.bonusSpins - 1 })
        .eq('telegram_id', user.id)
        .eq('bonus_spins', status.bonusSpins)
        .select('bonus_spins')
      if (!decremented?.length) {
        return fail('No spins remaining', 'DAILY_LIMIT', 429)
      }
    }
  }

  if (isFreeSpin) {
    return ok({ saved: true, freeSpin: true })
  }

  const winCode = body.code ?? `SLOT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const { data: inserted, error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: body.prize,
      amount: body.amount ?? null,
      win_code: winCode,
      wallet_address: body.wallet ?? null,
      claimed: false,
      prize_source: 'slot_machine',
    })
    .select('id')
    .single()

  if (error) {
    console.error('slot_machine insert error:', error.message)
    return fail('Failed to save win', 'DB_ERROR', 500)
  }

  // +2 Spins adds to shared bonus_spins pool
  if (body.prize === '+2 Spins' && !IS_DEV) {
    const { data: userRow } = await (supabase as any)
      .from('users').select('id, bonus_spins').eq('telegram_id', user.id).single()
    if (userRow?.id) {
      await (supabase as any)
        .from('users')
        .update({ bonus_spins: (userRow.bonus_spins ?? 0) + 2 })
        .eq('telegram_id', user.id)
        .eq('bonus_spins', userRow.bonus_spins ?? 0)
    }
  }

  const winId: number | undefined = inserted?.id
  const walletAddress: string | undefined = body.wallet
  const isAssetPrize = !!prizeToAsset(body.prize)

  if (!IS_DEV && isAssetPrize && winId && walletAddress && REWARD_SENDER_SECRET) {
    const payment = await sendPrizePayment(body.prize, body.amount, walletAddress, winId, supabase)
    if (payment.sent) {
      void notifyPrizeSent(user.id, body.prize, payment.txHash!)
      return ok({ saved: true, autoSent: true, txHash: payment.txHash })
    }
    return ok({ saved: true, autoSent: false, paymentError: payment.code, lobstrDeeplink: payment.lobstrDeeplink })
  }

  return ok({ saved: true, autoSent: false })
}
