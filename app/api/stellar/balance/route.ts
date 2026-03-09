import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { fetchCustomAssetBalance, fetchXlmBalance, isValidStellarAddress } from '@/lib/stellar'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return fail('Missing address', 'MISSING_ADDRESS')
  if (!isValidStellarAddress(address)) return fail('Invalid Stellar address', 'INVALID_ADDRESS')
  try {
    const [nsafl, xlm] = await Promise.all([
      fetchCustomAssetBalance(address),
      fetchXlmBalance(address),
    ])
    return ok({ nsafl, xlm, address })
  } catch (e: any) {
    return fail(e.message, 'STELLAR_ERROR', 500)
  }
}
