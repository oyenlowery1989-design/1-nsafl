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

// 1 free scratch card per day for Tier 1+, 1 welcome card for Tier 0
const DAILY_CARDS_TIER1_PLUS = 1
const WELCOME_CARDS_TIER0 = 1

interface CardStatus {
  baseLimit: number
  bonusCards: number
  cardsUsed: number
  cardsRemaining: number
  canScratch: boolean
}

async function getCardStatus(supabase: ReturnType<typeof createServiceClient>, telegramId: number): Promise<CardStatus> {
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
  const dailyBase = isTier0 ? 0 : DAILY_CARDS_TIER1_PLUS

  // Scratch cards share the bonus_spins pool for bonus cards
  let bonusCards = userRow?.bonus_spins ?? 0

  // Auto-seed welcome card for first-time Tier 0 users
  if (isTier0 && bonusCards === 0 && userRow?.id) {
    const { count: everPlayed } = await (supabase as any)
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', telegramId)
      .eq('prize_source', 'scratch_card')
    if ((everPlayed ?? 0) === 0) {
      await (supabase as any)
        .from('users')
        .update({ bonus_spins: WELCOME_CARDS_TIER0 })
        .eq('telegram_id', telegramId)
      bonusCards = WELCOME_CARDS_TIER0
    }
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const { count } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('prize_source', 'scratch_card')
    .gte('created_at', today.toISOString())

  const cardsUsed = count ?? 0
  const cardsRemaining = Math.max(0, dailyBase - cardsUsed) + bonusCards

  return {
    baseLimit: dailyBase,
    bonusCards,
    cardsUsed,
    cardsRemaining,
    canScratch: cardsUsed < dailyBase || bonusCards > 0,
  }
}

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  if (IS_DEV) return ok({ cardsUsed: 0, dailyLimit: 99, cardsRemaining: 99, canScratch: true, bonusCards: 0 })

  const supabase = createServiceClient()
  const status = await getCardStatus(supabase, user.id)

  return ok({
    cardsUsed: status.cardsUsed,
    dailyLimit: status.baseLimit,
    bonusCards: status.bonusCards,
    cardsRemaining: status.cardsRemaining,
    canScratch: status.canScratch,
  })
}

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const limited = checkRateLimit(req, 10, `game-scratch:${user.id}`)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body?.prize) return fail('Missing fields', 'BAD_REQUEST')

  const supabase = createServiceClient()

  if (!IS_DEV) {
    const status = await getCardStatus(supabase, user.id)
    if (!status.canScratch) return fail('No cards remaining', 'DAILY_LIMIT', 429)

    // Consume bonus card if daily base exhausted
    if (status.cardsUsed >= status.baseLimit && status.bonusCards > 0) {
      const { data: decremented } = await (supabase as any)
        .from('users')
        .update({ bonus_spins: status.bonusCards - 1 })
        .eq('telegram_id', user.id)
        .eq('bonus_spins', status.bonusCards)
        .select('bonus_spins')
      if (!decremented?.length) return fail('No cards remaining', 'DAILY_LIMIT', 429)
    }
  }

  const winCode = `SCRATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const { data: inserted, error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: body.prize,
      amount: body.amount ?? null,
      win_code: winCode,
      wallet_address: body.wallet ?? null,
      claimed: false,
      prize_source: 'scratch_card',
    })
    .select('id')
    .single()

  if (error) {
    console.error('scratch_card insert error:', error.message)
    return fail('Failed to save result', 'DB_ERROR', 500)
  }

  const winId: number | undefined = inserted?.id
  const walletAddress: string | undefined = body.wallet
  const isAssetPrize = !!prizeToAsset(body.prize)

  if (!IS_DEV && isAssetPrize && winId && walletAddress && REWARD_SENDER_SECRET) {
    const payment = await sendPrizePayment(body.prize, body.amount, walletAddress, winId, supabase)
    if (payment.sent) {
      void notifyPrizeSent(user.id, body.prize, payment.txHash!)
      return ok({ saved: true, autoSent: true, txHash: payment.txHash, winCode })
    }
    return ok({ saved: true, autoSent: false, paymentError: payment.code, winCode })
  }

  return ok({ saved: true, autoSent: false, winCode })
}
