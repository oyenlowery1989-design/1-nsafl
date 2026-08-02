import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// GET /api/user/referrer?id=<telegramId>
// Returns the display name of a referrer — used for the "invited by" welcome screen.
// Only the caller's own referrer may be looked up (scoped to users.referred_by).
export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramUser: TelegramUser
  if (isDev) {
    telegramUser = { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  } else {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramUser = parsed
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id || isNaN(parseInt(id, 10))) return fail('Missing or invalid id', 'BAD_REQUEST', 400)
  const referrerId = parseInt(id, 10)

  const supabase = createServiceClient()

  const { data: caller } = await supabase
    .from('users')
    .select('referred_by')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle()

  if (caller?.referred_by !== referrerId) return fail('Forbidden', 'FORBIDDEN', 403)

  const { data } = await supabase
    .from('users')
    .select('telegram_first_name, telegram_username')
    .eq('telegram_id', referrerId)
    .maybeSingle()

  return ok({
    firstName: data?.telegram_first_name ?? null,
    username: data?.telegram_username ?? null,
  })
}
