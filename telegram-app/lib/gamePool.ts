import { randomInt } from 'crypto'
import { createServiceClient } from '@/lib/supabase-server'
import { getTierForBalance, TIERS } from '@/config/tiers'
import { GAME_PRIZE_DEFINITIONS, type GamePrizeSource } from '@/lib/rewardAssets'

export type GameSource = GamePrizeSource

export interface GamePrize {
  label: string          // exact string stored in lucky_draw_wins.prize, e.g. "100 wXLM"
  amount: number | null  // asset amount for sendable prizes, null for non-asset outcomes
  weight: number
}

export const PRIZE_TABLES: Record<GameSource, GamePrize[]> = GAME_PRIZE_DEFINITIONS

export function rollPrize(source: GameSource): { prize: GamePrize; index: number } {
  const table = PRIZE_TABLES[source]
  const total = table.reduce((s, p) => s + p.weight, 0)
  let r = randomInt(0, total) + 1
  for (let i = 0; i < table.length; i++) {
    r -= table[i].weight
    if (r <= 0) return { prize: table[i], index: i }
  }
  return { prize: table[table.length - 1], index: table.length - 1 }
}

// Daily spins by tier:
//   Tier 0 (pre-tier) → 0 daily; gets 3 welcome bonus spins once (auto-seeded on first check)
//   Tier 1+           → per-game daily limit below (resets midnight UTC)
export const GAME_LIMITS: Record<GameSource, number> = {
  lucky_draw: 3,
  slot_machine: 3,
  scratch_card: 1,
}

const WELCOME_SPINS_TIER0 = 3

export interface SpinStatus {
  baseLimit: number         // daily count based on tier (0 for pre-tier, GAME_LIMITS[source] for tier 1+)
  bonusSpins: number        // one-time pool — shared across all games, consumed when used
  spinsUsed: number         // this source's plays today
  spinsRemaining: number
  canSpin: boolean
  walletAddress: string | null  // primary wallet's stellar_address — payout destination
}

export async function getSpinStatus(
  supabase: ReturnType<typeof createServiceClient>,
  telegramId: number,
  source: GameSource
): Promise<SpinStatus> {
  const { data: userRow } = await supabase
    .from('users')
    .select('id, bonus_spins')
    .eq('telegram_id', telegramId)
    .single()

  let tierIndex = 0
  let walletAddress: string | null = null
  if (userRow?.id) {
    const { data: wallet } = await supabase
      .from('wallets').select('id, stellar_address').eq('user_id', userRow.id).eq('is_primary', true).single()
    if (wallet?.id) {
      walletAddress = wallet.stellar_address ?? null
      const { data: balanceRow } = await supabase
        .from('wallet_balances').select('primary_asset_balance').eq('wallet_id', wallet.id).single()
      if (balanceRow?.primary_asset_balance != null) {
        const tier = getTierForBalance(Number(balanceRow.primary_asset_balance))
        tierIndex = Math.max(0, TIERS.findIndex((t) => t.id === tier.id))
      }
    }
  }

  const isTier0 = tierIndex === 0
  const dailyBase = isTier0 ? 0 : GAME_LIMITS[source]

  let bonusSpins = userRow?.bonus_spins ?? 0

  // Auto-seed welcome spins for first-time Tier 0 users — one seed for the whole pool, race-free.
  // Gate: user has never played ANY game AND pool is exactly 0. The .eq('bonus_spins', 0) makes
  // the write atomic — of parallel calls, only one wins.
  if (isTier0 && bonusSpins === 0 && userRow?.id) {
    const { count: everPlayed } = await supabase
      .from('lucky_draw_wins')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', telegramId) // NOTE: no prize_source filter — all games
    if ((everPlayed ?? 0) === 0) {
      const { data: seeded } = await supabase
        .from('users')
        .update({ bonus_spins: WELCOME_SPINS_TIER0 })
        .eq('telegram_id', telegramId)
        .eq('bonus_spins', 0) // optimistic lock: seed exactly once
        .select('bonus_spins')
      if (seeded?.length) bonusSpins = WELCOME_SPINS_TIER0
      else {
        const { data: fresh } = await supabase
          .from('users').select('bonus_spins').eq('telegram_id', telegramId).single()
        bonusSpins = fresh?.bonus_spins ?? 0
      }
    }
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('lucky_draw_wins')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('prize_source', source)
    .gte('created_at', today.toISOString())

  const spinsUsed = count ?? 0
  const spinsRemaining = Math.max(0, dailyBase - spinsUsed) + bonusSpins

  return {
    baseLimit: dailyBase,
    bonusSpins,
    spinsUsed,
    spinsRemaining,
    canSpin: spinsUsed < dailyBase || bonusSpins > 0,
    walletAddress,
  }
}

export async function consumeSpin(
  supabase: ReturnType<typeof createServiceClient>,
  telegramId: number,
  source: GameSource
): Promise<{ ok: boolean; walletAddress: string | null }> {
  const status = await getSpinStatus(supabase, telegramId, source)

  // Daily quota: atomic RPC (game_spin_counters + consume_daily_spin, migration 023) —
  // authoritative under concurrent requests, unlike a count-then-insert check.
  if (status.baseLimit > 0) {
    const { data: consumed, error } = await supabase.rpc('consume_daily_spin', {
      p_telegram_id: telegramId,
      p_source: source,
      p_limit: status.baseLimit,
    })
    if (error) console.error(`consume_daily_spin RPC error for ${telegramId}/${source}:`, error.message)
    if (!error && consumed) return { ok: true, walletAddress: status.walletAddress }
  }

  // Tier-0 (baseLimit 0) or daily quota exhausted — fall through to the shared bonus pool.
  if (status.bonusSpins > 0) {
    const { data: decremented } = await supabase
      .from('users')
      .update({ bonus_spins: status.bonusSpins - 1 })
      .eq('telegram_id', telegramId)
      .eq('bonus_spins', status.bonusSpins) // optimistic lock
      .select('bonus_spins')
    if (decremented?.length) return { ok: true, walletAddress: status.walletAddress }
  }

  return { ok: false, walletAddress: status.walletAddress }
}

/**
 * Increment a shared bonus pool column (bonus_spins / bonus_balls) with an optimistic-locked
 * read-then-write. Retries once on a lost lock (concurrent grant); logs and gives up after that —
 * losing a rare race here means a bonus grant doesn't land, never a double-grant.
 */
export async function incrementBonusPool(
  supabase: ReturnType<typeof createServiceClient>,
  telegramId: number,
  column: 'bonus_spins' | 'bonus_balls',
  amount: number,
  prizeLabel: string,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: userRow } = await supabase
      .from('users').select('bonus_spins, bonus_balls').eq('telegram_id', telegramId).single()
    const current = (userRow?.[column] ?? 0) as number
    const { data: updated } = await supabase
      .from('users')
      .update({ [column]: current + amount })
      .eq('telegram_id', telegramId)
      .eq(column, current) // optimistic lock
      .select(column)
    if (updated?.length) return
  }
  console.error(`incrementBonusPool: lost optimistic lock twice — telegram_id=${telegramId} prize="${prizeLabel}" column=${column}`)
}
