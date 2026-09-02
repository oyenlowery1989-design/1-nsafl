import { describe, expect, it, vi } from 'vitest'
import { createGamesRepository } from '@/packs/games/repository'

describe('games repository', () => {
  it('counts non-losing prizes for an admin user lookup', async () => {
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ neq: vi.fn(async () => ({ count: 3 })) })) }))
    const supabase = { from: vi.fn(() => ({ select })) }

    await expect(createGamesRepository(supabase as never).countWins(123)).resolves.toBe(3)
    expect(supabase.from).toHaveBeenCalledWith('lucky_draw_wins')
  })
})
