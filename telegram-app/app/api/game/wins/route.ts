import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok } from '@/lib/api-response'

export async function GET(_req: NextRequest) {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('telegram_id, prize, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return ok(data ?? [])
}
