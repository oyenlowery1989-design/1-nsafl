import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const body = await req.json().catch(() => null)
  if (!body || !body.type || !body.id) return fail('Missing type or id', 'INVALID_DATA')

  const { type, id } = body as { type: 'donation' | 'purchase'; id: number }

  if (type !== 'donation' && type !== 'purchase') {
    return fail('type must be donation or purchase', 'INVALID_DATA')
  }

  const supabase = createServiceClient()

  if (type === 'donation') {
    const { error } = await (supabase as any)
      .from('donations')
      .update({ verified: true })
      .eq('id', id)
    if (error) return fail(error.message, 'DB_ERROR', 500)
  } else {
    const { error } = await (supabase as any)
      .from('purchases')
      .update({ verified: true })
      .eq('id', id)
    if (error) return fail(error.message, 'DB_ERROR', 500)
  }

  return ok({ verified: true, type, id })
}
