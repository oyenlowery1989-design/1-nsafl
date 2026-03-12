import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

// Proxy a signed XDR transaction to Horizon — the secret key never touches this server
export async function POST(req: NextRequest) {
  const rateLimitErr = checkRateLimit(req, 10)
  if (rateLimitErr) return rateLimitErr

  const body = await req.json() as { xdr?: string }
  if (!body.xdr || typeof body.xdr !== 'string') {
    return fail('Missing XDR', 'MISSING_XDR')
  }

  const params = new URLSearchParams({ tx: body.xdr })
  const res = await fetch(`${HORIZON_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const json = await res.json()

  if (!res.ok) {
    const detail = json?.extras?.result_codes ?? json?.detail ?? 'Transaction rejected'
    return fail(typeof detail === 'string' ? detail : JSON.stringify(detail), 'HORIZON_ERROR', 400)
  }

  return ok({ hash: json.hash })
}
