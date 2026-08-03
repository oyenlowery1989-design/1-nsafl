import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

function getUser(req: NextRequest): TelegramUser | null {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const realUser = initData ? validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!) : null
  if (realUser) return realUser
  if (isDev) return { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  return null
}

// GET — caller's own primary wallet + live balance (replaces direct browser table access)
export async function GET(req: NextRequest) {
  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const rateLimitError = checkRateLimit(req, 30, `wallet-live:${telegramUser.id}`)
  if (rateLimitError) return rateLimitError

  const supabase = createServiceClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle()

  if (!userRow) return fail('User not found', 'NOT_FOUND', 404)

  const { data: walletRow } = await supabase
    .from('wallets')
    .select('id, stellar_address')
    .eq('user_id', (userRow as { id: string }).id)
    .eq('is_primary', true)
    .maybeSingle()

  if (!walletRow) return fail('Wallet not found', 'NOT_FOUND', 404)

  const { id: walletId, stellar_address: stellarAddress } = walletRow as { id: string; stellar_address: string }

  const { data: balanceRow } = await supabase
    .from('wallet_balances')
    .select('primary_asset_balance, xlm_balance, last_synced_at')
    .eq('wallet_id', walletId)
    .maybeSingle()

  const b = balanceRow as { primary_asset_balance: number; xlm_balance: number; last_synced_at: string } | null

  return ok({
    walletId,
    stellarAddress,
    tokenBalance: b?.primary_asset_balance != null ? String(b.primary_asset_balance) : '0.00',
    xlmBalance: b?.xlm_balance != null ? String(b.xlm_balance) : '0.00',
    lastSyncedAt: b?.last_synced_at ?? null,
  })
}
