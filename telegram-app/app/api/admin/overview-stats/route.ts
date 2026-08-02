import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { REWARD_ASSETS } from '@/lib/rewardAssets'
import { Keypair } from 'stellar-sdk'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()

  // ── 7-day sparklines ──────────────────────────────────────────────────────
  const now = new Date()
  const days7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: usersRaw }, { data: winsRaw }] = await Promise.all([
    supabase.from('users').select('created_at').gte('created_at', days7ago),
    supabase.from('lucky_draw_wins').select('created_at').gte('created_at', days7ago)
      .neq('prize', 'Better Luck').not('prize', 'ilike', '%Spin%'),
  ])

  // Group by day (last 7 days, index 0 = 7 days ago, index 6 = today)
  const usersByDay = new Array(7).fill(0)
  const winsByDay = new Array(7).fill(0)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  for (const r of (usersRaw ?? [])) {
    if (!r.created_at) continue
    const d = new Date(r.created_at); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) usersByDay[6 - diff]++
  }
  for (const r of (winsRaw ?? [])) {
    if (!r.created_at) continue
    const d = new Date(r.created_at); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) winsByDay[6 - diff]++
  }

  // ── Today vs Yesterday ────────────────────────────────────────────────────
  const todayUsers     = usersByDay[6]
  const yesterdayUsers = usersByDay[5]
  const todayWins      = winsByDay[6]
  const yesterdayWins  = winsByDay[5]

  // ── Day labels (Mon, Tue, ...) ────────────────────────────────────────────
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86400000)
    return d.toLocaleDateString('en-AU', { weekday: 'short' })
  })

  // ── Active today + last paid ──────────────────────────────────────────────
  const todayISO = new Date(today.getTime()).toISOString()

  const [{ data: activeTodayRaw }, { data: lastPaidRow }] = await Promise.all([
    supabase.from('lucky_draw_wins')
      .select('telegram_id')
      .gte('created_at', todayISO),
    supabase.from('lucky_draw_wins')
      .select('payout_at')
      .eq('payout_status', 'paid')
      .not('payout_at', 'is', null)
      .order('payout_at', { ascending: false })
      .limit(1),
  ])

  const activeTodayIds = new Set((activeTodayRaw ?? []).map((r: { telegram_id: number }) => r.telegram_id))
  const activeToday = activeTodayIds.size
  const lastPaidAt: string | null = lastPaidRow?.[0]?.payout_at ?? null

  // ── Reward wallet balances ────────────────────────────────────────────────
  const rewardBalances: Record<string, string> = {}
  let senderAddress: string | null = null
  try {
    const senderSecret = process.env.REWARD_SENDER_SECRET
    if (senderSecret) {
      senderAddress = Keypair.fromSecret(senderSecret).publicKey()
      const res = await fetch(`${HORIZON_URL}/accounts/${senderAddress}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const acc = await res.json()
        for (const b of (acc.balances ?? [])) {
          const code = b.asset_type === 'native' ? 'XLM' : b.asset_code
          if (code) rewardBalances[code] = b.balance
        }
      }
    }
  } catch { /* non-fatal */ }

  // Build per-asset summary
  const assetBalances = REWARD_ASSETS.map(a => ({
    code:    a.code,
    label:   a.label,
    balance: rewardBalances[a.code] ?? null,
    low:     rewardBalances[a.code] != null ? parseFloat(rewardBalances[a.code]) < 50 : false,
  }))

  return ok({
    sparklines: {
      users:    { days: usersByDay, labels: dayLabels, today: todayUsers, yesterday: yesterdayUsers },
      wins:     { days: winsByDay,  labels: dayLabels, today: todayWins,  yesterday: yesterdayWins },
    },
    rewardAssets: assetBalances,
    activeToday,
    lastPaidAt,
    senderPublicKey: senderAddress,
  })
}
