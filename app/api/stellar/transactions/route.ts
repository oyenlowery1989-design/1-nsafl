import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { isValidStellarAddress } from '@/lib/stellar'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address || !isValidStellarAddress(address))
    return fail('Invalid address', 'INVALID_ADDRESS')
  try {
    const res = await fetch(
      `${HORIZON_URL}/accounts/${address}/payments?order=desc&limit=10`
    )
    const data = await res.json()
    return ok({ records: data._embedded?.records ?? [] })
  } catch (e: any) {
    return fail(e.message, 'STELLAR_ERROR', 500)
  }
}
