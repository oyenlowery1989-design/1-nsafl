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
  // AFL team selected after wallet connect (like a Hogwarts house)
  favoriteTeam: string | null
  // Pending team change request (waiting admin approval)
  pendingTeamRequest: { teamId: string; requestedAt: number } | null
  // How the user appears in public leaderboards/stats
  displayPreference: 'address' | 'name' | 'username'
  // First-time onboarding — set to true after slides dismissed
  hasSeenOnboarding: boolean

  setWallet: (address: string) => void
  setBalances: (token: string, xlm: string) => void
  setTelegramUserId: (id: number) => void
  setTelegramUser: (user: TelegramUserSnapshot) => void
  setFavoriteTeam: (teamId: string) => void
  setPendingTeamRequest: (req: { teamId: string; requestedAt: number } | null) => void
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
      pendingTeamRequest: null,
      displayPreference: 'address',
      hasSeenOnboarding: false,

      setWallet: (address) =>
        set({ stellarAddress: address, isConnected: true }),

      setBalances: (token, xlm) =>
        set({ tokenBalance: token, xlmBalance: xlm }),

      setTelegramUserId: (id) => set({ telegramUserId: id }),

      setTelegramUser: (user) => set({ telegramUser: user }),

      setFavoriteTeam: (teamId) => set({ favoriteTeam: teamId }),

      setPendingTeamRequest: (req) => set({ pendingTeamRequest: req }),

      setDisplayPreference: (pref) => set({ displayPreference: pref }),

      setHasSeenOnboarding: () => set({ hasSeenOnboarding: true }),

      disconnect: () =>
        set({
          stellarAddress: null,
          tokenBalance: '0.00',
          xlmBalance: '0.00',
          isConnected: false,
          favoriteTeam: null,
          telegramUser: null,
          telegramUserId: null,
          displayPreference: 'address',
          pendingTeamRequest: null,
        }),
    }),
    { name: 'homecoming-hub-wallet' }
  )
)
