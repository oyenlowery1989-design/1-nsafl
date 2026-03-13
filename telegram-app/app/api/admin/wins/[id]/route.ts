import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const { id } = await params

  if (!id || isNaN(Number(id))) {
    return fail('Invalid id', 'INVALID_ID', 400)
  }

  let body: { status?: string; notes?: string; tx_hash?: string }
  try {
    body = await req.json()
  } catch {
    return fail('Invalid JSON body', 'BAD_REQUEST', 400)
  }

  const { status, notes, tx_hash } = body

  if (!status || !['paid', 'skipped'].includes(status)) {
    return fail('status must be "paid" or "skipped"', 'INVALID_STATUS', 400)
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('id, payout_status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return fail('Win not found', 'NOT_FOUND', 404)

  if (existing.payout_status === 'paid') {
    return fail('Win already marked as paid', 'ALREADY_PAID', 409)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('lucky_draw_wins')
    .update({
      payout_status:  status,
      payout_at:      new Date().toISOString(),
      payout_notes:   notes ?? null,
      payout_tx_hash: tx_hash ?? null,
      paid_by:        'admin',
    })
    .eq('id', id)

  if (updateError) return fail('Failed to update win', 'DB_ERROR', 500)

  return ok({ updated: true, id: Number(id), status })
}
