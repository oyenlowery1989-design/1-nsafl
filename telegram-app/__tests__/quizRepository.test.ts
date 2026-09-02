import { describe, expect, it, vi } from 'vitest'
import { createQuizRepository } from '@/packs/quiz/repository'

describe('quiz repository', () => {
  it('loads a quiz session by Telegram user', async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: 'session-1' } }))
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })) }

    await expect(createQuizRepository(supabase as never).findSession(123)).resolves.toEqual({ id: 'session-1' })
    expect(supabase.from).toHaveBeenCalledWith('quiz_sessions')
  })
})
