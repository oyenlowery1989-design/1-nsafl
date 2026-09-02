import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createSportsRepository(supabase: SupabaseClient) {
  return {
    setFavoriteTeam(telegramId: number, favoriteTeam: string | null) {
      return supabase.from('users').update({ favorite_team: favoriteTeam }).eq('telegram_id', telegramId)
    },

    removeTeamRequests(telegramId: number) {
      return supabase.from('team_change_requests').delete().eq('telegram_id', telegramId)
    },
  }
}
