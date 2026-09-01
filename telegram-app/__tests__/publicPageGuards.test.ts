import { expect, it, vi } from 'vitest'

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn(() => {
  throw new Error('redirected')
}) }))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/config/app', () => ({ isPackEnabled: () => false }))

import FeatureRedirect from '@/components/FeatureRedirect'
import BuyPage from '@/app/buy/page'
import ClubsPage from '@/app/clubs/page'
import DonatePage from '@/app/donate/page'
import GamePage from '@/app/game/page'
import LeaderboardPage from '@/app/leaderboard/page'
import RewardsPage from '@/app/rewards/page'
import StatsPage from '@/app/stats/page'
import TrustlinesPage from '@/app/trustlines/page'

const guardedPages = [
  ['sports clubs', ClubsPage],
  ['sports stats', StatsPage],
  ['stellar-wallet buy', BuyPage],
  ['stellar-wallet trustlines', TrustlinesPage],
  ['donations donate', DonatePage],
  ['games game', GamePage],
  ['leaderboard', LeaderboardPage],
  ['rewards', RewardsPage],
] as const

it('redirects disabled pack page boundaries before their page UI renders', () => {
  for (const [name, Page] of guardedPages) {
    redirect.mockClear()
    const page = Page()

    expect(page.type, name).toBe(FeatureRedirect)
    expect(() => FeatureRedirect(page.props), name).toThrow('redirected')
    expect(redirect, name).toHaveBeenCalledWith('/')
  }
})
