import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createRewardsRepository(supabase: SupabaseClient) {
  return {
    async findMonthlyClaim(telegramId: number, month: string) {
      const { data } = await supabase
        .from('tier_reward_claims')
        .select('tier_id, payout_status, payout_tx_hash')
        .eq('telegram_id', telegramId)
        .eq('claim_month', month)
        .maybeSingle()
      return data
    },
  }
}
