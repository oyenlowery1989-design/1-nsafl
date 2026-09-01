import { expect, it } from 'vitest'
import { getHomeContribution } from '@/config/app'

const disabledPacks = {
  sports: false,
  'stellar-wallet': false,
  rewards: false,
  games: false,
  quiz: false,
  donations: false,
  leaderboard: false,
} as const

it('selects no pack home with every pack disabled', () => {
  expect(getHomeContribution(disabledPacks)).toBeNull()
})
