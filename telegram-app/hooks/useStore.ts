'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TelegramUserSnapshot {
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
}

interface WalletStore {
  stellarAddress: string | null
  tokenBalance: string
  xlmBalance: string
  isConnected: boolean
  telegramUserId: number | null
  // Cached Telegram profile — set on wallet connect, persisted locally
  telegramUser: TelegramUserSnapshot | null
  // AFL team — freely changeable at any time
  favoriteTeam: string | null
  // WAFL team — optional, freely changeable
  favoriteWaflTeam: string | null
  // How the user appears in public leaderboards/stats
  displayPreference: 'address' | 'name' | 'username'
  // First-time onboarding — set to true after slides dismissed
  hasSeenOnboarding: boolean

  setWallet: (address: string) => void
  setBalances: (token: string, xlm: string) => void
  setTelegramUserId: (id: number) => void
  setTelegramUser: (user: TelegramUserSnapshot) => void
  setFavoriteTeam: (teamId: string) => void
  setFavoriteWaflTeam: (teamId: string | null) => void
  setDisplayPreference: (pref: 'address' | 'name' | 'username') => void
  setHasSeenOnboarding: () => void
  disconnect: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      stellarAddress: null,
      tokenBalance: '0.00',
      xlmBalance: '0.00',
      isConnected: false,
      telegramUserId: null,
      telegramUser: null,
      favoriteTeam: null,
      favoriteWaflTeam: null,
      displayPreference: 'address',
      hasSeenOnboarding: false,

      setWallet: (address) =>
        set({ stellarAddress: address, isConnected: true }),

      setBalances: (token, xlm) =>
        set({ tokenBalance: token, xlmBalance: xlm }),

      setTelegramUserId: (id) => set({ telegramUserId: id }),

      setTelegramUser: (user) => set({ telegramUser: user }),

      setFavoriteTeam: (teamId) => set({ favoriteTeam: teamId }),

      setFavoriteWaflTeam: (teamId) => set({ favoriteWaflTeam: teamId }),

      setDisplayPreference: (pref) => set({ displayPreference: pref }),

      setHasSeenOnboarding: () => set({ hasSeenOnboarding: true }),

      disconnect: () =>
        set({
          stellarAddress: null,
          tokenBalance: '0.00',
          xlmBalance: '0.00',
          isConnected: false,
          favoriteTeam: null,
          favoriteWaflTeam: null,
          telegramUser: null,
          telegramUserId: null,
          displayPreference: 'address',
        }),
    }),
    { name: 'homecoming-hub-wallet' }
  )
)
