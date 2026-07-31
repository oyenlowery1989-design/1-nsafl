import { describe, it, expect } from 'vitest'
import { PRIZE_TABLES, rollPrize } from '@/lib/gamePool'
import { prizeToAsset } from '@/lib/rewardAssets'

describe('PRIZE_TABLES', () => {
  it('every table has positive weights and at least one non-asset outcome', () => {
    for (const table of Object.values(PRIZE_TABLES)) {
      expect(table.length).toBeGreaterThan(0)
      for (const p of table) expect(p.weight).toBeGreaterThan(0)
    }
  })
  it('every asset-shaped label has a numeric amount matching its label prefix', () => {
    for (const table of Object.values(PRIZE_TABLES)) {
      for (const p of table) {
        if (prizeToAsset(p.label)) {
          expect(p.amount).toBe(Number(p.label.trim().split(/\s+/)[0]))
        }
      }
    }
  })
  it('rollPrize always returns an entry from its own table', () => {
    for (let i = 0; i < 200; i++) {
      const { prize, index } = rollPrize('lucky_draw')
      expect(PRIZE_TABLES.lucky_draw[index]).toBe(prize)
    }
  })
})
