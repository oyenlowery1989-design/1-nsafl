import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

interface BotUser {
  telegram_id: number
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // Admin key check — skip if ADMIN_NOTIFY_KEY is not configured (dev convenience)
  const adminKey = process.env.ADMIN_NOTIFY_KEY
  if (adminKey) {
    const provided = req.headers.get('x-admin-key') ?? ''
    if (!isDev && provided !== adminKey) {
      return fail('Unauthorized', 'UNAUTHORIZED', 401)
    }
  }

  let body: { telegram_id?: unknown; broadcast?: unknown; message?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('Invalid request body', 'INVALID_BODY')
  }

  const { telegram_id, broadcast, message } = body

  if (typeof message !== 'string' || !message.trim()) {
    return fail('message is required and must be a non-empty string', 'INVALID_BODY')
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return fail('Bot token not configured', 'SERVER_ERROR', 500)

  const supabase = createServiceClient()
  let sent = 0

  if (broadcast === true) {
    // Fetch all opted-in users
    const { data: users, error } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('opt_in_telegram_notifications', true)

    if (error) return fail('Failed to fetch opted-in users', 'DB_ERROR', 500)

    const recipients: BotUser[] = users ?? []

    await Promise.all(
      recipients.map(async (user: BotUser) => {
        const success = await sendTelegramMessage(botToken, user.telegram_id, message)
        if (success) sent++
      })
    )
  } else {
    if (typeof telegram_id !== 'number') {
      return fail(
        'Provide either telegram_id (number) or broadcast: true',
        'INVALID_BODY'
      )
    }

    const success = await sendTelegramMessage(botToken, telegram_id, message)
    if (success) sent = 1
  }

  return ok({ sent })
}
