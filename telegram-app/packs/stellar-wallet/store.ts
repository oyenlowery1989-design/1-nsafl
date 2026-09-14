'use client'

import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import { mergePersistedState } from '@/hooks/persisted-state'

export interface StellarWalletState {
  stellarAddress: string | null
  tokenBalance: string
  xlmBalance: string
  isConnected: boolean
  hasSeenOnboarding: boolean
  setWallet: (address: string) => void
  setBalances: (token: string, xlm: string) => void
  setHasSeenOnboarding: () => void
  disconnect: () => void
}

const initialState = {
  stellarAddress: null,
  tokenBalance: '0.00',
  xlmBalance: '0.00',
  isConnected: false,
  hasSeenOnboarding: false,
} satisfies Pick<StellarWalletState, 'stellarAddress' | 'tokenBalance' | 'xlmBalance' | 'isConnected' | 'hasSeenOnboarding'>

const createStellarWalletState = (set: (partial: Partial<StellarWalletState>) => void): StellarWalletState => ({
  ...initialState,
  setWallet: (stellarAddress) => set({ stellarAddress, isConnected: true }),
  setBalances: (tokenBalance, xlmBalance) => set({ tokenBalance, xlmBalance }),
  setHasSeenOnboarding: () => set({ hasSeenOnboarding: true }),
  disconnect: () => set(initialState),
})

export const createStellarWalletStore = () => createStore<StellarWalletState>(createStellarWalletState)

export const useStellarWalletStore = create<StellarWalletState>()(
  persist(createStellarWalletState, {
    name: 'homecoming-hub-stellar-wallet',
    merge: (persistedState, currentState) => mergePersistedState(
      persistedState,
      currentState,
      ['stellarAddress', 'tokenBalance', 'xlmBalance', 'isConnected', 'hasSeenOnboarding'],
    ),
  }),
)
