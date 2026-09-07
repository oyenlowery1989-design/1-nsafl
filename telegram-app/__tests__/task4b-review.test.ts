import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/feature-gate', () => ({
  requirePack: (pack: string) => pack === 'leaderboard'
    ? Response.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 })
    : null,
}))

import { GET as referrals } from '@/packs/leaderboard/api/referrals-route'
import { GET as referrer } from '@/packs/leaderboard/api/referrer-route'

describe('leaderboard referral routes when disabled', () => {
  it.each([
    ['referrals', () => referrals(new NextRequest('https://app.test/api/user/referrals'))],
    ['referrer', () => referrer(new NextRequest('https://app.test/api/user/referrer?id=1'))],
  ])('returns FEATURE_DISABLED before %s data work', async (_route, request) => {
    const response = await request()
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ success: false, code: 'FEATURE_DISABLED' })
  })
})

const isPackEnabled = vi.hoisted(() => vi.fn(() => false))
const query = vi.hoisted(() => vi.fn())
const walletData = vi.hoisted(() => vi.fn())
const gameData = vi.hoisted(() => vi.fn())
const leaderboardData = vi.hoisted(() => vi.fn())
const sportsUpdate = vi.hoisted(() => vi.fn())

vi.mock('@/config/app', () => ({ isPackEnabled }))
vi.mock('@/lib/supabase-server', () => ({ createServiceClient: () => ({ from: query }) }))
vi.mock('@/app/api/admin/route', () => ({ verifyAdminToken: () => true }))
vi.mock('@/packs/stellar-wallet/repository', () => ({ createStellarWalletRepository: () => ({ listWallets: walletData }) }))
vi.mock('@/packs/games/repository', () => ({
  createGamesRepository: () => ({ countWins: gameData, setBonusPool: vi.fn(), removeSessions: vi.fn() }),
}))
vi.mock('@/packs/leaderboard/repository', () => ({ createLeaderboardRepository: () => ({ countReferrals: leaderboardData }) }))
vi.mock('@/packs/sports/repository', () => ({ createSportsRepository: () => ({ setFavoriteTeam: sportsUpdate, removeTeamRequests: vi.fn() }) }))
vi.mock('@/packs/donations/repository', () => ({ createDonationsRepository: () => ({ removeForWallets: vi.fn() }) }))

describe('core admin user boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    query.mockImplementation(() => {
      const rows = [{
        telegram_id: 7, telegram_username: 'user', telegram_first_name: 'User', telegram_photo_url: null,
        is_blocked: false, created_at: '2026-01-01', opt_in_telegram_notifications: true,
        favorite_team: 'must-not-leak', referred_by: 3, bonus_spins: 2,
      }]
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        limit: async () => ({ data: rows, error: null }),
        update: () => chain,
      }
      return chain
    })
  })

  it('does not query or return disabled pack data from user search', async () => {
    const { GET } = await import('@/app/api/admin/user-search/route')
    const response = await GET(new NextRequest('https://app.test/api/admin/user-search?q=user'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(walletData).not.toHaveBeenCalled()
    expect(gameData).not.toHaveBeenCalled()
    expect(leaderboardData).not.toHaveBeenCalled()
    expect(json.data.users[0]).toEqual({
      telegram_id: 7, telegram_username: 'user', telegram_first_name: 'User', telegram_photo_url: null,
      is_blocked: false, created_at: '2026-01-01', opt_in_telegram_notifications: true,
    })
  })

  it('returns before core updates when the sports update fails', async () => {
    sportsUpdate.mockResolvedValue({ error: { message: 'failed' } })
    const { PATCH } = await import('@/app/api/admin/user/[telegramId]/route')
    const response = await PATCH(new NextRequest('https://app.test/api/admin/user/7', {
      method: 'PATCH', body: JSON.stringify({ favorite_team: 'Perth', display_preference: 'first_name', bonus_spins: 2 }),
    }), { params: Promise.resolve({ telegramId: '7' }) })

    expect(response.status).toBe(500)
    expect(query).not.toHaveBeenCalled()
  })
})
