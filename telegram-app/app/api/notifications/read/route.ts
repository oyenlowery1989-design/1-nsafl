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

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .or(`telegram_id.eq.${telegramUser.id},telegram_id.is.null`)
    .eq('read', false)

  if (error) return fail('Failed to mark notifications as read', 'DB_ERROR', 500)

  return ok({ updated: true })
}
