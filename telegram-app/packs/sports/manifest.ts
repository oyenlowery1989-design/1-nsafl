import type { PackManifest } from '@/packs/types'
import { sportsCopy } from './copy'
import { getSportsAdminContribution } from './admin/data'

export const sportsPack = {
  id: 'sports',
  navigation: [
    { href: '/stats', label: 'Stats', icon: 'query_stats' },
    { href: '/clubs', label: 'Clubs', icon: 'stadium' },
  ],
  adminData: getSportsAdminContribution,
  copy: sportsCopy,
} satisfies PackManifest
