import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { getTierForBalance, TIERS } from '@/config/tiers'
import { prizeToAsset } from '@/lib/rewardAssets'
import { sendPrizePayment, REWARD_SENDER_SECRET, notifyPrizeSent } from '@/lib/stellar-payment'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// Daily spins by tier:
//   Tier 0 (pre-tier) → 0 daily; gets 3 welcome bonus spins once (auto-seeded on first check)
//   Tier 1+           → 3 daily spins (resets midnight UTC)
const DAILY_SPINS_TIER1_PLUS = 3
const WELCOME_SPINS_TIER0 = 3

interface SpinStatus {
  baseLimit: number   // daily spins based on tier (0 for pre-tier, 3 for tier 1+)
  bonusSpins: number  // one-time pool — consumed when used, never refills automatically
  spinsUsed: number   // lucky_draw_wins today
  spinsRemaining: number
  canSpin: boolean
}

async function getSpinStatus(supabase: ReturnType<typeof createServiceClient>, telegramId: number): Promise<SpinStatus> {
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

  let bonusSpins = userRow?.bonus_spins ?? 0

  // Auto-seed welcome spins for first-time Tier 0 users
  if (isTier0 && bonusSpins === 0 && userRow?.id) {
    const { count: everWon } = await (supabase as any)
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', telegramId)
    if ((everWon ?? 0) === 0) {
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
    .eq('prize_source', 'lucky_draw')
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
  const status = await getSpinStatus(supabase, user.id)

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

  const body = await req.json().catch(() => null)
  if (!body?.prize) return fail('Missing fields', 'BAD_REQUEST')

  const supabase = createServiceClient()

  // Free Spin results must NOT consume a spin or be recorded
  const isFreeSpin = body.prize === 'Free Spin'

  // Server-side spin limit check — and consume bonus spin if needed
  if (!IS_DEV && !isFreeSpin) {
    const status = await getSpinStatus(supabase, user.id)

    if (!status.canSpin) {
      return fail('No spins remaining', 'DAILY_LIMIT', 429)
    }

    // If daily base is exhausted, consume a bonus spin — atomic decrement
    if (status.spinsUsed >= status.baseLimit && status.bonusSpins > 0) {
      const { data: decremented } = await (supabase as any)
        .from('users')
        .update({ bonus_spins: status.bonusSpins - 1 })
        .eq('telegram_id', user.id)
        .eq('bonus_spins', status.bonusSpins) // optimistic lock
        .select('bonus_spins')
      if (!decremented?.length) {
        return fail('No spins remaining', 'DAILY_LIMIT', 429)
      }
    }
  }

  if (isFreeSpin) {
    // Free Spin prize — no DB record, no spin consumed
    return ok({ saved: true, freeSpin: true })
  }

  // Generate a win code server-side if not provided (non-asset prizes)
  const winCode = body.code ?? `SPIN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const { data: inserted, error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: body.prize,
      amount: body.amount ?? null,
      win_code: winCode,
      wallet_address: body.wallet ?? null,
      claimed: false,
      prize_source: 'lucky_draw',
    })
    .select('id')
    .single()

  if (error) {
    console.error('lucky_draw_wins insert error:', error.message)
    return fail('Failed to save win', 'DB_ERROR', 500)
  }

  // For +2 Spins prize: increment user's bonus_spins (read-then-write; low-contention acceptable)
  if (body.prize === '+2 Spins' && !IS_DEV) {
    const { data: userRow } = await (supabase as any)
      .from('users').select('id, bonus_spins').eq('telegram_id', user.id).single()
    if (userRow?.id) {
      await (supabase as any)
        .from('users')
        .update({ bonus_spins: (userRow.bonus_spins ?? 0) + 2 })
        .eq('telegram_id', user.id)
        .eq('bonus_spins', userRow.bonus_spins ?? 0) // optimistic lock
    }
  }

  // Auto-send asset prizes immediately if sender is configured and user has a wallet address
  const winId: number | undefined = inserted?.id
  const walletAddress: string | undefined = body.wallet
  const isAssetPrize = !!prizeToAsset(body.prize)

  if (!IS_DEV && isAssetPrize && winId && walletAddress && REWARD_SENDER_SECRET) {
    const payment = await sendPrizePayment(body.prize, body.amount, walletAddress, winId, supabase)
    if (payment.sent) {
      void notifyPrizeSent(user.id, body.prize, payment.txHash!)
      return ok({ saved: true, autoSent: true, txHash: payment.txHash })
    }
    // Payment failed (e.g. no trustline) — win is recorded, admin can retry
    return ok({ saved: true, autoSent: false, paymentError: payment.code, lobstrDeeplink: payment.lobstrDeeplink })
  }

  return ok({ saved: true, autoSent: false })
}
