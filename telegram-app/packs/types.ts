import type { ComponentType } from 'react'
import type { createServiceClient } from '@/lib/supabase-server'

export type PackId = 'sports' | 'stellar-wallet' | 'rewards' | 'games' | 'quiz' | 'donations' | 'leaderboard'

export type NavigationItem = Readonly<{
  href: string
  label: string
  icon: string
}>

export type AdminUser = Readonly<{
  id: string
  telegram_id: number
  telegram_first_name: string | null
  telegram_username: string | null
}>

export type AdminDataContribution = Readonly<{
  data: Readonly<Record<string, unknown>>
  getUserFields?: (user: AdminUser) => Readonly<Record<string, unknown>>
}>

export type AdminDataLoader = (
  supabase: ReturnType<typeof createServiceClient>,
  users: readonly AdminUser[],
) => Promise<AdminDataContribution>

export type SessionDataLoader = (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) => Promise<Readonly<Record<string, unknown>>>

export type PackManifest = Readonly<{
  id: PackId
  home?: ComponentType
  profile?: ComponentType
  navigation?: readonly NavigationItem[]
  centerAction?: NavigationItem
  admin?: readonly NavigationItem[]
  adminData?: AdminDataLoader
  sessionData?: SessionDataLoader
  copy?: Readonly<Record<string, unknown>>
}>
