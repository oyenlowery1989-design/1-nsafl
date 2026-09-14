import { createServiceClient } from '@/lib/supabase-server'
import type { AdminDataContribution } from '@/packs/types'

type AdminClient = ReturnType<typeof createServiceClient>

export async function getDonationsAdminData(supabase: AdminClient) {
  const { data: donations } = await supabase
    .from('donations')
    .select('id, wallet_id, amount, asset_code, donation_type, donation_target, stellar_tx_hash, verified, created_at')
    .order('created_at', { ascending: false })

  return { donations: donations ?? [] }
}

export async function getDonationsAdminContribution(supabase: AdminClient): Promise<AdminDataContribution> {
  const donationsData = await getDonationsAdminData(supabase)
  return { data: { donations: donationsData.donations } }
}
