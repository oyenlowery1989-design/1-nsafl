import { describe, it, expect } from 'vitest'
import { utcMonthStart } from '@/app/api/rewards/claim/route'

describe('utcMonthStart', () => {
  it('returns the first day of the UTC month as YYYY-MM-DD', () => {
    const d = new Date('2026-08-15T23:59:00Z')
    expect(utcMonthStart(d)).toBe('2026-08-01')
  })

  it('handles a date near a UTC month boundary correctly regardless of local offset', () => {
    // 2026-03-01T00:30:00Z is still March 1st in UTC even if the test
    // runner's local timezone would put it in February.
    const d = new Date('2026-03-01T00:30:00Z')
    expect(utcMonthStart(d)).toBe('2026-03-01')
  })
})
