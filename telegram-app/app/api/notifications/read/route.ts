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

  // Personal notifications: scoped update, never touches other users' rows
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('telegram_id', telegramUser.id)
    .eq('read', false)

  if (error) return fail('Failed to mark notifications as read', 'DB_ERROR', 500)

  // Broadcast notifications (telegram_id null) are shared rows — track read state
  // per-user in users.read_broadcast_ids instead of mutating the shared row
  const { data: broadcasts } = await supabase
    .from('notifications')
    .select('id')
    .is('telegram_id', null)

  if (broadcasts && broadcasts.length > 0) {
    const { data: userRow } = await supabase
      .from('users')
      .select('read_broadcast_ids')
      .eq('telegram_id', telegramUser.id)
      .maybeSingle()

    // read_broadcast_ids is jsonb — application convention is string[], not enforced by the column type
    const existing = (userRow?.read_broadcast_ids as string[] | null) ?? []
    const merged = Array.from(
      new Set([...existing, ...broadcasts.map((b) => String(b.id))])
    )

    await supabase
      .from('users')
      .update({ read_broadcast_ids: merged })
      .eq('telegram_id', telegramUser.id)
  }

  return ok({ updated: true })
}
