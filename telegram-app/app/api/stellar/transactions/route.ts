import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidStellarAddress, HorizonPayment } from '@/lib/stellar'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req, 120)
  if (rateLimitError) return rateLimitError

  const { searchParams } = req.nextUrl
  const address = searchParams.get('address')
  const cursor = searchParams.get('cursor') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (!address || !isValidStellarAddress(address))
    return fail('Invalid address', 'INVALID_ADDRESS')

  try {
    const cursorParam = cursor ? `&cursor=${cursor}` : ''
    const res = await fetch(
      `${HORIZON_URL}/accounts/${address}/payments?order=desc&limit=${limit}${cursorParam}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    const records: HorizonPayment[] = data._embedded?.records ?? []
    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null

    return ok({ records, nextCursor, hasMore: records.length === limit })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error', 'STELLAR_ERROR', 500)
  }
}
