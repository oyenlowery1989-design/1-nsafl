import type { PackManifest } from '@/packs/types'
import { gamesCopy } from './copy'
import { getGamesAdminContribution } from './admin/data'

export const gamesPack = {
  id: 'games',
  centerAction: { href: '/game', label: 'Game', icon: 'sports_esports' },
  admin: [
    { href: '/admin/game', label: 'Game', icon: 'sports_esports' },
    { href: '/admin/wins', label: 'Wins', icon: 'emoji_events' },
  ],
  adminData: getGamesAdminContribution,
  copy: gamesCopy,
} satisfies PackManifest
