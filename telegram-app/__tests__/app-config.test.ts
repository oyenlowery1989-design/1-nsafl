import { describe, expect, it } from 'vitest'
import {
  APP_CONFIG,
  getCenterAction,
  getNavigationItems,
  isFeatureEnabled,
  isPackEnabled,
  neutralNavigation,
} from '@/config/app'

const disabledPacks = {
  sports: false,
  'stellar-wallet': false,
  rewards: false,
  games: false,
  quiz: false,
  donations: false,
  leaderboard: false,
} as const

describe('template configuration', () => {
  it('keeps every NSAFL module enabled by default', () => {
    expect(isPackEnabled('stellar-wallet')).toBe(true)
    expect(isFeatureEnabled('sports')).toBe(true)
    expect(isFeatureEnabled('games')).toBe(true)
    expect(isFeatureEnabled('rewards')).toBe(true)
  })

  it('only returns navigation entries for enabled features', () => {
    const items = getNavigationItems({ ...APP_CONFIG.features, sports: false })

    expect(items.some((item) => item.href === '/clubs')).toBe(false)
    expect(items.some((item) => item.href === '/')).toBe(true)
  })

  it('returns only neutral navigation with every pack disabled', () => {
    expect(getNavigationItems(disabledPacks)).toEqual(neutralNavigation)
  })

  it('uses a pack-provided center action', () => {
    expect(getCenterAction({ ...disabledPacks, games: true })?.href).toBe('/game')
  })
})
