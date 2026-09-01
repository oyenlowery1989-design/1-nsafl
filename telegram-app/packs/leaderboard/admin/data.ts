import { createServiceClient } from '@/lib/supabase-server'

type AdminClient = ReturnType<typeof createServiceClient>

export async function getLeaderboardAdminData(supabase: AdminClient) {
  const { data: referredUsers } = await supabase
    .from('users')
    .select('telegram_id, telegram_first_name, telegram_username, referred_by, created_at')
    .not('referred_by', 'is', null)
    .order('created_at', { ascending: false })

  return { referredUsers: referredUsers ?? [] }
}
