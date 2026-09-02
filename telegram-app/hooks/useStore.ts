'use client'
import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import { mergePersistedState } from './persisted-state'

export interface TelegramUserSnapshot {
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
}

export interface IdentityState {
  telegramUserId: number | null
  telegramUser: TelegramUserSnapshot | null
  displayPreference: 'address' | 'name' | 'username'
  setTelegramUserId: (id: number) => void
  setTelegramUser: (user: TelegramUserSnapshot) => void
  setDisplayPreference: (pref: 'address' | 'name' | 'username') => void
  resetIdentity: () => void
}

const initialState = {
  telegramUserId: null,
  telegramUser: null,
  displayPreference: 'address',
} satisfies Pick<IdentityState, 'telegramUserId' | 'telegramUser' | 'displayPreference'>

const createIdentityState = (set: (partial: Partial<IdentityState>) => void): IdentityState => ({
  ...initialState,
  setTelegramUserId: (telegramUserId) => set({ telegramUserId }),
  setTelegramUser: (telegramUser) => set({ telegramUser }),
  setDisplayPreference: (displayPreference) => set({ displayPreference }),
  resetIdentity: () => set(initialState),
})

export const createIdentityStore = () => createStore<IdentityState>(createIdentityState)

export const useIdentityStore = create<IdentityState>()(
  persist(createIdentityState, {
    name: 'homecoming-hub-identity',
    merge: (persistedState, currentState) => mergePersistedState(
      persistedState,
      currentState,
      ['telegramUserId', 'telegramUser', 'displayPreference'],
    ),
  }),
)
