import type { PackManifest } from '@/packs/types'
import { rewardsCopy } from './copy'
import ProfilePage from '@/packs/stellar-wallet/ProfilePage'

export const rewardsPack = {
  id: 'rewards',
  navigation: [{ href: '/rewards', label: 'Rewards', icon: 'redeem' }],
  admin: [{ href: '/admin/rewards-claims', label: 'Reward Claims', icon: 'diamond' }],
  copy: rewardsCopy,
  profile: ProfilePage,
} satisfies PackManifest
