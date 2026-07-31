import { describe, it, expect } from 'vitest'
import { GAME_LIMITS, getSpinStatus, consumeSpin } from '@/lib/gamePool'

// Minimal in-memory fake of the Supabase query builder subset gamePool.ts uses:
// .from(table).select(cols, opts?).eq(k,v)...eq(k,v).single()/.gte(k,v)
// .from(table).update(patch).eq(k,v)...eq(k,v).select(cols)
function fakeSupabase(tables: { users: any[]; wallets: any[]; wallet_balances: any[]; lucky_draw_wins: any[] }) {
  function builder(tableName: string) {
    let rows = tables[tableName as keyof typeof tables] as any[]
    let mode: 'select' | 'update' = 'select'
    let patch: any = null
    let countOpt = false
    const filters: [string, any][] = []
    const api: any = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.count) countOpt = true
        return api
      },
      update(p: any) {
        mode = 'update'
        patch = p
        return api
      },
      eq(k: string, v: any) {
        filters.push([k, v])
        return api
      },
      gte(k: string, v: any) {
        filters.push([`${k}__gte`, v])
        return api
      },
      async single() {
        const match = apply()[0] ?? null
        return { data: match }
      },
      then(resolve: any) {
        // used when awaited directly after .select() with count, or after .update().eq().select()
        const matched = apply()
        if (mode === 'update') {
          for (const row of matched) Object.assign(row, patch)
          return resolve({ data: matched })
        }
        if (countOpt) return resolve({ count: matched.length })
        return resolve({ data: matched })
      },
    }
    function apply() {
      return rows.filter((r) => filters.every(([k, v]) => {
        if (k.endsWith('__gte')) return r[k.slice(0, -5)] >= v
        return r[k] === v
      }))
    }
    return api
  }
  return { from: builder }
}

describe('getSpinStatus / consumeSpin', () => {
  it('tier 0 first-ever play auto-seeds welcome bonus spins exactly once', async () => {
    const tables = {
      users: [{ telegram_id: 1, id: 'u1', bonus_spins: 0 }],
      wallets: [],
      wallet_balances: [],
      lucky_draw_wins: [],
    }
    const supabase = fakeSupabase(tables) as any
    const status = await getSpinStatus(supabase, 1, 'lucky_draw')
    expect(status.baseLimit).toBe(0) // tier 0
    expect(status.bonusSpins).toBe(3)
    expect(status.canSpin).toBe(true)
    expect(status.walletAddress).toBeNull()
  })

  it('does not reseed a user who already played (even with 0 bonus spins)', async () => {
    const tables = {
      users: [{ telegram_id: 2, id: 'u2', bonus_spins: 0 }],
      wallets: [],
      wallet_balances: [],
      lucky_draw_wins: [{ id: 1, telegram_id: 2, prize_source: 'slot_machine', created_at: new Date().toISOString() }],
    }
    const supabase = fakeSupabase(tables) as any
    const status = await getSpinStatus(supabase, 2, 'lucky_draw')
    expect(status.bonusSpins).toBe(0)
    expect(status.canSpin).toBe(false)
  })

  it('tier 1+ with wallet returns walletAddress and daily base from GAME_LIMITS', async () => {
    const tables = {
      users: [{ telegram_id: 3, id: 'u3', bonus_spins: 0 }],
      wallets: [{ id: 'w1', user_id: 'u3', is_primary: true, stellar_address: 'GABC123' }],
      wallet_balances: [{ wallet_id: 'w1', nsafl_balance: 5000 }],
      lucky_draw_wins: [{ id: 1, telegram_id: 3, prize_source: 'scratch_card', created_at: new Date().toISOString() }],
    }
    const supabase = fakeSupabase(tables) as any
    const status = await getSpinStatus(supabase, 3, 'scratch_card')
    expect(status.baseLimit).toBe(GAME_LIMITS.scratch_card)
    expect(status.walletAddress).toBe('GABC123')
    expect(status.spinsUsed).toBe(1)
  })

  it('consumeSpin decrements bonus pool once daily base is exhausted, and fails when nothing left', async () => {
    const today = new Date().toISOString()
    const tables = {
      users: [{ telegram_id: 4, id: 'u4', bonus_spins: 1 }],
      wallets: [],
      wallet_balances: [],
      lucky_draw_wins: [
        { id: 1, telegram_id: 4, prize_source: 'lucky_draw', created_at: today },
        { id: 2, telegram_id: 4, prize_source: 'lucky_draw', created_at: today },
        { id: 3, telegram_id: 4, prize_source: 'lucky_draw', created_at: today },
        { id: 4, telegram_id: 4, prize_source: 'slot_machine', created_at: today }, // ensures "ever played" gate is closed
      ],
    }
    const supabase = fakeSupabase(tables) as any
    const first = await consumeSpin(supabase, 4, 'lucky_draw')
    expect(first.ok).toBe(true)
    expect(tables.users[0].bonus_spins).toBe(0)

    const second = await consumeSpin(supabase, 4, 'lucky_draw')
    expect(second.ok).toBe(false)
  })
})
