import { describe, it, expect } from 'vitest'
import { getTierForBalance, getNextTier, formatReward, TIERS } from '../config/tiers'

describe('getTierForBalance', () => {
  it('returns pre-tier for balance of 0', () => {
    expect(getTierForBalance(0).id).toBe('pre-tier')
  })

  it('returns pre-tier for balance of 99', () => {
    expect(getTierForBalance(99).id).toBe('pre-tier')
  })

  it('returns tier-1 for balance of 100', () => {
    expect(getTierForBalance(100).id).toBe('tier-1')
  })

  it('returns tier-1 for balance of 500', () => {
    expect(getTierForBalance(500).id).toBe('tier-1')
  })

  it('returns tier-2 for balance of 501', () => {
    expect(getTierForBalance(501).id).toBe('tier-2')
  })

  it('returns tier-12 for a very large balance', () => {
    expect(getTierForBalance(999_999_999).id).toBe('tier-12')
  })

  it('returns tier-12 for balance of 400001', () => {
    expect(getTierForBalance(400_001).id).toBe('tier-12')
  })

  it('returns pre-tier for negative balance', () => {
    expect(getTierForBalance(-1).id).toBe('pre-tier')
  })
})

describe('getNextTier', () => {
  it('returns tier-1 when current is pre-tier', () => {
    const current = getTierForBalance(0)
    expect(getNextTier(current)?.id).toBe('tier-1')
  })

  it('returns tier-2 when current is tier-1', () => {
    const current = getTierForBalance(100)
    expect(getNextTier(current)?.id).toBe('tier-2')
  })

  it('returns null when current is tier-12 (max tier)', () => {
    const current = getTierForBalance(999_999)
    expect(getNextTier(current)).toBeNull()
  })
})

describe('formatReward', () => {
  it('formats millions with M suffix', () => {
    expect(formatReward(1_000_000)).toBe('1M')
    expect(formatReward(476_836_874)).toBe('476.8M')
    expect(formatReward(1_500_000)).toBe('1.5M')
  })

  it('formats thousands with K suffix', () => {
    expect(formatReward(1_000)).toBe('1K')
    expect(formatReward(781_250)).toBe('781.3K')
    expect(formatReward(20_000)).toBe('20K')
  })

  it('formats small numbers as plain integers', () => {
    expect(formatReward(75)).toBe('75')
    expect(formatReward(0)).toBe('0')
    expect(formatReward(999)).toBe('999')
  })
})

describe('TIERS integrity', () => {
  it('has 13 tiers (pre-tier + 12)', () => {
    expect(TIERS).toHaveLength(13)
  })

  it('tier ids are unique', () => {
    const ids = TIERS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tiers are sorted by minBalance ascending', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].minBalance).toBeGreaterThan(TIERS[i - 1].minBalance)
    }
  })

  it('only tier-12 has null maxBalance', () => {
    const nullMax = TIERS.filter((t) => t.maxBalance === null)
    expect(nullMax).toHaveLength(1)
    expect(nullMax[0].id).toBe('tier-12')
  })

  it('pre-tier has null rewards', () => {
    expect(TIERS[0].rewards).toBeNull()
  })

  it('all tiers from tier-1 onward have non-null rewards', () => {
    TIERS.slice(1).forEach((t) => {
      expect(t.rewards).not.toBeNull()
    })
  })
})
