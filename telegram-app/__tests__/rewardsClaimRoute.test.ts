import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const sendTierClaimPayment = vi.fn()
vi.mock('@/lib/stellar-payment', () => ({ sendTierClaimPayment: (...args: unknown[]) => sendTierClaimPayment(...args) }))

const createServiceClient = vi.fn()
vi.mock('@/lib/supabase-server', () => ({ createServiceClient: (...args: unknown[]) => createServiceClient(...args) }))

import { POST } from '@/app/api/rewards/claim/route'

/**
 * Minimal fake Supabase client: each table gets a FIFO queue of canned
 * `{ data, error }` responses, consumed in the exact order the route code
 * issues its calls (users -> wallets -> wallet_balances -> tier_reward_claims...).
 * `.eq()`/`.select()` are no-ops that return the same chainable object;
 * `.single()`/`.maybeSingle()` pop the next queued response for that table.
 */
function fakeSupabase(responses: Record<string, unknown[]>) {
  const queues: Record<string, unknown[]> = {}
  for (const table in responses) queues[table] = [...responses[table]]

  function next(table: string) {
    const q = queues[table]
    if (!q || q.length === 0) throw new Error(`no more fake responses queued for table "${table}"`)
    return q.shift()
  }

  function chain(table: string) {
    const api = {
      eq: () => api,
      select: () => api,
      single: async () => next(table),
      maybeSingle: async () => next(table),
    }
    return api
  }

  return {
    from: (table: string) => ({
      select: () => chain(table),
      insert: () => ({ select: () => ({ single: async () => next(table) }) }),
      update: () => ({ eq: async () => ({ data: [], error: null }) }),
    }),
  }
}

function fakeRequest(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest
}

beforeEach(() => {
  sendTierClaimPayment.mockReset()
  createServiceClient.mockReset()
})

describe('POST /api/rewards/claim', () => {
  it('rejects a pre-tier balance with NO_REWARDS and never inserts a claim row', async () => {
    const supabase = fakeSupabase({
      users: [{ data: { id: 1 }, error: null }],
      wallets: [{ data: { id: 1, stellar_address: 'GABCDEF' }, error: null }],
      wallet_balances: [{ data: { primary_asset_balance: '0' }, error: null }],
    })
    const fromSpy = vi.spyOn(supabase, 'from')
    createServiceClient.mockReturnValue(supabase)

    const res = await POST(fakeRequest())
    const json = await res.json()

    expect(json.success).toBe(false)
    expect(json.code).toBe('NO_REWARDS')
    expect(fromSpy.mock.calls.some((c) => c[0] === 'tier_reward_claims')).toBe(false)
    expect(sendTierClaimPayment).not.toHaveBeenCalled()
  })

  it('returns ALREADY_CLAIMED when the existing row for this month is already paid', async () => {
    const supabase = fakeSupabase({
      users: [{ data: { id: 1 }, error: null }],
      wallets: [{ data: { id: 1, stellar_address: 'GABCDEF' }, error: null }],
      wallet_balances: [{ data: { primary_asset_balance: '150' }, error: null }],
      tier_reward_claims: [
        // insert() conflict
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        // lookup of the existing row
        {
          data: {
            id: 42, tier_id: 'tier-1', payout_status: 'paid', payout_tx_hash: 'abc123',
            gold_amount: 5, silver_amount: 40, copper_amount: 500,
          },
          error: null,
        },
      ],
    })
    createServiceClient.mockReturnValue(supabase)

    const res = await POST(fakeRequest())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
    expect(json.code).toBe('ALREADY_CLAIMED')
    expect(sendTierClaimPayment).not.toHaveBeenCalled()
  })

  it('re-drives payment against the existing row when it is still pending (retry, not lockout)', async () => {
    const supabase = fakeSupabase({
      users: [{ data: { id: 1 }, error: null }],
      wallets: [{ data: { id: 1, stellar_address: 'GABCDEF' }, error: null }],
      wallet_balances: [{ data: { primary_asset_balance: '150' }, error: null }],
      tier_reward_claims: [
        // insert() conflict — a prior attempt already inserted this month's row
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
        // lookup finds it stuck pending (payment never completed last time)
        {
          data: {
            id: 42, tier_id: 'tier-1', payout_status: 'pending', payout_tx_hash: null,
            gold_amount: 5, silver_amount: 40, copper_amount: 500,
          },
          error: null,
        },
      ],
    })
    createServiceClient.mockReturnValue(supabase)
    sendTierClaimPayment.mockResolvedValue({ sent: true, txHash: 'txhash999' })

    const res = await POST(fakeRequest())
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.txHash).toBe('txhash999')
    // Retried with the amounts already recorded on the existing row, not a fresh insert.
    expect(sendTierClaimPayment).toHaveBeenCalledWith(
      { id: 42, gold_amount: 5, silver_amount: 40, copper_amount: 500 },
      'GABCDEF',
      supabase,
    )
  })
})
