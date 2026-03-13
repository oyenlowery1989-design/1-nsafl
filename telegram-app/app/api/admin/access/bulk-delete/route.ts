import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const body = await req.json().catch(() => null)
  if (!body || typeof body.olderThanDays !== 'number' || body.olderThanDays < 1) {
    return fail('olderThanDays must be a positive number', 'INVALID_DATA')
  }

  const { olderThanDays } = body as { olderThanDays: number }

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('access_attempts')
    .delete()
    .lt('created_at', cutoff)
    .select('id')

  if (error) return fail(error.message, 'DB_ERROR', 500)

  return ok({ deleted: data?.length ?? 0, cutoff })
}
