import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createGamesRepository(supabase: SupabaseClient) {
  return {
    async countWins(telegramId: number): Promise<number> {
      const { count } = await supabase
        .from('lucky_draw_wins')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_id', telegramId)
        .neq('prize', 'Better Luck')
      return count ?? 0
    },

    removeSessions(telegramId: number) {
      return supabase.from('game_sessions').delete().eq('telegram_id', telegramId)
    },

    setBonusPool(telegramId: number, values: { bonus_balls?: number; bonus_spins?: number }) {
      return supabase.from('users').update(values).eq('telegram_id', telegramId)
    },
  }
}
