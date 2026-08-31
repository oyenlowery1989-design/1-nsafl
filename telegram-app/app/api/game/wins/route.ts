import { NextRequest } from 'next/server'
import { requireFeature } from '@/lib/feature-gate'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { resolveDisplayName } from '@/lib/display-name'

export async function GET(req: NextRequest) {
  const disabled = requireFeature('games')
  if (disabled) return disabled

  const rateLimitError = checkRateLimit(req, 30)
  if (rateLimitError) return rateLimitError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('lucky_draw_wins')
    .select('telegram_id, prize, prize_source, created_at, wallet_address')
    .neq('prize', 'Better Luck')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return fail('Failed to fetch wins', 'DB_ERROR', 500)

  const wins = data ?? []
  const telegramIds: number[] = [...new Set<number>(wins.map((w: { telegram_id: number }) => w.telegram_id))]
  const userMap: Record<number, { username: string | null; first_name: string | null; display_preference: string | null }> = {}
  if (telegramIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('telegram_id, telegram_username, telegram_first_name, display_preference')
      .in('telegram_id', telegramIds)
    for (const u of users ?? []) {
      userMap[u.telegram_id] = {
        username: u.telegram_username ?? null,
        first_name: u.telegram_first_name ?? null,
        display_preference: u.display_preference ?? null,
      }
    }
  }

  const enriched = wins.map((w: { telegram_id: number; prize: string; prize_source: string | null; created_at: string; wallet_address: string | null }) => ({
    display: resolveDisplayName({
      displayPreference: userMap[w.telegram_id]?.display_preference ?? null,
      stellarAddress: w.wallet_address,
      telegramUsername: userMap[w.telegram_id]?.username ?? null,
      telegramFirstName: userMap[w.telegram_id]?.first_name ?? null,
    }),
    prize: w.prize,
    prize_source: w.prize_source,
    created_at: w.created_at,
  }))

  return ok(enriched)
}
