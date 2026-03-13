import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return fail('No body', 'BAD_REQUEST', 400)
  const supabase = createServiceClient()
  const { data, error } = await (supabase as any)
    .from('quiz_questions')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return fail('Failed to update', 'DB_ERROR', 500)
  return ok(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await (supabase as any).from('quiz_questions').delete().eq('id', id)
  if (error) return fail('Failed to delete', 'DB_ERROR', 500)
  return ok({ deleted: id })
}
