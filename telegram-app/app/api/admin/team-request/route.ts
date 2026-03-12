import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

// POST — approve or reject a team change request
export async function POST(req: NextRequest) {
  const rateLimitErr = checkRateLimit(req, 30)
  if (rateLimitErr) return rateLimitErr

  if (!verifyAdminToken(req)) {
    return fail('Forbidden', 'FORBIDDEN', 403)
  }

  const body = await req.json() as {
    requestId: string
    action: 'approve' | 'reject'
    adminNote?: string
  }

  const { requestId, action, adminNote } = body
  if (!requestId || !['approve', 'reject'].includes(action)) {
    return fail('Invalid request', 'INVALID_DATA')
  }

  const supabase = createServiceClient()

  // Fetch the request
  const { data: request } = await supabase
    .from('team_change_requests')
    .select('id, telegram_id, requested_team, status')
    .eq('id', requestId)
    .single()

  if (!request) return fail('Request not found', 'NOT_FOUND', 404)
  if (request.status !== 'pending') return fail('Request already resolved', 'ALREADY_RESOLVED')

  // Update request status
  await supabase
    .from('team_change_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      admin_note: adminNote ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  // If approved — update the user's team
  if (action === 'approve') {
    await supabase
      .from('users')
      .update({ favorite_team: request.requested_team })
      .eq('telegram_id', request.telegram_id)
  }

  return ok({ resolved: true, action, requestId })
}
