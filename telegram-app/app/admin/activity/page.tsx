'use client'
import { useEffect, useState, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import { Icon } from '../components/ui'
import { isPackEnabled } from '@/config/app'

type PaidWin = {
  id: number
  telegram_id: number
  user_first_name: string | null
  user_username: string | null
  prize: string
  payout_status: string
  payout_tx_hash: string | null
  payout_at: string | null
  paid_by: string | null
  created_at: string
}

function ActivityContent() {
  const hasGames = isPackEnabled('games')
  const token = useAdminToken() ?? ''
  const [wins, setWins] = useState<PaidWin[]>([])
  const [loading, setLoading] = useState(hasGames)
  const [filterAdmin, setFilterAdmin] = useState('')

  useEffect(() => {
    if (!token || !hasGames) return
    fetch('/api/admin/wins?status=paid&limit=100', { headers: { 'x-admin-token': token } })
      .then(r => r.json())
      .then(j => setWins((j.data ?? j).wins ?? []))
      .finally(() => setLoading(false))
  }, [hasGames, token])

  const filtered = filterAdmin
    ? wins.filter(w => w.paid_by?.toLowerCase().includes(filterAdmin.toLowerCase()))
    : wins

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Icon name="history" className="text-primary text-xl" />
          Activity Log — Paid Wins
        </h2>
        <input type="text" value={filterAdmin} onChange={e => setFilterAdmin(e.target.value)}
          placeholder="Filter by admin…"
          className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder-gray-600" />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-600 gap-2">
          <Icon name="progress_activity" className="text-xl animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="bg-[#0d1424] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>{['ID', 'User', 'Prize', 'Paid by', 'TX Hash', 'When'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-600 text-sm py-10">No paid wins yet</td></tr>
              ) : filtered.map(w => (
                <tr key={w.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{w.id}</td>
                  <td className="px-3 py-2.5 text-xs text-white">
                    {w.user_first_name ?? ''}{w.user_username ? ` @${w.user_username}` : ''}
                    <span className="text-gray-600 ml-1">#{w.telegram_id}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-primary font-medium">{w.prize}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-300">{w.paid_by ?? <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs font-mono">
                    {w.payout_tx_hash ? (
                      <a href={`https://stellar.expert/explorer/public/tx/${w.payout_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {w.payout_tx_hash.slice(0, 8)}…
                      </a>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{w.payout_at ? new Date(w.payout_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ActivityPage() {
  return <Suspense><ActivityContent /></Suspense>
}
