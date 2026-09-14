import { expect, it, vi } from 'vitest'

const { enabledPacks, redirect } = vi.hoisted(() => ({
  enabledPacks: new Set<string>(),
  redirect: vi.fn(() => {
  throw new Error('redirected')
  }),
}))

vi.mock('next/navigation', () => ({
  redirect,
  usePathname: () => '/profile',
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/config/app', () => ({
  getCenterAction: () => null,
  getNavigationItems: () => [],
  getPackCopy: () => null,
  getProfileContribution: () => enabledPacks.has('sports') ? (() => null) : null,
  isPackEnabled: (pack: string) => enabledPacks.has(pack),
}))

import FeatureRedirect from '@/components/FeatureRedirect'
import BuyPage from '@/app/buy/page'
import ClubsPage from '@/app/clubs/page'
import DonatePage from '@/app/donate/page'
import GamePage from '@/app/game/page'
import LeaderboardPage from '@/app/leaderboard/page'
import RewardsPage from '@/app/rewards/page'
import StatsPage from '@/app/stats/page'
import TrustlinesPage from '@/app/trustlines/page'
import ProfilePage from '@/app/profile/page'

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
  enabledPacks.clear()

  for (const [name, Page] of guardedPages) {
    redirect.mockClear()
    const page = Page()

    expect(page.type, name).toBe(FeatureRedirect)
    expect(() => FeatureRedirect(page.props), name).toThrow('redirected')
    expect(redirect, name).toHaveBeenCalledWith('/')
  }
})

it('renders the neutral profile before domain behavior when every profile pack is disabled', () => {
  enabledPacks.clear()

  const profile = ProfilePage()

  expect(profile.type).toBe('main')
  expect(profile.props['aria-label']).toBe('Profile')
})

it('keeps the full profile behavior when a profile pack is enabled', () => {
  enabledPacks.clear()
  enabledPacks.add('sports')

  expect(ProfilePage().type).not.toBe('main')
})
