import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { prizeToAsset } from '@/lib/rewardAssets'
import {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
  Memo,
  BASE_FEE,
  Horizon,
} from 'stellar-sdk'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'
const REWARD_SENDER_SECRET = process.env.REWARD_SENDER_SECRET ?? ''
const REWARD_MEMO = (process.env.REWARD_MEMO ?? 'NSAFL Lucky Draw Prize').slice(0, 28)

interface HorizonErrorResult {
  message: string
  code: string
}

/** Map Horizon result codes to human-readable errors */
function parseHorizonError(err: unknown): HorizonErrorResult {
  try {
    const e = err as { response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } } }
    const ops = e?.response?.data?.extras?.result_codes?.operations ?? []
    if (ops.includes('op_no_trust')) return { message: 'Recipient has no trustline for this asset.', code: 'NO_TRUST' }
    if (ops.includes('op_underfunded')) return { message: 'Sender wallet has insufficient balance for this asset.', code: 'UNDERFUNDED' }
    if (ops.includes('op_no_destination')) return { message: 'Recipient Stellar account does not exist.', code: 'NO_DESTINATION' }
    if (ops.includes('op_line_full')) return { message: 'Recipient trustline is at maximum limit.', code: 'LINE_FULL' }
    const txCode = e?.response?.data?.extras?.result_codes?.transaction
    if (txCode === 'tx_bad_auth') return { message: 'Invalid sender secret key — check REWARD_SENDER_SECRET.', code: 'BAD_AUTH' }
    if (txCode === 'tx_insufficient_fee') return { message: 'Transaction fee too low.', code: 'INSUFFICIENT_FEE' }
  } catch { /* ignore parse errors */ }
  return { message: err instanceof Error ? err.message : 'Unknown Horizon error', code: 'HORIZON_ERROR' }
}

/** GET — config diagnostic (admin only) */
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  let senderPublicKey = 'NOT_SET'
  try {
    if (REWARD_SENDER_SECRET) senderPublicKey = Keypair.fromSecret(REWARD_SENDER_SECRET).publicKey()
  } catch { senderPublicKey = 'INVALID_SECRET' }
  return ok({
    senderPublicKey,
    horizonUrl: HORIZON_URL,
    memo: REWARD_MEMO,
    rewardAssets: (await import('@/lib/rewardAssets')).REWARD_ASSETS.map(a => ({
      code: a.code,
      issuerSet: !!a.issuer,
      issuerPrefix: a.issuer ? a.issuer.slice(0, 8) + '…' : 'MISSING',
    })),
  })
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  if (!REWARD_SENDER_SECRET || REWARD_SENDER_SECRET === 'REPLACE_WITH_SENDER_SECRET_KEY') {
    return fail('REWARD_SENDER_SECRET not configured', 'CONFIG_ERROR', 500)
  }

  const body = await req.json().catch(() => null)
  const winId = body?.winId
  if (!winId) return fail('Missing winId', 'BAD_REQUEST')

  const supabase = createServiceClient()

  // Load win row
  const { data: win } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('id, telegram_id, prize, amount, wallet_address, payout_status')
    .eq('id', winId)
    .single()

  if (!win) return fail('Win not found', 'NOT_FOUND', 404)
  if (!win.wallet_address) return fail('No wallet address on this win', 'BAD_REQUEST')
  if (win.payout_status === 'paid') return fail('Already paid', 'ALREADY_PAID', 409)

  // Resolve asset from prize label
  const asset = prizeToAsset(win.prize)
  if (!asset) return fail(`Prize "${win.prize}" is not a sendable asset`, 'NOT_SENDABLE')
  if (!asset.issuer) return fail(`Issuer not configured for ${asset.code}`, 'CONFIG_ERROR', 500)

  // Safety: never send native XLM — only custom Stellar assets with an explicit issuer
  if (asset.code === 'XLM' || asset.code.toLowerCase() === 'xlm') {
    return fail('Native XLM payments are blocked — use wXLM (wrapped) instead', 'BLOCKED_NATIVE')
  }

  const amount = win.amount
  if (!amount || amount <= 0) return fail('Invalid prize amount', 'BAD_REQUEST')

  try {
    const senderKeypair = Keypair.fromSecret(REWARD_SENDER_SECRET)
    const server = new Horizon.Server(HORIZON_URL)

    const senderAccount = await server.loadAccount(senderKeypair.publicKey())

    const stellarAsset = new Asset(asset.code, asset.issuer)

    const tx = new TransactionBuilder(senderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        Operation.payment({
          destination: win.wallet_address,
          asset: stellarAsset,
          amount: String(amount),
        }),
      )
      .addMemo(Memo.text(REWARD_MEMO))
      .setTimeout(180)
      .build()

    tx.sign(senderKeypair)

    const result = await server.submitTransaction(tx)
    const txHash = result.hash

    // Update DB row
    await (supabase as any)
      .from('lucky_draw_wins')
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
        payout_status: 'paid',
        payout_tx_hash: txHash,
        payout_at: new Date().toISOString(),
        payout_notes: `Auto-sent via admin. Memo: ${REWARD_MEMO}`,
      })
      .eq('id', winId)

    return ok({ txHash, sent: true })
  } catch (err) {
    const { message, code } = parseHorizonError(err)
    const horizonExtras = (err as any)?.response?.data?.extras ?? null
    console.error('send-reward error:', code, message, JSON.stringify(horizonExtras ?? err))
    if (code === 'NO_TRUST') {
      return NextResponse.json(
        { success: false, error: message, code: 'NO_TRUST', lobstrDeeplink: asset.lobstrDeeplink, telegram_id: win.telegram_id },
        { status: 502 },
      )
    }
    return fail(message, code, 502)
  }
}
