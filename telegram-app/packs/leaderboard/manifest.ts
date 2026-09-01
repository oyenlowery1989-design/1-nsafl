import type { PackManifest } from '@/packs/types'

export const leaderboardPack = {
  id: 'leaderboard',
  admin: [{ href: '/admin/referrals', label: 'Referrals', icon: 'group_add' }],
} satisfies PackManifest
