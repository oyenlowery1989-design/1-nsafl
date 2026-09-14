import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getAdminDataContributions } from '@/config/app'

export function verifyAdminToken(req: NextRequest): boolean {
  if (checkRateLimit(req, 30, `admin:${req.headers.get('x-forwarded-for') ?? 'local'}`)) return false
  const token = req.headers.get('x-admin-token') ?? ''   // header only — no query param
  const secret = process.env.ADMIN_SECRET_TOKEN ?? ''
  if (!token || !secret) return false
  const a = crypto.createHash('sha256').update(token).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)  // hash first: equal length, constant-time
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()

  const [{ data: users }, { data: accessAttempts }] = await Promise.all([
    // Core identity data only. Domain data is composed below by enabled packs.
    supabase
      .from('users')
      .select(`
        id, telegram_id, telegram_username, telegram_first_name, telegram_photo_url, telegram_phone,
        display_preference, opt_in_telegram_notifications, is_blocked, created_at, updated_at
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('access_attempts')
      .select('id, ip, user_agent, tg_sdk_present, tg_sdk_fake, devtools_opened, screen, timezone, language, url, telegram_id, telegram_username, telegram_first_name, geo_location, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const allUsers = users ?? []
  const contributions = await getAdminDataContributions(supabase, allUsers)
  const adminUsers = allUsers.map(({ id, ...user }) => ({
    ...user,
    ...Object.assign({}, ...contributions.map((contribution) => contribution.getUserFields?.({ id, ...user }) ?? {})),
  }))

  return ok({
    users: adminUsers,
    accessAttempts: accessAttempts ?? [],
    ...Object.assign({}, ...contributions.map((contribution) => contribution.data)),
  })
}
