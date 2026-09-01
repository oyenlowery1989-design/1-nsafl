import type { PackManifest } from '@/packs/types'
import { gamesCopy } from './copy'

export const gamesPack = {
  id: 'games',
  centerAction: { href: '/game', label: 'Game', icon: 'sports_esports' },
  copy: gamesCopy,
} satisfies PackManifest
