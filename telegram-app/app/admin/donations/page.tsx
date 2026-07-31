'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, Th, Td, Icon } from '../components/ui'
import { dt, num, shortAddr } from '../utils'
import type { AdminData, Donation, WalletRef } from '../types'

function DonationTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    team: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
    player: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
    general: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${map[type] ?? 'bg-white/10 text-gray-400'}`}>{type}</span>
}

function DonationsContent() {
  const params = useSearchParams()
  const [token, setToken] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unverified' | 'team' | 'player' | 'general'>('all')
  const [search, setSearch] = useState('')
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const urlToken = params.get('token')
    const t = urlToken ?? localStorage.getItem('admin_token') ?? ''
    if (urlToken) localStorage.setItem('admin_token', urlToken)
    setToken(t)
  }, [params])

  useEffect(() => {
    if (!token) return
    fetch('/api/admin', { headers: { 'x-admin-token': token } })
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data) })
      .finally(() => setLoading(false))
  }, [token])

  const walletById = useMemo<Record<string, WalletRef>>(() => {
    if (!data) return {}
    const map: Record<string, WalletRef> = {}
    for (const u of data.users) for (const w of u.wallets) map[w.id] = { stellar_address: w.stellar_address, user: u }
    return map
  }, [data])

  async function verify(id: string) {
    setVerifyingId(id)
    const res = await fetch('/api/admin/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ type: 'donation', id }),
    })
    const j = await res.json()
    if (j.success) {
      setData(prev => prev ? { ...prev, donations: prev.donations.map(d => d.id === id ? { ...d, verified: true } : d) } : prev)
      setToast('Marked as verified')
      setTimeout(() => setToast(null), 3000)
    }
    setVerifyingId(null)
  }

  const donations = data?.donations ?? []
  const filtered = donations.filter(d => {
    if (filter !== 'all') {
      if (filter === 'unverified' && d.verified) return false
      if (filter !== 'unverified' && d.donation_type !== filter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const addr = walletById[d.wallet_id]?.stellar_address ?? ''
      if (!addr.toLowerCase().includes(q) && !(d.stellar_tx_hash ?? '').toLowerCase().includes(q) && !(d.donation_target ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2235] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl">{toast}</div>}
      <input type="text" placeholder="Search by wallet address, TX hash, or target…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40" />
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'unverified', 'team', 'player', 'general'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${filter === f ? 'bg-[#D4AF37] text-black' : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            {f === 'all' ? `All (${donations.length})` : f === 'unverified' ? `Unverified (${donations.filter(d => !d.verified).length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${donations.filter(d => d.donation_type === f).length})`}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} results</span>
      </div>
      {loading ? <div className="py-12 text-center text-gray-600 text-sm">Loading…</div> : (
        <Card>
          {filtered.length === 0 ? <p className="text-sm text-gray-600 px-6 py-12 text-center">No donations match</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/3"><tr>
                  <Th>Stellar Address</Th><Th>Amount</Th><Th>Asset</Th><Th>Type</Th><Th>Target</Th><Th>TX Hash</Th><Th>Verified</Th><Th>Date</Th><Th />
                </tr></thead>
                <tbody className="divide-y divide-white/4">
                  {filtered.map(d => {
                    const w = walletById[d.wallet_id]
                    return (
                      <tr key={d.id} className="hover:bg-white/3">
                        <Td mono><span className="text-xs text-gray-300">{w?.stellar_address ? shortAddr(w.stellar_address) : d.wallet_id.slice(-8)}</span></Td>
                        <Td><span className="font-semibold text-yellow-400">{num(d.amount)}</span></Td>
                        <Td><span className="text-gray-300">{d.asset_code}</span></Td>
                        <Td><DonationTypeBadge type={d.donation_type} /></Td>
                        <Td>{d.donation_target ? <span className="font-bold text-[#D4AF37] text-sm">{d.donation_target}</span> : <span className="text-gray-500 italic text-sm">General</span>}</Td>
                        <Td mono><span className="text-xs text-gray-500">{d.stellar_tx_hash ? `${d.stellar_tx_hash.slice(0, 16)}…` : '—'}</span></Td>
                        <Td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${d.verified ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' : 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30'}`}>
                            {d.verified ? 'Verified' : 'Pending'}
                          </span>
                        </Td>
                        <Td><span className="text-gray-500 text-xs">{dt(d.created_at)}</span></Td>
                        <Td>{!d.verified && <button onClick={() => verify(d.id)} disabled={verifyingId === d.id} className="text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded transition disabled:opacity-40">{verifyingId === d.id ? '…' : 'Verify'}</button>}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default function DonationsPage() {
  return <Suspense><DonationsContent /></Suspense>
}
