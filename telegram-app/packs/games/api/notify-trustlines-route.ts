/**
 * POST /api/game/notify-trustlines
 * Sends the trustline-setup message to the authenticated player's own Telegram chat.
 * Called from the "Claim via Bot" button in the game win panel.
 */
import { NextRequest } from 'next/server'
import { requireFeature } from '@/lib/feature-gate'
import { validateTelegramInitData } from '@/lib/telegram'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildTrustlineMessage } from '@/lib/messages'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const disabled = requireFeature('games')
  if (disabled) return disabled

  // 3 notifications per minute per IP — prevents spam
  const limited = checkRateLimit(req, 3)
  if (limited) return limited

  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  let body: { prize?: unknown; winCode?: unknown } = {}
  try { body = await req.json() } catch { /* ok — optional fields */ }

  const prize   = typeof body.prize   === 'string' ? body.prize   : undefined
  const winCode = typeof body.winCode === 'string' ? body.winCode : undefined

  const message = buildTrustlineMessage(true, prize, winCode)

  if (IS_DEV) {
    console.log('[notify-trustlines DEV] would send to', user.id, '\n', message)
    return ok({ sent: true })
  }

  if (!BOT_TOKEN) return fail('Bot token not configured', 'SERVER_ERROR', 500)

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.id,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[notify-trustlines] bot error', err)
      return fail('Failed to send message', 'BOT_ERROR', 500)
    }
  } catch {
    return fail('Failed to send message', 'BOT_ERROR', 500)
  }

  return ok({ sent: true })
}
