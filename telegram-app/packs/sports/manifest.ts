import type { PackManifest } from '@/packs/types'
import { sportsCopy } from './copy'
import { getSportsAdminContribution } from './admin/data'
import ProfilePage from '@/packs/stellar-wallet/ProfilePage'

export const sportsPack = {
  id: 'sports',
  navigation: [
    { href: '/stats', label: 'Stats', icon: 'query_stats' },
    { href: '/clubs', label: 'Clubs', icon: 'stadium' },
  ],
  adminData: getSportsAdminContribution,
  profile: ProfilePage,
  copy: sportsCopy,
} satisfies PackManifest
