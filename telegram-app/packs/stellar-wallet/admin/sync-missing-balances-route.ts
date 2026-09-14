import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { fetchAllShownBalances } from '@/lib/stellar'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { requirePack } from '@/lib/feature-gate'

export async function POST(req: NextRequest) {
  const disabled = requirePack('stellar-wallet')
  if (disabled) return disabled
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()

  // Find wallets that have no wallet_balances row at all
  const { data: wallets } = await supabase
    .from('wallets')
    .select('id, stellar_address, wallet_balances(wallet_id)')

  if (!wallets?.length) return ok({ synced: 0, results: [] })

  const missing = wallets.filter((w) => !w.wallet_balances)
  if (!missing.length) return ok({ synced: 0, results: [] })

  // Fetch balances from Horizon in parallel (cap at 8 concurrent)
  const CONCURRENCY = 8
  const results: { wallet_id: string; primary_asset_balance: number; xlm_balance: number }[] = []

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(async (w) => {
        const assets = await fetchAllShownBalances(w.stellar_address)
        const nsafl = parseFloat(assets[PRIMARY_CUSTOM_ASSET_CODE] ?? '0')
        const xlm = parseFloat(assets['XLM'] ?? '0')
        return { wallet_id: w.id, primary_asset_balance: nsafl, xlm_balance: xlm }
      })
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }

  if (results.length) {
    await supabase.from('wallet_balances').upsert(
      results.map(r => ({ ...r, last_synced_at: new Date().toISOString() })),
      { onConflict: 'wallet_id' }
    )
  }

  return ok({ synced: results.length, results })
}
