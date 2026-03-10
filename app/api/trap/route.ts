import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { resolveIpLocation } from '@/lib/geo'

// Honeypot endpoint — silently called when someone hits the block screen.
// Uses service role so RLS doesn't block the insert.
// Returns a generic 200 so the client gets no useful signal.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null

    const supabase = createServiceClient()

    // Deduplicate: skip if same IP already recorded in the last 60 minutes
    if (ip) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('access_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since)
      if ((count ?? 0) > 0) return new Response(null, { status: 200 })
    }

    const geoLocation = await resolveIpLocation(ip)

    await supabase.from('access_attempts').insert({
      ip,
      user_agent:           req.headers.get('user-agent') ?? null,
      referrer:             req.headers.get('referer') ?? null,
      tg_start_param:       body.tgStartParam ?? null,
      tg_sdk_present:       body.tgSdkPresent ?? null,
      tg_sdk_fake:          body.tgSdkFake ?? null,
      devtools_opened:      body.devtoolsOpened ?? false,
      screen:               body.screen ?? null,
      timezone:             body.timezone ?? null,
      language:             body.language ?? null,
      url:                  body.url ?? null,
      telegram_id:          body.telegramId ?? null,
      telegram_username:    body.telegramUsername ?? null,
      telegram_first_name:  body.telegramFirstName ?? null,
      geo_location:         geoLocation,
    })
  } catch {
    // Swallow all errors — never expose internal state to the caller
  }

  return new Response(null, { status: 200 })
}
