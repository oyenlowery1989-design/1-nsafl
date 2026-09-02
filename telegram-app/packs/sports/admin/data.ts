import { createServiceClient } from '@/lib/supabase-server'
import type { AdminDataContribution } from '@/packs/types'

type AdminClient = ReturnType<typeof createServiceClient>

export async function getSportsAdminData(supabase: AdminClient) {
  const [{ data: teamRequests }, { data: users }] = await Promise.all([
    supabase
      .from('team_change_requests')
      .select('id, telegram_id, requested_team, status, admin_note, created_at, resolved_at')
      .order('created_at', { ascending: false }),
    supabase.from('users').select('telegram_id, favorite_team'),
  ])

  return {
    teamRequests: teamRequests ?? [],
    teamsByTelegramId: new Map((users ?? []).map((user) => [user.telegram_id, user.favorite_team])),
  }
}

export async function getSportsAdminContribution(supabase: AdminClient): Promise<AdminDataContribution> {
  const sportsData = await getSportsAdminData(supabase)
  return {
    data: { teamRequests: sportsData.teamRequests },
    getUserFields: (user) => ({ favorite_team: sportsData.teamsByTelegramId.get(user.telegram_id) ?? null }),
  }
}
