import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { prizeToAsset } from '@/lib/rewardAssets'
import { sendPrizePayment, REWARD_SENDER_SECRET, notifyPrizeSent } from '@/lib/stellar-payment'
import { checkRateLimit } from '@/lib/rate-limit'
import { rollPrize, getSpinStatus, consumeSpin } from '@/lib/gamePool'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  if (IS_DEV) return ok({ spinsUsed: 0, dailyLimit: 99, spinsRemaining: 99, canSpin: true, bonusSpins: 0 })

  const supabase = createServiceClient()
  const status = await getSpinStatus(supabase, user.id, 'lucky_draw')

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

  const limited = checkRateLimit(req, 10, `game:lucky_draw:${user.id}`)
  if (limited) return limited

  const supabase = createServiceClient()
  const { prize, index } = rollPrize('lucky_draw')

  // Non-consuming outcome: Free Spin — nothing recorded, nothing consumed
  if (prize.label === 'Free Spin') {
    return ok({ prize: prize.label, amount: null, prizeIndex: index, winCode: null, freeSpin: true, autoSent: false })
  }

  let walletAddress: string | null = null
  if (!IS_DEV) {
    const status = await getSpinStatus(supabase, user.id, 'lucky_draw')
    if (!status.canSpin) return fail('No spins remaining', 'DAILY_LIMIT', 429)
    const consumed = await consumeSpin(supabase, user.id, 'lucky_draw')
    if (!consumed.ok) return fail('No spins remaining', 'DAILY_LIMIT', 429)
    walletAddress = status.walletAddress
  }

  const winCode = `SPIN-${randomBytes(9).toString('base64url').toUpperCase()}`
  const { data: inserted, error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: prize.label,
      amount: prize.amount,
      win_code: winCode,
      wallet_address: walletAddress,
      claimed: false,
      prize_source: 'lucky_draw',
      payout_status: 'pending',
    })
    .select('id')
    .single()
  if (error) {
    console.error('lucky_draw_wins insert error:', error.message)
    return fail('Failed to save win', 'DB_ERROR', 500)
  }

  if (prize.label === '+2 Spins' && !IS_DEV) {
    const { data: userRow } = await (supabase as any)
      .from('users').select('bonus_spins').eq('telegram_id', user.id).single()
    await (supabase as any)
      .from('users')
      .update({ bonus_spins: (userRow?.bonus_spins ?? 0) + 2 })
      .eq('telegram_id', user.id)
      .eq('bonus_spins', userRow?.bonus_spins ?? 0)
  }

  const winId: number | undefined = inserted?.id
  const isAssetPrize = !!prizeToAsset(prize.label)
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
