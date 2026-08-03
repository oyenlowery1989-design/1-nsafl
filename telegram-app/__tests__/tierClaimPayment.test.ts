import { describe, it, expect, vi, beforeEach } from 'vitest'

const submitTransaction = vi.fn()
const loadAccount = vi.fn()

vi.mock('stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('stellar-sdk')>('stellar-sdk')
  return {
    ...actual,
    Horizon: {
      // Must be a real `function`, not an arrow function — sendTierClaimPayment
      // calls `new Horizon.Server(...)`, and arrow functions can't be constructors.
      Server: vi.fn().mockImplementation(function () {
        return { loadAccount, submitTransaction }
      }),
    },
  }
})

process.env.REWARD_SENDER_SECRET = 'SAZRKJADWVP4YGBTRRSVOSTGKGXXOMLLEGPFSYIFJ2TB4L5SG5HNGCQV'
process.env.NEXT_PUBLIC_REWARD_ASSET_ISSUER = 'GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL'

import { sendTierClaimPayment } from '@/lib/stellar-payment'

// Minimal chainable query builder over one shared mutable row. Every step
// (each .eq(), a trailing .select(), or awaiting the chain directly with
// no .select()) resolves the same way real supabase-js does — as a thenable.
function fakeSupabase(initialRow: Record<string, unknown>) {
  const row: Record<string, unknown> = { ...initialRow }

  function makeBuilder(patch: Record<string, unknown>, filters: [string, unknown][]) {
    async function apply() {
      const matched = filters.every(([col, val]) => row[col] === val)
      if (matched) Object.assign(row, patch)
      return matched
    }
    return {
      eq(col: string, val: unknown) {
        return makeBuilder(patch, [...filters, [col, val]])
      },
      async select(_cols?: string) {
        const matched = await apply()
        return { data: matched ? [{ ...row }] : [], error: null }
      },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        apply().then(() => resolve({ data: null, error: null }), reject)
      },
    }
  }

  return {
    from: (_table: string) => ({ update: (patch: Record<string, unknown>) => makeBuilder(patch, []) }),
    getRow: () => row,
  }
}

beforeEach(() => {
  submitTransaction.mockReset()
  loadAccount.mockReset()
  loadAccount.mockResolvedValue({
    accountId: () => 'GCLJSO3U3LVMV26MFHCLBCW5E6VEEVDNYNP24B3YFDRLE7UAYQHW5BVQ',
    sequenceNumber: () => '1',
    incrementSequenceNumber: () => {},
  })
})

describe('sendTierClaimPayment', () => {
  it('refuses to send when the claim row is not pending', async () => {
    const supabase = fakeSupabase({ id: 1, payout_status: 'paid' })
    const result = await sendTierClaimPayment(
      { id: 1, gold_amount: 5, silver_amount: 40, copper_amount: 500 },
      'GA4BJXNDBD45FCL2ROK6CAB34IJWW4BN35JEUIMM5XJD6Q6CJZ5BW7IH',
      supabase,
    )
    expect(result.sent).toBe(false)
    expect(result.code).toBe('ALREADY_PAID')
    expect(submitTransaction).not.toHaveBeenCalled()
  })

  it('only includes non-zero asset legs in the transaction', async () => {
    submitTransaction.mockResolvedValue({ hash: 'txhash123' })
    const supabase = fakeSupabase({ id: 2, payout_status: 'pending' })
    const result = await sendTierClaimPayment(
      { id: 2, gold_amount: 5, silver_amount: 0, copper_amount: 10 },
      'GA4BJXNDBD45FCL2ROK6CAB34IJWW4BN35JEUIMM5XJD6Q6CJZ5BW7IH',
      supabase,
    )
    expect(result.sent).toBe(true)
    // submitTransaction receives the real, unmocked Transaction built by
    // TransactionBuilder — .operations reflects exactly what was added.
    const submittedTx = submitTransaction.mock.calls[0][0] as { operations: unknown[] }
    expect(submittedTx.operations).toHaveLength(2) // gold + copper, silver skipped
    expect(supabase.getRow().payout_status).toBe('paid')
    expect(supabase.getRow().payout_tx_hash).toBe('txhash123')
  })

  it('rolls back to pending and records the error when Horizon submission fails', async () => {
    submitTransaction.mockRejectedValue({
      response: { data: { extras: { result_codes: { transaction: 'tx_bad_auth' } } } },
    })
    const supabase = fakeSupabase({ id: 3, payout_status: 'pending' })
    const result = await sendTierClaimPayment(
      { id: 3, gold_amount: 5, silver_amount: 40, copper_amount: 500 },
      'GA4BJXNDBD45FCL2ROK6CAB34IJWW4BN35JEUIMM5XJD6Q6CJZ5BW7IH',
      supabase,
    )
    expect(result.sent).toBe(false)
    expect(result.code).toBe('BAD_AUTH')
    expect(supabase.getRow().payout_status).toBe('pending')
    expect(supabase.getRow().payout_notes).toContain('BAD_AUTH')
  })
})
