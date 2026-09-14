import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createSportsRepository(supabase: SupabaseClient) {
  return {
    async getFavoriteTeam(telegramId: number): Promise<string | null> {
      const { data } = await supabase
        .from('users')
        .select('favorite_team')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      return data?.favorite_team ?? null
    },

    setFavoriteTeam(telegramId: number, favoriteTeam: string | null) {
      return supabase.from('users').update({ favorite_team: favoriteTeam }).eq('telegram_id', telegramId)
    },

    removeTeamRequests(telegramId: number) {
      return supabase.from('team_change_requests').delete().eq('telegram_id', telegramId)
    },
  }
}
