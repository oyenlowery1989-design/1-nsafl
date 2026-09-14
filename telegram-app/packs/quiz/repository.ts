import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createQuizRepository(supabase: SupabaseClient) {
  return {
    async findSession(telegramId: number) {
      const { data } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      return data
    },
  }
}
