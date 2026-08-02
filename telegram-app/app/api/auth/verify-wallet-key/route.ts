/**
 * POST /api/auth/verify-wallet-key
 * Verifies that a derived Stellar public key belongs to the authenticated user's wallet in Supabase.
 * Called before the "Sign All Trustlines" transaction to confirm the key is correct.
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
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  let body: { publicKey?: unknown } = {}
  try { body = await req.json() } catch { /* fallthrough */ }

  if (typeof body.publicKey !== 'string' || !body.publicKey.trim()) {
    return fail('publicKey is required', 'BAD_REQUEST', 400)
  }

  // Dev mode or explicit trustline bypass — skip ownership check
  if (IS_DEV || TRUSTLINE_BYPASS) return ok({ valid: true })

  const supabase = createServiceClient()

  // Find wallet with this address
  const { data: wallet } = await supabase
    .from('wallets')
    .select('user_id')
    .eq('stellar_address', body.publicKey.trim())
    .single()

  if (!wallet) return ok({ valid: false, reason: 'Key does not match any registered wallet' })

  // Confirm it belongs to this Telegram user
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', user.id)
    .single()

  if (!userRow || wallet.user_id !== userRow.id) {
    return ok({ valid: false, reason: 'Key does not match your account' })
  }

  return ok({ valid: true })
}
