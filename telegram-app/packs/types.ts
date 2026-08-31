export type PackId = 'sports' | 'stellar-wallet' | 'rewards' | 'games' | 'quiz' | 'donations' | 'leaderboard'

export type NavigationItem = Readonly<{
  href: string
  label: string
  icon: string
}>

export type PackManifest = Readonly<{
  id: PackId
  navigation?: readonly NavigationItem[]
  centerAction?: NavigationItem
  admin?: readonly NavigationItem[]
}>
