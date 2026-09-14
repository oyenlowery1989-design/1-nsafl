import { describe, expect, it, vi } from 'vitest'
import { createDonationsRepository } from '@/packs/donations/repository'

describe('donations repository', () => {
  it('removes donations associated with disconnected wallets', async () => {
    const remove = vi.fn(() => ({ in: vi.fn(async () => ({ error: null })) }))
    const supabase = { from: vi.fn(() => ({ delete: remove })) }

    await expect(createDonationsRepository(supabase as never).removeForWallets(['wallet-1'])).resolves.toEqual({ error: null })
    expect(supabase.from).toHaveBeenCalledWith('donations')
  })
})
