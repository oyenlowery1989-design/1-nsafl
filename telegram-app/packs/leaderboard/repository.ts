import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createLeaderboardRepository(supabase: SupabaseClient) {
  return {
    async countReferrals(telegramId: number): Promise<number> {
      const { count } = await supabase
        .from('users')
        .select('telegram_id', { count: 'exact', head: true })
        .eq('referred_by', telegramId)
      return count ?? 0
    },
  }
}
