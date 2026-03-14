import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { fetchAllShownBalances } from '@/lib/stellar'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

type Ctx = { params: Promise<{ telegramId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const { telegramId: rawId } = await ctx.params
  const telegramId = parseInt(rawId, 10)
  if (isNaN(telegramId)) return fail('Invalid telegram_id', 'INVALID_DATA')

  const supabase = createServiceClient()

  // Get primary wallet address
  const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single()
  if (!user) return fail('User not found', 'NOT_FOUND', 404)

  const { data: wallet } = await supabase
    .from('wallets').select('id, stellar_address')
    .eq('user_id', user.id).eq('is_primary', true).maybeSingle()

  if (!wallet) return fail('No primary wallet', 'NOT_FOUND', 404)

  // Fetch live balance from Horizon
  const assets = await fetchAllShownBalances(wallet.stellar_address)
  const nsafl = parseFloat(assets[PRIMARY_CUSTOM_ASSET_CODE] ?? '0')
  const xlm = parseFloat(assets['XLM'] ?? '0')

  await supabase.from('wallet_balances').upsert(
    { wallet_id: wallet.id, nsafl_balance: nsafl, xlm_balance: xlm, last_synced_at: new Date().toISOString() },
    { onConflict: 'wallet_id' }
  )

  return ok({ telegramId, nsafl_balance: nsafl, xlm_balance: xlm })
}
