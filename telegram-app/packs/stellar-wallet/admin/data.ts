import { createServiceClient } from '@/lib/supabase-server'
import type { AdminDataContribution } from '@/packs/types'

type AdminClient = ReturnType<typeof createServiceClient>

export async function getWalletAdminData(supabase: AdminClient) {
  const [{ data: wallets }, { data: purchases }, { data: trustlineSubmissions }, { data: balances }] = await Promise.all([
    supabase
      .from('wallets')
      .select('id, user_id, stellar_address, label, is_primary, created_at, last_connected_at, wallet_balances ( primary_asset_balance, xlm_balance, balance_week_ago, last_synced_at )'),
    supabase
      .from('purchases')
      .select('id, wallet_id, xlm_amount, token_amount, stellar_tx_hash, purchase_type, verified, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('trustline_submissions')
      .select('id, ip, xdr, horizon_result, success, tx_hash, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('wallet_balances').select('primary_asset_balance, xlm_balance'),
  ])

  const walletsByUserId = new Map<string, Omit<NonNullable<typeof wallets>[number], 'user_id'>[]>()
  for (const { user_id, ...wallet } of wallets ?? []) {
    walletsByUserId.set(user_id, [...(walletsByUserId.get(user_id) ?? []), wallet])
  }

  return {
    walletsByUserId,
    purchases: purchases ?? [],
    trustlineSubmissions: trustlineSubmissions ?? [],
    totalNsafl: (balances ?? []).reduce((sum, balance) => sum + Number(balance.primary_asset_balance ?? 0), 0),
    totalXlm: (balances ?? []).reduce((sum, balance) => sum + Number(balance.xlm_balance ?? 0), 0),
  }
}

export async function getWalletAdminContribution(supabase: AdminClient): Promise<AdminDataContribution> {
  const walletData = await getWalletAdminData(supabase)
  return {
    data: {
      purchases: walletData.purchases,
      trustlineSubmissions: walletData.trustlineSubmissions,
      totalNsafl: walletData.totalNsafl,
      totalXlm: walletData.totalXlm,
    },
    getUserFields: (user) => ({ wallets: walletData.walletsByUserId.get(user.id) ?? [] }),
  }
}
