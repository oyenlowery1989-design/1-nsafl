import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const body = await req.json().catch(() => null)
  if (!body?.code || !body?.prize) return fail('Missing fields', 'BAD_REQUEST')

  const supabase = createServiceClient()
  const { error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: body.prize,
      amount: body.amount ?? null,
      win_code: body.code,
      wallet_address: body.wallet ?? null,
      claimed: false,
    })

  if (error) {
    // table may not exist yet — log but don't fail the user
    console.error('lucky_draw_wins insert error:', error.message)
  }

  return ok({ saved: !error })
}
