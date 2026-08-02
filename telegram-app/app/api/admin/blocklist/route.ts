import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('blocked_ips')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return fail('DB error', 'DB_ERROR', 500)
  return ok({ blockedIps: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const { ip, reason } = await req.json().catch(() => ({}))
  if (!ip || typeof ip !== 'string') return fail('ip required', 'INVALID', 400)
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('blocked_ips')
    .upsert({ ip: ip.trim(), reason: reason ?? null }, { onConflict: 'ip' })
  if (error) return fail('DB error', 'DB_ERROR', 500)
  return ok({ blocked: true })
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const { ip } = await req.json().catch(() => ({}))
  if (!ip) return fail('ip required', 'INVALID', 400)
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('blocked_ips')
    .delete()
    .eq('ip', ip)
  if (error) return fail('DB error', 'DB_ERROR', 500)
  return ok({ unblocked: true })
}
