import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/feature-gate', () => ({
  requirePack: () => Response.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 }),
}))

import { POST as recordTrustline } from '@/packs/stellar-wallet/api/trustline-record-route'
import { POST as verifyWalletKey } from '@/packs/stellar-wallet/api/verify-wallet-key-route'
import { GET as fetchLiveWallet } from '@/packs/stellar-wallet/api/wallet-live-route'

describe('additional stellar wallet routes when disabled', () => {
  it.each([
    ['trustline record', () => recordTrustline(new NextRequest('https://app.test/api/trustlines/record', { method: 'POST' }))],
    ['wallet key verification', () => verifyWalletKey(new NextRequest('https://app.test/api/auth/verify-wallet-key', { method: 'POST' }))],
    ['live wallet', () => fetchLiveWallet(new NextRequest('https://app.test/api/user/wallet-live'))],
  ])('returns FEATURE_DISABLED before handling %s requests', async (_route, request) => {
    const response = await request()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ success: false, code: 'FEATURE_DISABLED' })
  })
})
