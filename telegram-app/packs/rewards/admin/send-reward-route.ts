import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { REWARD_ASSETS } from '@/lib/rewardAssets'
import { sendPrizePayment, REWARD_SENDER_SECRET, parseHorizonError, notifyPrizeSent } from '@/lib/stellar-payment'
import { Keypair } from 'stellar-sdk'
import { getPackCopy } from '@/config/app'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { requirePack } from '@/lib/feature-gate'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'
const REWARD_MEMO = (process.env.REWARD_MEMO ?? getPackCopy<string>('rewardMemo') ?? '').slice(0, 28)

/** GET — config diagnostic (admin only) */
export async function GET(req: NextRequest) {
  const disabled = requirePack('rewards')
  if (disabled) return disabled
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  let senderPublicKey = 'NOT_SET'
  try {
    if (REWARD_SENDER_SECRET) senderPublicKey = Keypair.fromSecret(REWARD_SENDER_SECRET).publicKey()
  } catch { senderPublicKey = 'INVALID_SECRET' }
  return ok({
    senderPublicKey,
    horizonUrl: HORIZON_URL,
    memo: REWARD_MEMO,
    rewardAssets: REWARD_ASSETS.map(a => ({
      code: a.code,
      issuerSet: !!a.issuer,
      issuerPrefix: a.issuer ? a.issuer.slice(0, 8) + '…' : 'MISSING',
    })),
  })
}

export async function POST(req: NextRequest) {
  const disabled = requirePack('rewards')
  if (disabled) return disabled
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  if (!REWARD_SENDER_SECRET) {
    return fail('REWARD_SENDER_SECRET not configured', 'CONFIG_ERROR', 500)
  }

  const body = await req.json().catch(() => null)
  const winId = body?.winId
  if (!winId) return fail('Missing winId', 'BAD_REQUEST')

  const supabase = createServiceClient()

  const { data: win } = await supabase
    .from('lucky_draw_wins')
    .select('id, telegram_id, prize, amount, wallet_address, payout_status')
    .eq('id', winId)
    .single()

  if (!win) return fail('Win not found', 'NOT_FOUND', 404)
  if (!win.wallet_address) return fail('No wallet address on this win', 'BAD_REQUEST')
  if (win.payout_status === 'paid' || win.payout_status === 'paying') return fail('Already paid or in flight', 'ALREADY_PAID', 409)
  if (!win.amount || win.amount <= 0) return fail('Invalid prize amount', 'BAD_REQUEST')

  // ── Tier 1 check — must hold ≥100 tokens to receive rewards ──────────────────
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', win.telegram_id)
    .single()

  if (userRow) {
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userRow.id)
      .eq('stellar_address', win.wallet_address)
      .single()

    if (walletRow) {
      const { data: balRow } = await supabase
        .from('wallet_balances')
        .select('primary_asset_balance')
        .eq('wallet_id', walletRow.id)
        .single()

      const nsaflBal = Number(balRow?.primary_asset_balance ?? 0)
      if (nsaflBal < 100) {
        return NextResponse.json(
          {
            success: false,
            error: `User holds ${nsaflBal} ${PRIMARY_CUSTOM_ASSET_LABEL} — Tier 1 requires 100. Only active holders can receive rewards.`,
            code: 'TIER_REQUIRED',
            nsaflBalance: nsaflBal,
            telegram_id: win.telegram_id,
          },
          { status: 402 },
        )
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const payment = await sendPrizePayment(win.prize, win.amount, win.wallet_address, win.id, supabase)

  if (payment.sent) {
    void notifyPrizeSent(win.telegram_id, win.prize, payment.txHash!)
    return ok({ txHash: payment.txHash, sent: true })
  }

  if (payment.code === 'NO_TRUST') {
    return NextResponse.json(
      { success: false, error: payment.error, code: 'NO_TRUST', lobstrDeeplink: payment.lobstrDeeplink, telegram_id: win.telegram_id },
      { status: 502 },
    )
  }

  return fail(payment.error ?? 'Payment failed', payment.code ?? 'HORIZON_ERROR', 502)
}

// Re-export for any callers that imported parseHorizonError from this module
export { parseHorizonError }
