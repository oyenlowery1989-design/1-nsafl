import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { sendTierClaimPayment, REWARD_SENDER_SECRET } from '@/lib/stellar-payment'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  if (!REWARD_SENDER_SECRET) return fail('REWARD_SENDER_SECRET not configured', 'CONFIG_ERROR', 500)

  const body = await req.json().catch(() => null)
  const claimId = body?.claimId
  if (!claimId) return fail('Missing claimId', 'BAD_REQUEST')

  const supabase = createServiceClient()

  const { data: claim } = await supabase
    .from('tier_reward_claims')
    .select('id, telegram_id, gold_amount, silver_amount, copper_amount, payout_status')
    .eq('id', claimId)
    .single()

  if (!claim) return fail('Claim not found', 'NOT_FOUND', 404)
  if (claim.payout_status === 'paid' || claim.payout_status === 'paying') {
    return fail('Already paid or in flight', 'ALREADY_PAID', 409)
  }

  const { data: userRow } = await supabase.from('users').select('id').eq('telegram_id', claim.telegram_id).single()
  if (!userRow) return fail('User not found', 'NOT_FOUND', 404)

  const { data: walletRow } = await supabase
    .from('wallets').select('stellar_address').eq('user_id', userRow.id).eq('is_primary', true).single()
  if (!walletRow) return fail('Wallet not found', 'NOT_FOUND', 404)

  const payment = await sendTierClaimPayment(claim, walletRow.stellar_address, supabase)

  if (payment.sent) return ok({ sent: true, txHash: payment.txHash })
  if (payment.code === 'NO_TRUST') {
    return fail(payment.error ?? 'Missing trustline', 'NO_TRUST', 502)
  }
  return fail(payment.error ?? 'Payment failed', payment.code ?? 'HORIZON_ERROR', 502)
}
