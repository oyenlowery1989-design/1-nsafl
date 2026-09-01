import { expect, it } from 'vitest'
import { getPackCopy } from '@/config/app'
import { getRootHome, NeutralHome } from '@/app/page'

const disabledPacks = {
  sports: false,
  'stellar-wallet': false,
  rewards: false,
  games: false,
  quiz: false,
  donations: false,
  leaderboard: false,
} as const

it('renders the neutral root when every pack is disabled', () => {
  expect(getRootHome(disabledPacks)).toBe(NeutralHome)
})

it('exposes no pack copy when every pack is disabled', () => {
  expect(getPackCopy('referralShareText', disabledPacks)).toBeNull()
})
