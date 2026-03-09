'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WalletStore {
  stellarAddress: string | null
  nsaflBalance: string
  xlmBalance: string
  isConnected: boolean
  telegramUserId: number | null

  setWallet: (address: string) => void
  setBalances: (nsafl: string, xlm: string) => void
  setTelegramUserId: (id: number) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      stellarAddress: null,
      nsaflBalance: '0.00',
      xlmBalance: '0.00',
      isConnected: false,
      telegramUserId: null,

      setWallet: (address) =>
        set({ stellarAddress: address, isConnected: true }),

      setBalances: (nsafl, xlm) =>
        set({ nsaflBalance: nsafl, xlmBalance: xlm }),

      setTelegramUserId: (id) => set({ telegramUserId: id }),

      disconnect: () =>
        set({
          stellarAddress: null,
          nsaflBalance: '0.00',
          xlmBalance: '0.00',
          isConnected: false,
        }),
    }),
    { name: 'homecoming-hub-wallet' }
  )
)
