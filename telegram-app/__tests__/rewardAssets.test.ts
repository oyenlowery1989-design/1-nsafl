import { describe, it, expect } from 'vitest'
import { REWARD_ASSETS, prizeToAsset, WRAPPED_PRIMARY_ASSET_CODE } from '@/lib/rewardAssets'

describe('tier reward assets', () => {
  it('derives the wrapped primary reward asset from the primary asset code', () => {
    expect(WRAPPED_PRIMARY_ASSET_CODE).toBe(`w${process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'}`)
    expect(REWARD_ASSETS.some((asset) => asset.code === WRAPPED_PRIMARY_ASSET_CODE)).toBe(true)
  })

  it('includes wGOLD, wSILVER, wCOPPER', () => {
    const codes = REWARD_ASSETS.map((a) => a.code)
    expect(codes).toContain('wGOLD')
    expect(codes).toContain('wSILVER')
    expect(codes).toContain('wCOPPER')
  })

  it('prizeToAsset resolves a wGOLD prize label', () => {
    const asset = prizeToAsset('5 wGOLD')
    expect(asset?.code).toBe('wGOLD')
    expect(asset?.issuer).toBe('GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL')
  })
})
