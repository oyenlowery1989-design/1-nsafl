import { describe, it, expect } from 'vitest'
import { REWARD_ASSETS, prizeToAsset } from '@/lib/rewardAssets'

describe('tier reward assets', () => {
  it('includes wGOLD, wSILVER, wCOPPER', () => {
    const codes = REWARD_ASSETS.map((a) => a.code)
    expect(codes).toContain('wGOLD')
    expect(codes).toContain('wSILVER')
    expect(codes).toContain('wCOPPER')
  })

  it('prizeToAsset resolves a wGOLD prize label', () => {
    const asset = prizeToAsset('5 wGOLD')
    expect(asset?.code).toBe('wGOLD')
  })
})
