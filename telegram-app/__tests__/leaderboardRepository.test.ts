import { describe, expect, it, vi } from 'vitest'
import { createLeaderboardRepository } from '@/packs/leaderboard/repository'

describe('leaderboard repository', () => {
  it('counts referrals for an admin user lookup', async () => {
    const select = vi.fn(() => ({ eq: vi.fn(async () => ({ count: 2 })) }))
    const supabase = { from: vi.fn(() => ({ select })) }

    await expect(createLeaderboardRepository(supabase as never).countReferrals(123)).resolves.toBe(2)
    expect(supabase.from).toHaveBeenCalledWith('users')
  })
})
