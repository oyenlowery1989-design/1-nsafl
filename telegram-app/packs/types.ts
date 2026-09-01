import type { ComponentType } from 'react'

export type PackId = 'sports' | 'stellar-wallet' | 'rewards' | 'games' | 'quiz' | 'donations' | 'leaderboard'

export type NavigationItem = Readonly<{
  href: string
  label: string
  icon: string
}>

export type PackManifest = Readonly<{
  id: PackId
  home?: ComponentType
  navigation?: readonly NavigationItem[]
  centerAction?: NavigationItem
  admin?: readonly NavigationItem[]
  copy?: Readonly<Record<string, unknown>>
}>
