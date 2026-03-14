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

type TelegramWindow = { Telegram?: { WebApp?: { initData?: string; initDataUnsafe?: { user?: TelegramUser }; ready?: () => void; expand?: () => void; openTelegramLink?: (url: string) => void } } }

export function isTelegramEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as TelegramWindow).Telegram?.WebApp?.initData
}

export function getTelegramInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as TelegramWindow).Telegram?.WebApp?.initData ?? ''
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null
  const user = (window as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.user
  return user ?? null
}

const REFERRAL_SHARE_TEXT =
  '🏉 Join me on the NSAFL Homecoming Hub — the home of Australian football on Stellar blockchain.\n\nHold $NSAFL, support AFL homecoming campaigns, climb the leaderboard and earn rewards. Use my link to get started:'

export function buildReferralLink(tgId: number | string | null | undefined, botUsername?: string): string {
  const bot = botUsername ?? process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot'
  return tgId ? `https://t.me/${bot}?startapp=ref_${tgId}` : `https://t.me/${bot}`
}

export function shareReferralLink(referralLink: string): void {
  if (!referralLink || typeof window === 'undefined') return
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(REFERRAL_SHARE_TEXT)}`
  ;(window as TelegramWindow).Telegram?.WebApp?.openTelegramLink?.(shareUrl)
}

/** Open a Telegram bot link using WebApp SDK if available, else window.open */
export function openTelegramLink(url: string): void {
  if (typeof window === 'undefined') return
  const tg = (window as TelegramWindow).Telegram?.WebApp
  if (tg?.openTelegramLink) { tg.openTelegramLink(url) } else { window.open(url, '_blank') }
}

/** Build a ?start= bot deep link (opens bot chat, not Mini App) */
export function buildBotStartLink(param: string, botUsername?: string): string {
  const bot = botUsername ?? process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot'
  return `https://t.me/${bot}?start=${param}`
}

export function parseTelegramUser(initData: string): { id: number; first_name?: string; username?: string } | null {
  try {
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(decodeURIComponent(userStr))
  } catch {
    return null
  }
}
