import { describe, expect, it } from 'vitest'
import { createIdentityStore } from '@/hooks/useStore'
import { createSportsStore } from '@/packs/sports/store'
import { createStellarWalletStore } from '@/packs/stellar-wallet/store'

describe('pack-owned client state', () => {
  it('keeps core identity state free of wallet and team fields', () => {
    const state = createIdentityStore().getState()

    expect(state).toMatchObject({
      telegramUserId: null,
      telegramUser: null,
      displayPreference: 'address',
    })
    expect(state).not.toHaveProperty('stellarAddress')
    expect(state).not.toHaveProperty('tokenBalance')
    expect(state).not.toHaveProperty('xlmBalance')
    expect(state).not.toHaveProperty('favoriteTeam')
    expect(state).not.toHaveProperty('favoriteWaflTeam')
    expect(state).not.toHaveProperty('hasSeenOnboarding')
  })

  it('retains wallet, balance, and onboarding transitions in the Stellar pack', () => {
    const store = createStellarWalletStore()

    store.getState().setWallet('GABC')
    store.getState().setBalances('123.45', '6.78')
    store.getState().setHasSeenOnboarding()

    expect(store.getState()).toMatchObject({
      stellarAddress: 'GABC',
      tokenBalance: '123.45',
      xlmBalance: '6.78',
      isConnected: true,
      hasSeenOnboarding: true,
    })

    store.getState().disconnect()

    expect(store.getState()).toMatchObject({
      stellarAddress: null,
      tokenBalance: '0.00',
      xlmBalance: '0.00',
      isConnected: false,
    })
  })

  it('retains AFL and WAFL team selection in the sports pack', () => {
    const store = createSportsStore()

    store.getState().setFavoriteTeam('west-coast')
    store.getState().setFavoriteWaflTeam('perth')

    expect(store.getState()).toMatchObject({
      favoriteTeam: 'west-coast',
      favoriteWaflTeam: 'perth',
    })

    store.getState().resetTeams()

    expect(store.getState()).toMatchObject({
      favoriteTeam: null,
      favoriteWaflTeam: null,
    })
  })
})
