import { describe, expect, it } from 'vitest'
import { getProfileContribution } from '@/config/app'

describe('profile pack contributions', () => {
  it('does not expose domain profile UI when all packs are disabled', () => {
    expect(getProfileContribution({
      sports: false,
      'stellar-wallet': false,
      rewards: false,
      games: false,
      quiz: false,
      donations: false,
      leaderboard: false,
    })).toBeNull()
  })

  it('selects a profile contribution from enabled packs', () => {
    expect(getProfileContribution({
      sports: true,
      'stellar-wallet': false,
      rewards: false,
      games: false,
      quiz: false,
      donations: false,
      leaderboard: false,
    })).toBeTypeOf('function')
  })
})
