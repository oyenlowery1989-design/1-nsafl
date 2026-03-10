import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

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

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`telegram_id.eq.${telegramUser.id},telegram_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return fail('Failed to fetch notifications', 'DB_ERROR', 500)

  return ok({ notifications: notifications ?? [] })
}
