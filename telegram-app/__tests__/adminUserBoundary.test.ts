import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const disabledPack = vi.hoisted(() => vi.fn())
const query = vi.hoisted(() => vi.fn())
const walletRemove = vi.hoisted(() => vi.fn())

vi.mock('@/lib/feature-gate', () => ({
  requirePack: (pack: string) => disabledPack(pack),
}))
vi.mock('@/lib/supabase-server', () => ({ createServiceClient: () => ({ from: query }) }))
vi.mock('@/app/api/admin/route', () => ({ verifyAdminToken: () => true }))
vi.mock('@/packs/stellar-wallet/repository', () => ({
  createStellarWalletRepository: () => ({ removeWallets: walletRemove, getWalletIds: vi.fn() }),
}))
vi.mock('@/packs/sports/repository', () => ({ createSportsRepository: () => ({ setFavoriteTeam: vi.fn() }) }))
vi.mock('@/packs/games/repository', () => ({ createGamesRepository: () => ({ setBonusPool: vi.fn(), removeSessions: vi.fn() }) }))
vi.mock('@/packs/donations/repository', () => ({ createDonationsRepository: () => ({ removeForWallets: vi.fn() }) }))

describe('admin user pack boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    disabledPack.mockImplementation(() => undefined)
  })

  it('returns FEATURE_DISABLED before logout touches the wallet repository', async () => {
    disabledPack.mockImplementation((pack: string) => pack === 'stellar-wallet' ? Response.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 }) : undefined)
    const { PATCH } = await import('@/app/api/admin/user/[telegramId]/route')

    const response = await PATCH(new NextRequest('https://app.test/api/admin/user/7', {
      method: 'PATCH', body: JSON.stringify({ action: 'logout' }),
    }), { params: Promise.resolve({ telegramId: '7' }) })

    expect(response.status).toBe(404)
    expect(walletRemove).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('returns FEATURE_DISABLED before delete touches any pack repository', async () => {
    disabledPack.mockImplementation((pack: string) => pack === 'games' ? Response.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 }) : undefined)
    const { DELETE } = await import('@/app/api/admin/user/[telegramId]/route')

    const response = await DELETE(new NextRequest('https://app.test/api/admin/user/7', { method: 'DELETE' }), {
      params: Promise.resolve({ telegramId: '7' }),
    })

    expect(response.status).toBe(404)
    expect(walletRemove).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('returns FEATURE_DISABLED before mixed pack fields mutate any data', async () => {
    disabledPack.mockImplementation((pack: string) => pack === 'sports' ? Response.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 }) : undefined)
    const { PATCH } = await import('@/app/api/admin/user/[telegramId]/route')

    const response = await PATCH(new NextRequest('https://app.test/api/admin/user/7', {
      method: 'PATCH', body: JSON.stringify({ favorite_team: 'Perth', bonus_spins: 2 }),
    }), { params: Promise.resolve({ telegramId: '7' }) })

    expect(response.status).toBe(404)
    expect(query).not.toHaveBeenCalled()
  })
})
