/**
 * Shared utility for sending Lucky Draw prize payments on Stellar.
 * Used by:
 *   - /api/game/win (auto-send immediately on win)
 *   - /api/admin/send-reward (manual retry from admin panel)
 */

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
import { prizeToAsset } from '@/lib/rewardAssets'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'
const REWARD_MEMO = (process.env.REWARD_MEMO ?? 'NSAFL Lucky Draw Prize').slice(0, 28)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''

/** Send a Telegram message to a user via the bot. Fire-and-forget — never throws. */
export async function notifyPrizeSent(telegramId: number, prize: string, txHash: string): Promise<void> {
  if (!BOT_TOKEN || !telegramId) return
  const explorerUrl = `https://stellar.expert/explorer/public/tx/${txHash}`
  const message =
    `🎉 <b>Your NSAFL Lucky Draw prize has been sent!</b>\n\n` +
    `Prize: <b>${prize}</b>\n` +
    `Transaction: <a href="${explorerUrl}">View on Explorer</a>\n\n` +
    `The tokens are on their way to your Stellar wallet. 🏉`
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
  } catch { /* ignore — payment already sent */ }
}

export const REWARD_SENDER_SECRET = process.env.REWARD_SENDER_SECRET ?? ''

export interface PaymentResult {
  sent: boolean
  txHash?: string
  error?: string
  code?: string
  /** Lobstr deeplink to add the missing trustline — set when code === 'NO_TRUST' */
  lobstrDeeplink?: string
}

/** Parse Horizon result codes into human-readable errors */
export function parseHorizonError(err: unknown): { message: string; code: string } {
  try {
    const e = err as { response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } } }
    const ops = e?.response?.data?.extras?.result_codes?.operations ?? []
    if (ops.includes('op_no_trust'))      return { message: 'Recipient has no trustline for this asset.', code: 'NO_TRUST' }
    if (ops.includes('op_underfunded'))   return { message: 'Sender wallet has insufficient balance.', code: 'UNDERFUNDED' }
    if (ops.includes('op_no_destination'))return { message: 'Recipient Stellar account does not exist.', code: 'NO_DESTINATION' }
    if (ops.includes('op_line_full'))     return { message: 'Recipient trustline is at maximum limit.', code: 'LINE_FULL' }
    const txCode = e?.response?.data?.extras?.result_codes?.transaction
    if (txCode === 'tx_bad_auth')         return { message: 'Invalid REWARD_SENDER_SECRET.', code: 'BAD_AUTH' }
    if (txCode === 'tx_insufficient_fee') return { message: 'Transaction fee too low.', code: 'INSUFFICIENT_FEE' }
  } catch { /* ignore parse errors */ }
  return { message: err instanceof Error ? err.message : 'Unknown Horizon error', code: 'HORIZON_ERROR' }
}

/**
 * Attempt to send a prize payment on Stellar and mark the win row as paid.
 *
 * @param prize         Prize label from lucky_draw_wins.prize (e.g. "100 wXLM")
 * @param amount        Numeric amount to send
 * @param destination   Recipient's Stellar public key
 * @param winId         lucky_draw_wins.id — updated to payout_status='paid' on success
 * @param supabase      Service-role Supabase client
 */
export async function sendPrizePayment(
  prize: string,
  amount: number,
  destination: string,
  winId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<PaymentResult> {
  if (!REWARD_SENDER_SECRET) {
    return { sent: false, error: 'REWARD_SENDER_SECRET not configured', code: 'CONFIG_ERROR' }
  }

  const asset = prizeToAsset(prize)
  if (!asset) return { sent: false, error: `"${prize}" is not a sendable asset`, code: 'NOT_SENDABLE' }
  if (!asset.issuer) return { sent: false, error: `Issuer not configured for ${asset.code}`, code: 'CONFIG_ERROR' }

  try {
    // Idempotency: claim the row first. If a previous attempt already claimed or paid
    // this win (crash between submit and update, admin double-click), refuse to re-send.
    const { data: claimed } = await supabase
      .from('lucky_draw_wins')
      .update({ payout_status: 'paying' })
      .eq('id', winId)
      .eq('payout_status', 'pending')
      .select('id')
    if (!claimed?.length) {
      return { sent: false, error: 'Win is not pending (already paid or in flight)', code: 'ALREADY_PAID' }
    }

    const senderKeypair = Keypair.fromSecret(REWARD_SENDER_SECRET)
    const server = new Horizon.Server(HORIZON_URL)
    const senderAccount = await server.loadAccount(senderKeypair.publicKey())
    const stellarAsset = new Asset(asset.code, asset.issuer)

    const tx = new TransactionBuilder(senderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(Operation.payment({
        destination,
        asset: stellarAsset,
        amount: String(amount),
      }))
      .addMemo(Memo.text(REWARD_MEMO))
      .setTimeout(180)
      .build()

    tx.sign(senderKeypair)
    const result = await server.submitTransaction(tx)

    // Mark win as paid
    await supabase.from('lucky_draw_wins').update({
      claimed: true,
      claimed_at: new Date().toISOString(),
      payout_status: 'paid',
      payout_tx_hash: result.hash,
      payout_at: new Date().toISOString(),
      payout_notes: `Auto-sent. Memo: ${REWARD_MEMO}`,
    }).eq('id', winId)

    return { sent: true, txHash: result.hash }
  } catch (err) {
    const { message, code } = parseHorizonError(err)
    console.error(`sendPrizePayment error [${code}]:`, message)

    // Release the claim so admin can retry
    await supabase.from('lucky_draw_wins')
      .update({ payout_status: 'pending', payout_notes: `Auto-send failed: ${code} ${message}`.slice(0, 200) })
      .eq('id', winId).eq('payout_status', 'paying')

    const asset2 = prizeToAsset(prize)
    return {
      sent: false,
      error: message,
      code,
      lobstrDeeplink: code === 'NO_TRUST' ? asset2?.lobstrDeeplink : undefined,
    }
  }
}
