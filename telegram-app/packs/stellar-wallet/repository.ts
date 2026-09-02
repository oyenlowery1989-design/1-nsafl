import { createServiceClient } from '@/lib/supabase-server'

type SupabaseClient = ReturnType<typeof createServiceClient>

export type PrimaryWallet = {
  id: string
  stellarAddress: string
  balance: number
}

export function createStellarWalletRepository(supabase: SupabaseClient) {
  return {
    async findPrimaryWallet(telegramId: number): Promise<PrimaryWallet | null> {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      if (!user) return null

      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, stellar_address')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle()
      if (!wallet) return null

      const { data: balance } = await supabase
        .from('wallet_balances')
        .select('primary_asset_balance')
        .eq('wallet_id', wallet.id)
        .maybeSingle()

      return {
        id: wallet.id,
        stellarAddress: wallet.stellar_address,
        balance: Number(balance?.primary_asset_balance ?? 0),
      }
    },

    async hasWallet(userId: string): Promise<boolean> {
      const { count } = await supabase
        .from('wallets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      return (count ?? 0) > 0
    },

    async listWallets(telegramId: number) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      if (!user) return []

      const { data } = await supabase
        .from('wallets')
        .select('id, stellar_address, is_primary, label, wallet_balances(primary_asset_balance, xlm_balance, last_synced_at)')
        .eq('user_id', user.id)
        .limit(5)
      return data ?? []
    },

    async getWalletIds(telegramId: number): Promise<string[] | null> {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .maybeSingle()
      if (!user) return null

      const { data } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
      return (data ?? []).map((wallet: { id: string }) => wallet.id)
    },

    async removeWallets(telegramId: number): Promise<void> {
      const walletIds = await this.getWalletIds(telegramId)
      if (!walletIds?.length) return
      await supabase.from('wallet_balances').delete().in('wallet_id', walletIds)
      await supabase.from('wallets').delete().in('id', walletIds)
    },

    async removePurchases(walletIds: string[]): Promise<void> {
      if (walletIds.length) await supabase.from('purchases').delete().in('wallet_id', walletIds)
    },
  }
}
