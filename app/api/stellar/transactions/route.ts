import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidStellarAddress } from '@/lib/stellar'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

// Spam thresholds
const SPAM_AMOUNT_THRESHOLD = 0.01 // anything below this XLM amount is likely spam

interface HorizonPayment {
  id: string
  paging_token: string
  type: string
  created_at: string
  to?: string
  from?: string
  amount?: string
  asset_code?: string
  asset_type?: string
  asset_issuer?: string
}

function isSpam(record: HorizonPayment, shownAssetCodes: string[]): boolean {
  const code = record.asset_type === 'native' ? 'XLM' : (record.asset_code ?? '')
  // Unknown / disallowed asset
  if (!shownAssetCodes.includes(code)) return true
  // Dust amount on any asset (< 0.01)
  if (parseFloat(record.amount ?? '0') < SPAM_AMOUNT_THRESHOLD) return true
  return false
}

export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { searchParams } = req.nextUrl
  const address = searchParams.get('address')
  const cursor = searchParams.get('cursor') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)

  if (!address || !isValidStellarAddress(address))
    return fail('Invalid address', 'INVALID_ADDRESS')

  const shownRaw = process.env.NEXT_PUBLIC_SHOWN_ASSETS ?? 'XLM'
  const shownAssetCodes = shownRaw.split(',').map((e) => e.split(':')[0].trim())

  try {
    const cursorParam = cursor ? `&cursor=${cursor}` : ''
    const res = await fetch(
      `${HORIZON_URL}/accounts/${address}/payments?order=desc&limit=${limit}${cursorParam}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    const records: HorizonPayment[] = data._embedded?.records ?? []
    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null

    return ok({
      records,
      nextCursor,
      hasMore: records.length === limit,
      spamCodes: shownAssetCodes, // pass back so client knows what's shown
    })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error', 'STELLAR_ERROR', 500)
  }
}
