import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createGamesRepository(supabase: SupabaseClient) {
  return {
    async getBonusSpins(telegramId: number): Promise<number | null> {
      const { data } = await supabase
        .from('users')
        .select('bonus_spins')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      return data?.bonus_spins ?? null
    },

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
