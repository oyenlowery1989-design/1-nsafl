import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/feature-gate', () => ({
  requirePack: () => Response.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 }),
}))

import { POST as authenticateWallet } from '@/packs/stellar-wallet/api/auth-route'
import { GET as fetchBalance } from '@/packs/stellar-wallet/api/balance-route'
import { POST as submitTransaction } from '@/packs/stellar-wallet/api/submit-route'
import { GET as fetchTransactions } from '@/packs/stellar-wallet/api/transactions-route'

describe('stellar wallet routes when disabled', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['authentication', () => authenticateWallet(new NextRequest('https://app.test/api/auth/wallet', { method: 'POST' }))],
    ['balance', () => fetchBalance(new NextRequest('https://app.test/api/stellar/balance'))],
    ['submission', () => submitTransaction(new NextRequest('https://app.test/api/stellar/submit', { method: 'POST' }))],
    ['transactions', () => fetchTransactions(new NextRequest('https://app.test/api/stellar/transactions'))],
  ])('returns FEATURE_DISABLED before handling %s requests', async (_route, request) => {
    const response = await request()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ success: false, code: 'FEATURE_DISABLED' })
  })
})
