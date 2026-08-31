import type { PackManifest } from '@/packs/types'

export const sportsPack = {
  id: 'sports',
  navigation: [
    { href: '/stats', label: 'Stats', icon: 'query_stats' },
    { href: '/clubs', label: 'Clubs', icon: 'stadium' },
  ],
} satisfies PackManifest
