import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { isValidStellarAddress } from '@/lib/stellar'

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

const DIRECT_BUY_ADDRESS =
  process.env.NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS ??
  'GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z'

const XLM_TO_TOKEN_RATE = parseInt(process.env.NEXT_PUBLIC_XLM_TO_TOKEN_RATE ?? '1', 10)

export async function POST(request: NextRequest) {
  const rateLimitError = checkRateLimit(request, 10)
  if (rateLimitError) return rateLimitError

  try {
    const body = await request.json()
    const { stellarAddress, xlmAmount, txHash } = body as {
      stellarAddress?: string
      xlmAmount?: number
      txHash?: string
    }

    if (!stellarAddress || !isValidStellarAddress(stellarAddress)) {
      return fail('Invalid Stellar address', 'INVALID_ADDRESS')
    }
    if (!xlmAmount || xlmAmount <= 0) {
      return fail('Invalid XLM amount', 'INVALID_AMOUNT')
    }
    if (!txHash || txHash.trim().length === 0) {
      return fail('Transaction hash is required', 'MISSING_TX_HASH')
    }

    // Verify tx on Stellar Horizon
    let verified = false
    try {
      const txRes = await fetch(`${HORIZON_URL}/transactions/${txHash.trim()}`)
      if (txRes.ok) {
        // Fetch operations for this transaction to verify payment details
        const opsRes = await fetch(`${HORIZON_URL}/transactions/${txHash.trim()}/operations`)
        if (opsRes.ok) {
          const opsData = await opsRes.json()
          interface HorizonOperation {
            type: string
            to?: string
            asset_type?: string
            amount?: string
          }
          const records = (opsData._embedded?.records ?? []) as HorizonOperation[]
          // Check if any payment op goes to our direct buy address with native XLM
          verified = records.some(
            (op: HorizonOperation) =>
              op.type === 'payment' &&
              op.to === DIRECT_BUY_ADDRESS &&
              op.asset_type === 'native'
          )
        }
      }
    } catch {
      // Verification failed — record anyway as unverified
    }

    const tokenAmount = xlmAmount * XLM_TO_TOKEN_RATE

    // Look up wallet_id
    const supabase = createServiceClient()
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('stellar_address', stellarAddress)
      .maybeSingle()

    const walletId = wallet?.id ?? null

    // Record purchase
    const { error: insertError } = await supabase
      .from('purchases')
      .insert({
        wallet_id: walletId,
        xlm_amount: xlmAmount,
        token_amount: tokenAmount,
        stellar_tx_hash: txHash.trim(),
        purchase_type: 'direct',
        verified,
      })

    if (insertError) {
      return fail('Failed to record purchase', 'DB_ERROR')
    }

    return ok({ verified, tokenAmount })
  } catch {
    return fail('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
