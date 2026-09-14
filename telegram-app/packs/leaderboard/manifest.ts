import type { PackManifest } from '@/packs/types'
import { getLeaderboardAdminContribution } from './admin/data'

export const leaderboardPack = {
  id: 'leaderboard',
  admin: [{ href: '/admin/referrals', label: 'Referrals', icon: 'group_add' }],
  adminData: getLeaderboardAdminContribution,
} satisfies PackManifest
