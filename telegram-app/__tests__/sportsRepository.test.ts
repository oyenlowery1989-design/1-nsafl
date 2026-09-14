import { describe, expect, it, vi } from 'vitest'
import { createSportsRepository } from '@/packs/sports/repository'

describe('sports repository', () => {
  it('stores a team choice for the Telegram user', async () => {
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
    const supabase = { from: vi.fn(() => ({ update })) }

    await expect(
      createSportsRepository(supabase as never).setFavoriteTeam(123, 'Perth'),
    ).resolves.toEqual({ error: null })
    expect(supabase.from).toHaveBeenCalledWith('users')
    expect(update).toHaveBeenCalledWith({ favorite_team: 'Perth' })
  })
})
