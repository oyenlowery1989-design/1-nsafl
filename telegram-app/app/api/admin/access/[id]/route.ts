import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const { id } = await ctx.params
  if (!id) return fail('Missing id', 'INVALID_DATA')

  const supabase = createServiceClient()
  await supabase.from('access_attempts').delete().eq('id', id)

  return ok({ deleted: true, id })
}
