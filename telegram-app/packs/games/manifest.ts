import type { PackManifest } from '@/packs/types'

export const gamesPack = {
  id: 'games',
  centerAction: { href: '/game', label: 'Game', icon: 'sports_esports' },
} satisfies PackManifest
