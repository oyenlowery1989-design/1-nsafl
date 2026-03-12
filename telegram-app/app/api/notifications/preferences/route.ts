import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramUser: TelegramUser
  if (isDev) {
    telegramUser = {
      id: 999999999,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
    }
  } else {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramUser = parsed
  }

  let body: { optIn?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('Invalid request body', 'INVALID_BODY')
  }

  if (typeof body.optIn !== 'boolean') {
    return fail('optIn must be a boolean', 'INVALID_BODY')
  }

  const { optIn } = body

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ opt_in_telegram_notifications: optIn })
    .eq('telegram_id', telegramUser.id)

  if (error) return fail('Failed to update notification preferences', 'DB_ERROR', 500)

  return ok({ optIn })
}
