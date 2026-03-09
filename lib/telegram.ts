import crypto from 'crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export function validateTelegramInitData(
  initData: string,
  botToken: string
): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    params.delete('hash')
    const sorted = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sorted)
      .digest('hex')

    if (expectedHash !== hash) return null

    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(userStr) as TelegramUser
  } catch {
    return null
  }
}

export function isTelegramEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).Telegram?.WebApp?.initData
}

export function getTelegramInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as any).Telegram?.WebApp?.initData ?? ''
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null
  const user = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  return user ?? null
}
