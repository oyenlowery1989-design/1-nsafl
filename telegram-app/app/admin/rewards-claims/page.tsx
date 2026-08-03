'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdminToken } from '@/app/admin/hooks/useAdminToken'

interface ClaimRow {
  id: number
  telegram_id: number
  user_first_name: string | null
  user_username: string | null
  tier_id: string
  claim_month: string
  gold_amount: number
  silver_amount: number
  copper_amount: number
  payout_status: 'pending' | 'paying' | 'paid'
  payout_tx_hash: string | null
  physical_gold_notified: boolean
  created_at: string
}

const STATUS_COLOR: Record<ClaimRow['payout_status'], string> = {
  pending: 'text-yellow-400',
  paying: 'text-blue-400',
  paid: 'text-green-400',
}

export default function RewardsClaimsPage() {
  const token = useAdminToken() ?? ''
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/tier-claims', { headers: { 'x-admin-token': token } })
      const json = await res.json()
      if (json.success) setClaims(json.data.claims)
      else setError(json.error ?? 'Failed to load claims')
    } catch {
      setError('Failed to load claims — network error')
    }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect -- load() only sets local component state, not a synchronous external mutation

  async function retry(claimId: number) {
    setRetrying(claimId)
    try {
      const res = await fetch('/api/admin/retry-tier-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ claimId }),
      })
      const json = await res.json()
      if (!json.success) alert(`Retry failed: ${json.error ?? json.code ?? 'unknown error'}`)
    } catch {
      alert('Retry failed — network error')
    }
    setRetrying(null)
    load()
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-bold mb-4">Tier Reward Claims</h1>
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/10">
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Tier</th>
              <th className="py-2 pr-4">Month</th>
              <th className="py-2 pr-4">Gold</th>
              <th className="py-2 pr-4">Silver</th>
              <th className="py-2 pr-4">Copper</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Tx</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="py-2 pr-4">{c.user_username ? `@${c.user_username}` : c.user_first_name ?? c.telegram_id}</td>
                <td className="py-2 pr-4">{c.tier_id}</td>
                <td className="py-2 pr-4">{c.claim_month}</td>
                <td className="py-2 pr-4">{c.gold_amount}</td>
                <td className="py-2 pr-4">{c.silver_amount}</td>
                <td className="py-2 pr-4">{c.copper_amount}</td>
                <td className={`py-2 pr-4 font-semibold ${STATUS_COLOR[c.payout_status] ?? 'text-gray-400'}`}>{c.payout_status.toUpperCase()}</td>
                <td className="py-2 pr-4 font-mono text-xs">{c.payout_tx_hash ? `${c.payout_tx_hash.slice(0, 8)}…` : '—'}</td>
                <td className="py-2 pr-4">
                  {c.payout_status === 'pending' && (
                    <button
                      onClick={() => retry(c.id)}
                      disabled={retrying === c.id}
                      className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-50"
                    >
                      {retrying === c.id ? 'Retrying…' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
