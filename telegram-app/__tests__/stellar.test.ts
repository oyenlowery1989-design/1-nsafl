import { describe, it, expect } from 'vitest'
import { isValidStellarAddress } from '../lib/stellar'

describe('isValidStellarAddress', () => {
  it('accepts a well-formed G address (56 chars)', () => {
    expect(isValidStellarAddress('GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z')).toBe(true)
  })

  it('rejects an address that does not start with G', () => {
    expect(isValidStellarAddress('SAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z')).toBe(false)
  })

  it('rejects an address that is too short', () => {
    expect(isValidStellarAddress('GAWZCHD')).toBe(false)
  })

  it('rejects an address that is too long', () => {
    expect(isValidStellarAddress('GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2ZX')).toBe(false)
  })

  it('rejects an address with lowercase letters', () => {
    expect(isValidStellarAddress('gawzchdwmk43m6mz2ax7ax52m7m5jlbjytoeo3sv4limi6hjvjrysy2z')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidStellarAddress('')).toBe(false)
  })

  it('rejects an address with invalid characters (0, 1, 8, 9)', () => {
    // Base32 alphabet excludes 0, 1, 8, 9 — these addresses are syntactically invalid
    expect(isValidStellarAddress('G0WZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z')).toBe(false)
    expect(isValidStellarAddress('G1WZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z')).toBe(false)
  })
})
