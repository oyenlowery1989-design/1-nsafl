'use client'
import { useState, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import { Icon } from '../components/ui'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

type SearchUser = {
  telegram_id: number
  telegram_first_name: string | null
  telegram_username: string | null
  favorite_team: string | null
  is_blocked: boolean
  created_at: string
  bonus_spins: number | null
  winCount: number
  referralCount: number
  wallets: { stellar_address: string; is_primary: boolean; wallet_balances: { nsafl_balance: number; xlm_balance: number }[] }[]
}

function UserSearchContent() {
  const token = useAdminToken() ?? ''
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchUser[]>([])
  const [err, setErr] = useState('')

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const query = q.trim()
    if (!query) return
    setSearching(true); setErr(''); setResults([])
    try {
      const res = await fetch(`/api/admin/user-search?q=${encodeURIComponent(query)}`, { headers: { 'x-admin-token': token } })
      const json = await res.json()
      if (!res.ok) { setErr(json?.error ?? `HTTP ${res.status}`); return }
      setResults((json.data ?? json).users ?? [])
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Search failed') }
    finally { setSearching(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Icon name="person_search" className="text-[#D4AF37] text-xl" />
        User Search
      </h2>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Telegram ID (numeric) or @username…"
          className="flex-1 bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 placeholder-gray-600"
        />
        <button type="submit" disabled={searching || !q.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-40 transition"
          style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #f0d060 100%)' }}>
          {searching ? <Icon name="progress_activity" className="text-sm animate-spin" /> : <Icon name="search" className="text-sm" />}
          Search
        </button>
      </form>
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}
      {!searching && results.length === 0 && q && !err && (
        <p className="text-sm text-gray-600 text-center py-6">No users found for "{q}"</p>
      )}
      {results.map(user => {
        const primary = user.wallets?.find(w => w.is_primary) ?? user.wallets?.[0]
        const bal = primary?.wallet_balances?.[0]
        const nsafl = Number(bal?.nsafl_balance ?? 0)
        const tier = nsafl >= 2501 ? 'T4' : nsafl >= 1001 ? 'T3' : nsafl >= 501 ? 'T2' : nsafl >= 100 ? 'T1' : 'T0'
        return (
          <div key={user.telegram_id} className="bg-[#0d1424] border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold">{user.telegram_first_name ?? '—'}{user.telegram_username ? ` @${user.telegram_username}` : ''}</p>
                <p className="text-xs text-gray-500 font-mono">ID: {user.telegram_id}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {user.is_blocked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-bold">BLOCKED</span>}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">{tier}</span>
                {user.favorite_team && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-gray-400 border border-white/10">{user.favorite_team}</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: `${PRIMARY_CUSTOM_ASSET_CODE} Balance`, value: nsafl.toLocaleString(), accent: 'text-[#D4AF37]' },
                { label: 'XLM Balance',  value: Number(bal?.xlm_balance ?? 0).toFixed(2) },
                { label: 'Wins',         value: user.winCount },
                { label: 'Referrals',    value: user.referralCount },
              ].map(s => (
                <div key={s.label} className="bg-white/3 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${s.accent ?? 'text-white'}`}>{String(s.value)}</p>
                </div>
              ))}
            </div>
            {primary && (
              <p className="text-xs font-mono text-gray-500 bg-black/20 rounded px-2 py-1 truncate" title={primary.stellar_address}>
                Wallet: {primary.stellar_address}
              </p>
            )}
            <p className="text-[10px] text-gray-600">Joined {new Date(user.created_at).toLocaleDateString()} · Bonus spins: {user.bonus_spins ?? 0}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function UserSearchPage() {
  return <Suspense><UserSearchContent /></Suspense>
}
