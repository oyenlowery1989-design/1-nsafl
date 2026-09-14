import { describe, expect, it, vi } from 'vitest'
import { createRewardsRepository } from '@/packs/rewards/repository'

describe('rewards repository', () => {
  it('loads the current monthly claim for a Telegram user', async () => {
    const maybeSingle = vi.fn(async () => ({ data: { tier_id: 'tier-2' } }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) })) }

    await expect(createRewardsRepository(supabase as never).findMonthlyClaim(123, '2026-09-01')).resolves.toEqual({ tier_id: 'tier-2' })
    expect(supabase.from).toHaveBeenCalledWith('tier_reward_claims')
  })
})
