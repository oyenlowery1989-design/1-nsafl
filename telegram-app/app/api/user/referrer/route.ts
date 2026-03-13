import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// GET /api/user/referrer?id=<telegramId>
// Returns the display name of a referrer — used for the "invited by" welcome screen.
export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  if (!isDev) {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id || isNaN(parseInt(id, 10))) return fail('Missing or invalid id', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('telegram_first_name, telegram_username')
    .eq('telegram_id', parseInt(id, 10))
    .maybeSingle()

  return ok({
    firstName: data?.telegram_first_name ?? null,
    username: data?.telegram_username ?? null,
  })
}
