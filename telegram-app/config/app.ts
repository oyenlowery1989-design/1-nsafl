import { BRANDING } from '@/config/branding'

export type AppFeature =
  | 'sports'
  | 'games'
  | 'quiz'
  | 'rewards'
  | 'donations'
  | 'leaderboard'

type FeatureConfig = Readonly<Record<AppFeature, boolean>>

type NavigationItem = {
  href: string
  label: string
  icon: string
  feature?: AppFeature
}

const features: FeatureConfig = {
  sports: true,
  games: true,
  quiz: true,
  rewards: true,
  donations: true,
  leaderboard: true,
}

const navigation: readonly NavigationItem[] = [
  { href: '/stats', label: 'Stats', icon: 'query_stats', feature: 'sports' },
  { href: '/clubs', label: 'Clubs', icon: 'stadium', feature: 'sports' },
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/rewards', label: 'Rewards', icon: 'redeem', feature: 'rewards' },
  { href: '/profile', label: 'Profile', icon: 'person' },
]

export const APP_CONFIG = { brand: BRANDING, features, navigation } as const

export function isFeatureEnabled(feature: AppFeature) {
  return APP_CONFIG.features[feature]
}

export function getNavigationItems(features: FeatureConfig = APP_CONFIG.features) {
  return APP_CONFIG.navigation.filter((item) => !item.feature || features[item.feature])
}
