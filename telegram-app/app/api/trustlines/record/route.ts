/**
 * POST /api/trustlines/record
 * Saves a trustline submission record to the DB.
 * In normal mode: called after a successful on-chain transaction.
 * In TRUSTLINE_BYPASS mode: saves a test record without a real tx.
 */
import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
const TRUSTLINE_BYPASS = process.env.TRUSTLINE_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  if (!IS_DEV && !validateTelegramInitData(initData, BOT_TOKEN)) {
    return fail('Unauthorized', 'UNAUTHORIZED', 401)
  }

  let body: { txHash?: string; xdr?: string; publicKey?: string; assetCodes?: string[] } = {}
  try { body = await req.json() } catch { /* fallthrough */ }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const supabase = createServiceClient()

  const isBypass = IS_DEV || TRUSTLINE_BYPASS
  const publicKey = body.publicKey ?? null
  const xdr = body.xdr ?? (isBypass ? `BYPASS_TEST | wallet: ${publicKey ?? 'unknown'}` : null)
  const txHash = body.txHash ?? (isBypass ? `bypass-${Date.now()}` : null)

  if (!xdr) return fail('xdr is required', 'BAD_REQUEST', 400)

  await (supabase as any)
    .from('trustline_submissions')
    .insert({
      type: 'trustline',
      ip,
      success: true,
      tx_hash: txHash,
      xdr,
    })

  return ok({ recorded: true, bypass: isBypass })
}
