import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'
import { isValidStellarAddress } from '@/lib/stellar'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramId: number
  if (isDev) {
    telegramId = 999999999
  } else {
    const user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!user) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramId = user.id
  }

  const body = await req.json()
  const { stellarAddress } = body
  if (!stellarAddress || !isValidStellarAddress(stellarAddress))
    return fail('Invalid Stellar address', 'INVALID_ADDRESS')

  const supabase = createServiceClient()

  const { data: userData } = await (supabase as any)
    .from('users')
    .upsert({ telegram_id: telegramId }, { onConflict: 'telegram_id' })
    .select('id')
    .single()

  if (!userData) return fail('Failed to upsert user', 'DB_ERROR', 500)

  await (supabase as any)
    .from('wallets')
    .upsert(
      { user_id: userData.id, stellar_address: stellarAddress },
      { onConflict: 'user_id' }
    )

  return ok({ telegramId, stellarAddress })
}
