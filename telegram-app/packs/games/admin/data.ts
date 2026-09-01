import { createServiceClient } from '@/lib/supabase-server'

type AdminClient = ReturnType<typeof createServiceClient>

export async function getGamesAdminData(supabase: AdminClient) {
  const [{ data: gameSessions }, { data: users }] = await Promise.all([
    supabase
      .from('game_sessions')
      .select('id, telegram_id, wallet_id, kicks, balls_spawned, duration_seconds, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('users').select('telegram_id, bonus_balls, bonus_spins'),
  ])

  return {
    gameSessions: gameSessions ?? [],
    bonusesByTelegramId: new Map((users ?? []).map((user) => [user.telegram_id, user])),
  }
}
