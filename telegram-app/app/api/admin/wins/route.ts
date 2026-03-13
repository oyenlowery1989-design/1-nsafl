import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()
  const { searchParams } = req.nextUrl

  const status = searchParams.get('status') ?? 'all'
  const prize  = searchParams.get('prize') ?? null
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('lucky_draw_wins')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status !== 'all') {
    query = query.eq('payout_status', status)
  }

  if (prize) {
    query = query.eq('prize', prize)
  }

  const { data: wins, count, error } = await query

  if (error) return fail('Failed to fetch wins', 'DB_ERROR', 500)

  const total = count ?? 0
  const pages = Math.ceil(total / limit)

  return ok({ wins: wins ?? [], total, page, pages })
}
