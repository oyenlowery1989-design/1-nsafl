'use client'
import { useEffect, useState, Suspense } from 'react'
import { useAdminToken } from '@/app/admin/hooks/useAdminToken'
import { Card, Th, Td, StatTile, SectionTitle, Icon } from '@/app/admin/components/ui'
import { dt, num } from '@/app/admin/utils'
import type { AdminData } from '@/app/admin/types'

interface WinRow {
  id: number
  telegram_id: number
  prize: string
  prize_source: 'lucky_draw' | 'slot_machine' | 'scratch_card' | null
  amount: number | null
  created_at: string
}

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  lucky_draw:   { label: 'Lucky Draw',    icon: 'casino',      color: 'text-primary' },
  slot_machine: { label: 'Slot Machine',  icon: 'view_column', color: 'text-purple-400' },
  scratch_card: { label: 'Scratch Card',  icon: 'grid_view',   color: 'text-blue-400' },
}

function GamePageInner() {
  const token = useAdminToken()
  const [data, setData] = useState<AdminData | null>(null)
  const [wins, setWins] = useState<WinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token === null || token === '') return
    const headers = { 'x-admin-token': token }

    Promise.all([
      fetch('/api/admin', { headers }).then(r => r.json()),
      fetch('/api/admin/wins?limit=500', { headers }).then(r => r.json()),
    ])
      .then(([adminRes, winsRes]) => {
        if (!adminRes.success) throw new Error(adminRes.error ?? 'Failed to load admin data')
        setData(adminRes.data)
        setWins(winsRes.wins ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
  if (error) return <div className="text-red-400 text-center py-20">{error}</div>
  if (!data) return null

  const sessions = data.gameSessions
  const totalSessions = sessions.length
  const totalGameKicks = sessions.reduce((s, g) => s + g.kicks, 0)
  const avgKicks = totalSessions > 0 ? Math.round(totalGameKicks / totalSessions) : 0
  const totalSeconds = sessions.reduce((s, g) => s + g.duration_seconds, 0)
  const playHours = Math.floor(totalSeconds / 3600)
  const playMins = Math.floor((totalSeconds % 3600) / 60)
  const playTime = playHours > 0 ? `${playHours}h ${playMins}m` : `${playMins}m`
  const totalWins = wins.length

  // Per-source breakdown
  const bySource: Record<string, number> = { lucky_draw: 0, slot_machine: 0, scratch_card: 0 }
  for (const w of wins) if (w.prize_source && w.prize_source in bySource) bySource[w.prize_source]++

  // Most common prize per source
  const commonPrizeBySource: Record<string, string> = {}
  for (const src of Object.keys(bySource)) {
    const sourceWins = wins.filter(w => w.prize_source === src)
    const counts: Record<string, number> = {}
    for (const w of sourceWins) counts[w.prize] = (counts[w.prize] ?? 0) + 1
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    commonPrizeBySource[src] = top ? `${top[0]} (${top[1]})` : '—'
  }

  // Prize distribution (top 10)
  const prizeCounts: Record<string, number> = {}
  for (const w of wins) prizeCounts[w.prize] = (prizeCounts[w.prize] ?? 0) + 1
  const prizeList = Object.entries(prizeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const maxCount = prizeList[0]?.[1] ?? 1

  return (
    <div className="space-y-6 p-4 sm:p-6 min-h-screen bg-background-dark">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="sports_esports" className="text-xl text-primary" />
        <h1 className="text-lg font-bold text-white">Game Analytics</h1>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Total Sessions"      value={num(totalSessions)}   accent="text-purple-400" />
        <StatTile label="Total Kicks"          value={num(totalGameKicks)}  accent="text-yellow-400" />
        <StatTile label="Avg Kicks / Session"  value={avgKicks}             accent="text-blue-400" />
        <StatTile label="Play Time"            value={playTime}             accent="text-green-400" />
        <StatTile label="Total Wins"           value={num(totalWins)}       accent="text-primary" />
      </div>

      {/* Per-source win breakdown */}
      <section>
        <SectionTitle icon="bar_chart" title="Win Breakdown by Source" />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/3"><tr>
                <Th>Source</Th><Th>Wins</Th><Th>Most Common Prize</Th>
              </tr></thead>
              <tbody className="divide-y divide-white/4">
                {Object.entries(bySource).map(([src, count]) => {
                  const info = SOURCE_LABELS[src]
                  return (
                    <tr key={src} className="hover:bg-white/3">
                      <Td>
                        <span className="flex items-center gap-2">
                          <Icon name={info?.icon ?? 'help'} className={`text-base ${info?.color ?? 'text-gray-400'}`} />
                          <span className="font-medium text-white">{info?.label ?? src}</span>
                        </span>
                      </Td>
                      <Td><span className="font-bold text-white">{count}</span></Td>
                      <Td><span className="text-gray-300">{commonPrizeBySource[src] ?? '—'}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Prize distribution */}
      <section>
        <SectionTitle icon="emoji_events" title="Prize Distribution (Top 10)" count={prizeList.length} />
        <Card className="p-4">
          {prizeList.length === 0
            ? <p className="text-gray-600 text-sm text-center py-8">No wins recorded yet.</p>
            : <div className="space-y-3">
                {prizeList.map(([prize, count]) => (
                  <div key={prize} className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 w-40 shrink-0 truncate" title={prize}>{prize}</span>
                    <div className="flex-1 bg-white/5 rounded h-2 overflow-hidden">
                      <div style={{ width: `${(count / maxCount) * 100}%` }} className="h-2 bg-primary rounded" />
                    </div>
                    <span className="text-xs font-bold text-gray-400 w-10 text-right">{count}</span>
                  </div>
                ))}
              </div>
          }
        </Card>
      </section>

      {/* Recent game sessions */}
      <section>
        <SectionTitle icon="history" title="Recent Game Sessions" count={sessions.length} />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/3"><tr>
                <Th>Telegram ID</Th><Th>Kicks</Th><Th>Duration</Th><Th>When</Th>
              </tr></thead>
              <tbody className="divide-y divide-white/4">
                {sessions.length === 0
                  ? <tr><td colSpan={4} className="text-center text-gray-600 text-sm py-10">No sessions yet</td></tr>
                  : sessions.slice(0, 50).map(s => (
                    <tr key={s.id} className="hover:bg-white/3">
                      <Td mono><span className="text-gray-400">{s.telegram_id ?? '—'}</span></Td>
                      <Td><span className="font-bold text-purple-400">{s.kicks}</span></Td>
                      <Td><span className="text-gray-400">{s.duration_seconds}s</span></Td>
                      <Td><span className="text-gray-500 text-xs">{dt(s.created_at)}</span></Td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] bg-background-dark"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>}>
      <GamePageInner />
    </Suspense>
  )
}
