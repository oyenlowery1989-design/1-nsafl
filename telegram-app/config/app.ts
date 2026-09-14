import { BRANDING } from '@/config/branding'
import { donationsPack } from '@/packs/donations/manifest'
import { gamesPack } from '@/packs/games/manifest'
import { leaderboardPack } from '@/packs/leaderboard/manifest'
import { quizPack } from '@/packs/quiz/manifest'
import { rewardsPack } from '@/packs/rewards/manifest'
import { sportsPack } from '@/packs/sports/manifest'
import { stellarWalletPack } from '@/packs/stellar-wallet/manifest'
import type { ComponentType } from 'react'
import type { AdminUser, NavigationItem, PackId, PackManifest } from '@/packs/types'
import type { createServiceClient } from '@/lib/supabase-server'

export type AppFeature = PackId

export type FeatureConfig = Readonly<Record<AppFeature, boolean>>
type PackConfig = PackManifest & Readonly<{ enabled: boolean }>
type ConfigNavigationItem = NavigationItem & Readonly<{ feature?: AppFeature }>

const packs: Readonly<Record<PackId, PackConfig>> = {
  sports: { ...sportsPack, enabled: true },
  'stellar-wallet': { ...stellarWalletPack, enabled: true },
  games: { ...gamesPack, enabled: true },
  quiz: { ...quizPack, enabled: true },
  rewards: { ...rewardsPack, enabled: true },
  donations: { ...donationsPack, enabled: true },
  leaderboard: { ...leaderboardPack, enabled: true },
}

export const neutralNavigation = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/profile', label: 'Profile', icon: 'person' },
] as const satisfies readonly NavigationItem[]

function getPackNavigation(pack: PackConfig): readonly ConfigNavigationItem[] {
  return (pack.navigation ?? []).map((item) => ({ ...item, feature: pack.id }))
}

const navigation: readonly ConfigNavigationItem[] = [
  ...getPackNavigation(packs.sports),
  neutralNavigation[0],
  ...getPackNavigation(packs.rewards),
  neutralNavigation[1],
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

export function getAdminNavigationItems(features: FeatureConfig = APP_CONFIG.features) {
  return Object.values(APP_CONFIG.packs).flatMap((pack) => features[pack.id] ? (pack.admin ?? []) : [])
}

export function getAdminDataContributions(
  supabase: ReturnType<typeof createServiceClient>,
  users: readonly AdminUser[],
  features: FeatureConfig = APP_CONFIG.features,
) {
  return Promise.all(Object.values(APP_CONFIG.packs).flatMap((pack) =>
    features[pack.id] && pack.adminData ? [pack.adminData(supabase, users)] : [],
  ))
}

export async function getSessionData(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  features: FeatureConfig = APP_CONFIG.features,
) {
  const contributions = await Promise.all(Object.values(APP_CONFIG.packs).flatMap((pack) =>
    features[pack.id] && pack.sessionData ? [pack.sessionData(supabase, userId)] : [],
  ))
  return Object.assign({}, ...contributions)
}

export function getCenterAction(features: FeatureConfig = APP_CONFIG.features) {
  return Object.values(APP_CONFIG.packs).find((pack) => features[pack.id] && pack.centerAction)?.centerAction ?? null
}

export function getHomeContribution(features: FeatureConfig = APP_CONFIG.features): ComponentType | null {
  return Object.values(APP_CONFIG.packs).find((pack) => features[pack.id] && pack.home)?.home ?? null
}

export function getProfileContribution(features: FeatureConfig = APP_CONFIG.features): ComponentType | null {
  return Object.values(APP_CONFIG.packs).find((pack) => features[pack.id] && pack.profile)?.profile ?? null
}

export function getPackCopy<T>(key: string, features: FeatureConfig = APP_CONFIG.features): T | null {
  for (const pack of Object.values(APP_CONFIG.packs)) {
    const value = features[pack.id] ? pack.copy?.[key] : undefined
    if (value !== undefined) return value as T
  }
  return null
}
