import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

function getUser(req: NextRequest): TelegramUser | null {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const realUser = initData ? validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!) : null
  if (realUser) return realUser
  if (isDev) return { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  return null
}

// GET /api/user/referrals — returns count + list of users referred by the caller
export async function GET(req: NextRequest) {
  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const telegramUser = getUser(req)
  if (!telegramUser) return fail('Invalid auth', 'INVALID_AUTH', 401)

  const supabase = createServiceClient()

  const { data: referrals, error } = await (supabase as any)
    .from('users')
    .select('telegram_first_name, telegram_username, created_at')
    .eq('referred_by', telegramUser.id)
    .order('created_at', { ascending: false })

  if (error) return fail('Failed to fetch referrals', 'DB_ERROR', 500)

  const list = (referrals ?? []) as Array<{
    telegram_first_name: string | null
    telegram_username: string | null
    created_at: string | null
  }>

  return ok({
    referralCount: list.length,
    referrals: list.map((r) => ({
      telegram_first_name: r.telegram_first_name,
      telegram_username: r.telegram_username,
      created_at: r.created_at,
    })),
  })
}
