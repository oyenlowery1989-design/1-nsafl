import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()
  const { data: claims, error } = await supabase
    .from('tier_reward_claims')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return fail('Failed to fetch claims', 'DB_ERROR', 500)

  const telegramIds = [...new Set((claims ?? []).map((c) => c.telegram_id))]
  const userMap: Record<number, { first_name: string | null; username: string | null }> = {}
  if (telegramIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('telegram_id, telegram_first_name, telegram_username')
      .in('telegram_id', telegramIds)
    for (const u of users ?? []) {
      userMap[u.telegram_id] = { first_name: u.telegram_first_name ?? null, username: u.telegram_username ?? null }
    }
  }

  return ok({
    claims: (claims ?? []).map((c) => ({
      ...c,
      user_first_name: userMap[c.telegram_id]?.first_name ?? null,
      user_username: userMap[c.telegram_id]?.username ?? null,
    })),
  })
}
