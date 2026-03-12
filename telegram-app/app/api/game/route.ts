import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'
import { resolveDisplayName } from '@/lib/display-name'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''

// ── GET — community aggregate + top 10 leaderboard ───────────────────────────
export async function GET(req: NextRequest) {
  const rateLimitErr = checkRateLimit(req, 60)
  if (rateLimitErr) return rateLimitErr

  try {
    const supabase = createServiceClient()

    const [{ data: agg }, { data: board }] = await Promise.all([
      supabase.from('game_aggregate').select('*').single(),
      supabase
        .from('game_leaderboard')
        .select('telegram_id,kicks,balls_spawned,duration_seconds,telegram_username,telegram_first_name,display_preference,stellar_address')
        .limit(10),
    ])

    const aggregate = agg ?? {
      total_sessions: 0,
      total_kicks: 0,
      total_balls: 0,
      high_score: 0,
      unique_players: 0,
    }

    const leaderboard = ((board ?? []) as Array<{
      telegram_id: number
      kicks: number
      balls_spawned: number
      duration_seconds: number
      telegram_username: string | null
      telegram_first_name: string | null
      display_preference: string | null
      stellar_address: string | null
    }>).map((r, i) => ({
      rank: i + 1,
      name: resolveDisplayName({
        displayPreference: r.display_preference ?? 'address',
        stellarAddress: r.stellar_address ?? null,
        telegramUsername: r.telegram_username,
        telegramFirstName: r.telegram_first_name,
      }),
      kicks: r.kicks,
      ballsSpawned: r.balls_spawned,
      durationSeconds: r.duration_seconds,
    }))

    return ok({
      totalSessions: Number(aggregate.total_sessions),
      totalKicks: Number(aggregate.total_kicks),
      totalBalls: Number(aggregate.total_balls),
      highScore: Number(aggregate.high_score),
      uniquePlayers: Number(aggregate.unique_players),
      leaderboard,
    })
  } catch {
    return fail('Failed to load game stats', 'DB_ERROR', 500)
  }
}

// ── POST — save a completed session ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rateLimitErr = checkRateLimit(req, 20)
  if (rateLimitErr) return rateLimitErr

  try {
    const body = await req.json() as {
      kicks: number
      ballsSpawned: number
      durationSeconds: number
    }

    const { kicks, ballsSpawned, durationSeconds } = body

    // Basic sanity checks — no cheating with absurd numbers
    if (
      typeof kicks !== 'number' || kicks < 0 || kicks > 10_000 ||
      typeof ballsSpawned !== 'number' || ballsSpawned < 0 || ballsSpawned > 1_000 ||
      typeof durationSeconds !== 'number' || durationSeconds < 0 || durationSeconds > 86_400
    ) {
      return fail('Invalid session data', 'INVALID_DATA')
    }

    // Skip sessions with zero activity
    if (kicks === 0 && ballsSpawned === 0) {
      return ok({ saved: false, reason: 'empty session' })
    }

    const supabase = createServiceClient()

    // Try to identify the player from initData (optional — anonymous sessions allowed)
    let telegramId: number | null = null
    let walletId: string | null = null

    const initData = req.headers.get('x-telegram-init-data')
    const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

    // Always try real initData first; only fall back to mock when initData is absent
    const tgUser = initData ? validateTelegramInitData(initData, BOT_TOKEN) : null
    if (tgUser?.id) {
      telegramId = tgUser.id
    } else if (isDev) {
      telegramId = 999999999
    }

    if (telegramId) {
      const { data: userRow } = await supabase
        .from('users').select('id').eq('telegram_id', telegramId).maybeSingle()
      if (userRow) {
        const { data: walletRow } = await supabase
          .from('wallets').select('id').eq('user_id', userRow.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        walletId = walletRow?.id ?? null
      }
    }

    const { error } = await supabase
      .from('game_sessions')
      .insert({
        wallet_id: walletId,
        telegram_id: telegramId,
        kicks,
        balls_spawned: ballsSpawned,
        duration_seconds: Math.round(durationSeconds),
      })

    if (error) return fail('Failed to save session', 'DB_ERROR', 500)

    return ok({ saved: true, kicks, ballsSpawned })
  } catch {
    return fail('Unexpected error', 'INTERNAL_ERROR', 500)
  }
}
