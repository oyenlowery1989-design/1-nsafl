import { expect, it, vi } from 'vitest'
import { getAdminNavigationItems } from '@/config/app'
import FeatureRedirect from '@/components/FeatureRedirect'
import DonationsPage from '@/app/admin/donations/page'
import GamePage from '@/app/admin/game/page'
import PurchasesPage from '@/app/admin/purchases/page'
import QuizPage from '@/app/admin/quiz/page'
import ReferralsPage from '@/app/admin/referrals/page'
import RewardsClaimsPage from '@/app/admin/rewards-claims/page'
import TrustlinePage from '@/app/admin/trustline/page'
import WinsPage from '@/app/admin/wins/page'

const disabledPacks = {
  sports: false,
  'stellar-wallet': false,
  rewards: false,
  games: false,
  quiz: false,
  donations: false,
  leaderboard: false,
} as const

it('omits every domain admin link when its pack is disabled', () => {
  expect(getAdminNavigationItems(disabledPacks)).toEqual([])
})

it('guards every pack-owned admin page at the original URL', () => {
  for (const Page of [DonationsPage, GamePage, PurchasesPage, QuizPage, ReferralsPage, RewardsClaimsPage, TrustlinePage, WinsPage]) {
    expect(Page().type).toBe(FeatureRedirect)
  }
})

it('blocks the games admin route before authentication when games are disabled', async () => {
  vi.doMock('@/config/app', () => ({ isPackEnabled: () => false }))
  const { GET } = await import('@/app/api/admin/wins/route')
  const response = await GET(new Request('https://example.test/api/admin/wins') as never)

  expect(response.status).toBe(404)
})

it('blocks each pack-owned admin workflow when its pack is disabled', async () => {
  const [
    { POST: syncBalances },
    { GET: tierClaims },
    { GET: quiz },
    { POST: teamRequest },
    { GET: overviewStats },
    { POST: verify },
  ] = await Promise.all([
    import('@/app/api/admin/sync-missing-balances/route'),
    import('@/app/api/admin/tier-claims/route'),
    import('@/app/api/admin/quiz/route'),
    import('@/app/api/admin/team-request/route'),
    import('@/app/api/admin/overview-stats/route'),
    import('@/app/api/admin/verify/route'),
  ])

  await expect(syncBalances(new Request('https://example.test/api/admin/sync-missing-balances', { method: 'POST' }) as never)).resolves.toMatchObject({ status: 404 })
  await expect(tierClaims(new Request('https://example.test/api/admin/tier-claims') as never)).resolves.toMatchObject({ status: 404 })
  await expect(quiz(new Request('https://example.test/api/admin/quiz') as never)).resolves.toMatchObject({ status: 404 })
  await expect(teamRequest(new Request('https://example.test/api/admin/team-request', { method: 'POST' }) as never)).resolves.toMatchObject({ status: 404 })
  await expect(overviewStats(new Request('https://example.test/api/admin/overview-stats') as never)).resolves.toMatchObject({ status: 404 })
  await expect(verify(new Request('https://example.test/api/admin/verify', { method: 'POST', body: JSON.stringify({ type: 'donation', id: 'id' }) }) as never)).resolves.toMatchObject({ status: 404 })
})
