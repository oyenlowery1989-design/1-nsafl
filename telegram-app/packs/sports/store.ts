'use client'

import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import { mergePersistedState } from '@/hooks/persisted-state'

export interface SportsState {
  favoriteTeam: string | null
  favoriteWaflTeam: string | null
  setFavoriteTeam: (teamId: string) => void
  setFavoriteWaflTeam: (teamId: string | null) => void
  resetTeams: () => void
}

const initialState = {
  favoriteTeam: null,
  favoriteWaflTeam: null,
} satisfies Pick<SportsState, 'favoriteTeam' | 'favoriteWaflTeam'>

const createSportsState = (set: (partial: Partial<SportsState>) => void): SportsState => ({
  ...initialState,
  setFavoriteTeam: (favoriteTeam) => set({ favoriteTeam }),
  setFavoriteWaflTeam: (favoriteWaflTeam) => set({ favoriteWaflTeam }),
  resetTeams: () => set(initialState),
})

export const createSportsStore = () => createStore<SportsState>(createSportsState)

export const useSportsStore = create<SportsState>()(
  persist(createSportsState, {
    name: 'homecoming-hub-sports',
    merge: (persistedState, currentState) => mergePersistedState(
      persistedState,
      currentState,
      ['favoriteTeam', 'favoriteWaflTeam'],
    ),
  }),
)
