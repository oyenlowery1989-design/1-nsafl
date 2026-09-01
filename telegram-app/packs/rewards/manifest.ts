import type { PackManifest } from '@/packs/types'
import { rewardsCopy } from './copy'

export const rewardsPack = {
  id: 'rewards',
  navigation: [{ href: '/rewards', label: 'Rewards', icon: 'redeem' }],
  copy: rewardsCopy,
} satisfies PackManifest
