import crypto from 'crypto'
import { describe, it, expect } from 'vitest'
import { validateTelegramInitData } from '../lib/telegram'

const BOT_TOKEN = 'test-bot-token-123'

function signInitData(fields: Record<string, string>): string {
  const params = new URLSearchParams(fields)
  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(sorted).digest('hex')

  const signed = new URLSearchParams({ ...fields, hash })
  return signed.toString()
}

function buildInitData(authDateSecondsAgo: number): string {
  const authDate = Math.floor(Date.now() / 1000) - authDateSecondsAgo
  return signInitData({
    auth_date: String(authDate),
    user: JSON.stringify({ id: 42, first_name: 'Test' }),
  })
}

describe('validateTelegramInitData', () => {
  it('accepts fresh, correctly signed initData', () => {
    const result = validateTelegramInitData(buildInitData(60), BOT_TOKEN)
    expect(result).toEqual({ id: 42, first_name: 'Test' })
  })

  it('rejects initData older than 24h', () => {
    const result = validateTelegramInitData(buildInitData(25 * 60 * 60), BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('rejects a tampered hash', () => {
    const params = new URLSearchParams(buildInitData(60))
    params.set('hash', params.get('hash')!.split('').reverse().join(''))
    // reversing hex keeps it hex but wrong value; still same length
    const result = validateTelegramInitData(params.toString(), BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('rejects a garbage non-hex hash', () => {
    const params = new URLSearchParams(buildInitData(60))
    params.set('hash', 'zz')
    const result = validateTelegramInitData(params.toString(), BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('rejects initData missing auth_date', () => {
    const params = new URLSearchParams(signInitData({ user: JSON.stringify({ id: 42, first_name: 'Test' }) }))
    const result = validateTelegramInitData(params.toString(), BOT_TOKEN)
    expect(result).toBeNull()
  })
})
