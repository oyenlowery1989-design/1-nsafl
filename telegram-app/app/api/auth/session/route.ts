import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, TelegramUser } from '@/lib/telegram'
import { resolveIpLocation } from '@/lib/geo'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// Called by TelegramGuard every time the app opens inside Telegram.
// Records the Telegram user so we know who has accessed the app,
// even if they never connect a wallet.
// Returns BLOCKED error if the user is banned.
export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramUser: TelegramUser
  if (isDev) {
    telegramUser = { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  } else {
    const parsed = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!parsed) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramUser = parsed
  }

  const supabase = createServiceClient()

  // 1. Check permanent block list first (covers deleted+blocked users)
  const { data: blockedRow } = await supabase
    .from('blocked_telegram_ids')
    .select('telegram_id')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle()

  if (blockedRow) return fail('Account blocked', 'BLOCKED', 403)

  // Read optional referredBy from body
  let referredBy: number | null = null
  try {
    const body = await req.json().catch(() => ({}))
    const raw = (body as { referredBy?: unknown }).referredBy
    if (typeof raw === 'number' && !isNaN(raw) && raw !== telegramUser.id) referredBy = raw
  } catch { /* ignore parse errors */ }

  // 2. Upsert user record
  const { data: upserted } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username ?? null,
        telegram_first_name: telegramUser.first_name,
        telegram_photo_url: telegramUser.photo_url ?? null,
      },
      { onConflict: 'telegram_id' }
    )
    .select('id, is_blocked, referred_by')
    .single()

  // 2b. Save referral on first open — only if not already set and referrer exists
  if (upserted && referredBy && upserted.referred_by === null) {
    const { data: referrerExists } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('telegram_id', referredBy)
      .maybeSingle()
    if (referrerExists) {
      await supabase
        .from('users')
        .update({ referred_by: referredBy })
        .eq('telegram_id', telegramUser.id)
    }
  }

  // 3. Check soft-block on user row
  if (upserted?.is_blocked) return fail('Account blocked', 'BLOCKED', 403)

  // 4. Check if user has any wallets (used by client to detect server-side logout)
  const { count: walletCount } = await supabase
    .from('wallets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', upserted?.id ?? '')

  // 5. Log this session to access_attempts so we have a full connection history per user
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null
  const geoLocation = await resolveIpLocation(ip)
  await supabase.from('access_attempts').insert({
    ip,
    user_agent:          req.headers.get('user-agent') ?? null,
    tg_sdk_present:      true,
    tg_sdk_fake:         false,
    devtools_opened:     false,
    telegram_id:         telegramUser.id,
    telegram_username:   telegramUser.username ?? null,
    telegram_first_name: telegramUser.first_name,
    geo_location:        geoLocation,
  })

  return ok({ recorded: true, telegramId: telegramUser.id, hasWallet: (walletCount ?? 0) > 0 })
}
