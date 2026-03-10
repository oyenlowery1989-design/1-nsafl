import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { fetchAllShownBalances, hasPrimaryAssetTrustline, isValidStellarAddress } from '@/lib/stellar'
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const address = req.nextUrl.searchParams.get('address')
  if (!address) return fail('Missing address', 'MISSING_ADDRESS')
  if (!isValidStellarAddress(address)) return fail('Invalid Stellar address', 'INVALID_ADDRESS')
  try {
    const [assets, trustlineOk] = await Promise.all([
      fetchAllShownBalances(address),
      hasPrimaryAssetTrustline(address),
    ])

    if (!trustlineOk) {
      return fail(
        `Wallet has no ${PRIMARY_CUSTOM_ASSET_LABEL} trustline`,
        'NO_TRUSTLINE',
        400
      )
    }

    // Fire-and-forget: sync balance to Supabase for stats
    syncBalance(address, assets).catch(() => null)

    return ok({
      address,
      assets,
      token: assets[PRIMARY_CUSTOM_ASSET_CODE] ?? '0.00',
      xlm: assets['XLM'] ?? '0.00',
    })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error', 'STELLAR_ERROR', 500)
  }
}

async function syncBalance(address: string, assets: Record<string, string>) {
  const supabase = createServiceClient()
  const tokenBal = parseFloat(assets[PRIMARY_CUSTOM_ASSET_CODE] ?? '0')
  const xlmBal = parseFloat(assets['XLM'] ?? '0')

  // Find wallet by stellar_address
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('stellar_address', address)
    .maybeSingle()

  if (!wallet) return

  await supabase
    .from('wallet_balances')
    .upsert(
      {
        wallet_id: wallet.id,
        nsafl_balance: tokenBal,
        xlm_balance: xlmBal,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'wallet_id' }
    )
}
