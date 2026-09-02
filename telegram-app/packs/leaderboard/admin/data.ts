import { createServiceClient } from '@/lib/supabase-server'
import type { AdminDataContribution, AdminUser } from '@/packs/types'

type AdminClient = ReturnType<typeof createServiceClient>

export async function getLeaderboardAdminData(supabase: AdminClient) {
  const { data: referredUsers } = await supabase
    .from('users')
    .select('telegram_id, telegram_first_name, telegram_username, referred_by, created_at')
    .not('referred_by', 'is', null)
    .order('created_at', { ascending: false })

  return { referredUsers: referredUsers ?? [] }
}

export async function getLeaderboardAdminContribution(supabase: AdminClient, users: readonly AdminUser[]): Promise<AdminDataContribution> {
  const leaderboardData = await getLeaderboardAdminData(supabase)
  const referredByTelegramId = new Map(leaderboardData.referredUsers.map((user) => [user.telegram_id, user.referred_by]))
  const usersByTelegramId = new Map(users.map((user) => [user.telegram_id, user]))
  const referrerMap = new Map<number, { count: number; lastAt: string }>()

  for (const user of leaderboardData.referredUsers) {
    if (!user.referred_by) continue
    const stats = referrerMap.get(user.referred_by)
    if (stats) {
      stats.count++
      if ((user.created_at ?? '') > stats.lastAt) stats.lastAt = user.created_at ?? ''
    } else {
      referrerMap.set(user.referred_by, { count: 1, lastAt: user.created_at ?? '' })
    }
  }

  return {
    data: {
      referredUsers: leaderboardData.referredUsers,
      referralStats: Array.from(referrerMap.entries()).map(([referrerId, stats]) => {
        const referrer = usersByTelegramId.get(referrerId)
        return {
          referrer_id: referrerId,
          referrer_name: referrer?.telegram_first_name ?? null,
          referrer_username: referrer?.telegram_username ?? null,
          referral_count: stats.count,
          last_referral_at: stats.lastAt,
        }
      }).sort((a, b) => b.referral_count - a.referral_count),
    },
    getUserFields: (user) => ({ referred_by: referredByTelegramId.get(user.telegram_id) ?? null }),
  }
}
