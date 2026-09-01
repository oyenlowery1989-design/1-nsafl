import type { PackManifest } from '@/packs/types'
import { sportsCopy } from './copy'

export const sportsPack = {
  id: 'sports',
  navigation: [
    { href: '/stats', label: 'Stats', icon: 'query_stats' },
    { href: '/clubs', label: 'Clubs', icon: 'stadium' },
  ],
  copy: sportsCopy,
} satisfies PackManifest
