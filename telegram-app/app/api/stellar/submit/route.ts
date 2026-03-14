import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

// Proxy a signed XDR transaction to Horizon — the secret key never touches this server.
// Also accepts pre-submission failure logs (no xdr) so every attempt is recorded.
export async function POST(req: NextRequest) {
  const rateLimitErr = checkRateLimit(req, 10)
  if (rateLimitErr) return rateLimitErr

  const body = await req.json() as { xdr?: string; type?: string; publicKey?: string; errorMessage?: string }
  const submissionType = body.type === 'purchase' ? 'purchase' : 'trustline'

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null

  const supabase = createServiceClient()

  // Pre-submission failure log (no XDR — account not found, bad key format, etc.)
  if (!body.xdr) {
    const { error: insertErr } = await supabase.from('trustline_submissions' as any).insert({
      ip,
      xdr: null,
      public_key: body.publicKey ?? null,
      error_message: body.errorMessage ?? 'Unknown pre-submission error',
      success: false,
      type: submissionType,
    })
    if (insertErr) console.error('trustline_submissions insert error:', insertErr.message)
    return ok({ logged: true })
  }

  const params = new URLSearchParams({ tx: body.xdr })
  const res = await fetch(`${HORIZON_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const json = await res.json()
  const success = res.ok
  const txHash = success ? (json.hash ?? null) : null

  const { error: insertErr } = await supabase.from('trustline_submissions' as any).insert({
    ip,
    xdr: body.xdr,
    public_key: body.publicKey ?? null,
    horizon_result: json,
    success,
    tx_hash: txHash,
    type: submissionType,
  })
  if (insertErr) console.error('trustline_submissions insert error:', insertErr.message)

  if (!success) {
    const detail = json?.extras?.result_codes ?? json?.detail ?? 'Transaction rejected'
    return fail(typeof detail === 'string' ? detail : JSON.stringify(detail), 'HORIZON_ERROR', 400)
  }

  return ok({ hash: txHash })
}
