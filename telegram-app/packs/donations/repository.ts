import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export function createDonationsRepository(supabase: SupabaseClient) {
  return {
    removeForWallets(walletIds: string[]) {
      return supabase.from('donations').delete().in('wallet_id', walletIds)
    },
  }
}
