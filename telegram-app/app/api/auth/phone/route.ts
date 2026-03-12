import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// Called client-side after user consents to share phone via Telegram.requestContact().
// Stores the phone number against the user record.
export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramId: number
  if (isDev) {
    telegramId = 999999999
  } else {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramId = parsed.id
  }

  const body = await req.json().catch(() => ({}))
  const { phone } = body as { phone?: string }

  if (!phone || typeof phone !== 'string' || phone.length < 7) {
    return fail('Invalid phone', 'INVALID_DATA')
  }

  const supabase = createServiceClient()

  await supabase
    .from('users')
    .update({ telegram_phone: phone })
    .eq('telegram_id', telegramId)

  return ok({ saved: true })
}
