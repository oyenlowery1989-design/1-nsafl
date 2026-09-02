import { createServiceClient } from '@/lib/supabase-server'
import type { AdminDataContribution } from '@/packs/types'

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

export async function getGamesAdminContribution(supabase: AdminClient): Promise<AdminDataContribution> {
  const gamesData = await getGamesAdminData(supabase)
  return {
    data: { gameSessions: gamesData.gameSessions },
    getUserFields: (user) => ({
      bonus_balls: gamesData.bonusesByTelegramId.get(user.telegram_id)?.bonus_balls ?? 0,
      bonus_spins: gamesData.bonusesByTelegramId.get(user.telegram_id)?.bonus_spins ?? 0,
    }),
  }
}
