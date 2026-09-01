import { createServiceClient } from '@/lib/supabase-server'

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
