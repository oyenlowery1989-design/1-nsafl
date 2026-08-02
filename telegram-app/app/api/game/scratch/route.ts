import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { prizeToAsset } from '@/lib/rewardAssets'
import { sendPrizePayment, REWARD_SENDER_SECRET, notifyPrizeSent } from '@/lib/stellar-payment'
import { checkRateLimit } from '@/lib/rate-limit'
import { rollPrize, getSpinStatus, consumeSpin, incrementBonusPool } from '@/lib/gamePool'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  if (IS_DEV) return ok({ cardsUsed: 0, dailyLimit: 99, cardsRemaining: 99, canScratch: true, bonusCards: 0 })

  const supabase = createServiceClient()
  const status = await getSpinStatus(supabase, user.id, 'scratch_card')

  return ok({
    cardsUsed: status.spinsUsed,
    dailyLimit: status.baseLimit,
    bonusCards: status.bonusSpins,
    cardsRemaining: status.spinsRemaining,
    canScratch: status.canSpin,
  })
}

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const limited = checkRateLimit(req, 10, `game:scratch_card:${user.id}`)
  if (limited) return limited

  const supabase = createServiceClient()
  const { prize, index } = rollPrize('scratch_card')

  let walletAddress: string | null = null
  if (!IS_DEV) {
    const consumed = await consumeSpin(supabase, user.id, 'scratch_card')
    if (!consumed.ok) return fail('No cards remaining', 'DAILY_LIMIT', 429)
    walletAddress = consumed.walletAddress
  }

  const winCode = `SCRATCH-${randomBytes(9).toString('base64url').toUpperCase()}`
  const isAssetPrize = !!prizeToAsset(prize.label)
  const { data: inserted, error } = await supabase
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: prize.label,
      amount: prize.amount,
      win_code: winCode,
      wallet_address: walletAddress,
      claimed: false,
      prize_source: 'scratch_card',
      payout_status: isAssetPrize ? 'pending' : 'skipped',
    })
    .select('id')
    .single()
  if (error) {
    console.error('scratch_card insert error:', error.message)
    return fail('Failed to save result', 'DB_ERROR', 500)
  }

  if (prize.label === '+2 Cards' && !IS_DEV) {
    await incrementBonusPool(supabase, user.id, 'bonus_spins', 2, prize.label)
  }

  const winId: number | undefined = inserted?.id
  if (!IS_DEV && isAssetPrize && winId && walletAddress && REWARD_SENDER_SECRET) {
    const payment = await sendPrizePayment(prize.label, prize.amount!, walletAddress, winId, supabase)
    if (payment.sent) {
      void notifyPrizeSent(user.id, prize.label, payment.txHash!)
      return ok({ prize: prize.label, amount: prize.amount, prizeIndex: index, winCode, autoSent: true, txHash: payment.txHash })
    }
    return ok({ prize: prize.label, amount: prize.amount, prizeIndex: index, winCode, autoSent: false, paymentError: payment.code, lobstrDeeplink: payment.lobstrDeeplink })
  }
  return ok({ prize: prize.label, amount: prize.amount, prizeIndex: index, winCode, autoSent: false })
}
