import type { PackManifest } from '@/packs/types'

export const rewardsPack = {
  id: 'rewards',
  navigation: [{ href: '/rewards', label: 'Rewards', icon: 'redeem' }],
} satisfies PackManifest
