import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { requirePack } from '@/lib/feature-gate'

export async function POST(req: NextRequest) {
  const disabled = requirePack('donations')
  if (disabled) return disabled
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const body = await req.json().catch(() => null)
  if (!body?.id) return fail('Missing donation id', 'INVALID_DATA')

  const { error } = await createServiceClient().from('donations').update({ verified: true }).eq('id', body.id)
  if (error) return fail(error.message, 'DB_ERROR', 500)
  return ok({ verified: true, type: 'donation', id: body.id })
}
