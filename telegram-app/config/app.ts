import { BRANDING } from '@/config/branding'
import type { PackId, PackManifest } from '@/packs/types'

export type AppFeature = PackId

type FeatureConfig = Readonly<Record<AppFeature, boolean>>

type NavigationItem = {
  href: string
  label: string
  icon: string
  feature?: AppFeature
}

const packs: Readonly<Record<PackId, PackManifest>> = {
  sports: { enabled: true },
  'stellar-wallet': { enabled: true },
  games: { enabled: true },
  quiz: { enabled: true },
  rewards: { enabled: true },
  donations: { enabled: true },
  leaderboard: { enabled: true },
}

const navigation: readonly NavigationItem[] = [
  { href: '/stats', label: 'Stats', icon: 'query_stats', feature: 'sports' },
  { href: '/clubs', label: 'Clubs', icon: 'stadium', feature: 'sports' },
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/rewards', label: 'Rewards', icon: 'redeem', feature: 'rewards' },
  { href: '/profile', label: 'Profile', icon: 'person' },
]

const features: FeatureConfig = Object.fromEntries(
  Object.entries(packs).map(([pack, config]) => [pack, config.enabled]),
) as FeatureConfig

export const APP_CONFIG = { brand: BRANDING, packs, features, navigation } as const

export function isPackEnabled(pack: PackId) {
  return APP_CONFIG.packs[pack].enabled
}

export function isFeatureEnabled(feature: AppFeature) {
  return isPackEnabled(feature)
}

export function getNavigationItems(features: FeatureConfig = APP_CONFIG.features) {
  return APP_CONFIG.navigation.filter((item) => !item.feature || features[item.feature])
}
