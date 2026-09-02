import { describe, expect, it } from 'vitest'
import { createStellarWalletRepository } from '@/packs/stellar-wallet/repository'

describe('Stellar wallet repository', () => {
  it('loads a user primary wallet with its stored balance', async () => {
    const calls: string[] = []
    const supabase = {
      from(table: string) {
        calls.push(table)
        return {
          select() { return this },
          eq() { return this },
          maybeSingle: async () => table === 'users'
            ? { data: { id: 'user-1' } }
            : table === 'wallets'
              ? { data: { id: 'wallet-1', stellar_address: 'GABC' } }
              : { data: { primary_asset_balance: '42.5' } },
        }
      },
    }

    await expect(
      createStellarWalletRepository(supabase as never).findPrimaryWallet(123),
    ).resolves.toEqual({ id: 'wallet-1', stellarAddress: 'GABC', balance: 42.5 })
    expect(calls).toEqual(['users', 'wallets', 'wallet_balances'])
  })
})
