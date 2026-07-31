'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import { Card, Th, Td } from '../components/ui'
import { dt, num, shortAddr } from '../utils'
import type { AdminData, WalletRef } from '../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

function PurchasesContent() {
  const token = useAdminToken() ?? ''
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unverified' | 'direct' | 'advanced'>('all')
  const [search, setSearch] = useState('')
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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
      body: JSON.stringify({ type: 'purchase', id }),
    })
    const j = await res.json()
    if (j.success) {
      setData(prev => prev ? { ...prev, purchases: prev.purchases.map(p => p.id === id ? { ...p, verified: true } : p) } : prev)
      setToast('Marked as verified')
      setTimeout(() => setToast(null), 3000)
    }
    setVerifyingId(null)
  }

  const purchases = data?.purchases ?? []
  const filtered = purchases.filter(p => {
    if (filter !== 'all') {
      if (filter === 'unverified' && p.verified) return false
      if (filter !== 'unverified' && p.purchase_type !== filter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const addr = walletById[p.wallet_id]?.stellar_address ?? ''
      if (!addr.toLowerCase().includes(q) && !(p.stellar_tx_hash ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2235] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl">{toast}</div>}
      <input type="text" placeholder="Search by wallet address or TX hash…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40" />
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'unverified', 'direct', 'advanced'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${filter === f ? 'bg-[#D4AF37] text-black' : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            {f === 'all' ? `All (${purchases.length})` : f === 'unverified' ? `Unverified (${purchases.filter(p => !p.verified).length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${purchases.filter(p => p.purchase_type === f).length})`}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} results</span>
      </div>
      {loading ? <div className="py-12 text-center text-gray-600 text-sm">Loading…</div> : (
        <div className="bg-[#111827] border border-white/8 rounded-xl overflow-hidden">
          {filtered.length === 0 ? <p className="text-sm text-gray-600 px-6 py-12 text-center">No purchases match</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/3"><tr>
                  <Th>Stellar Address</Th><Th>XLM Amount</Th><Th>{PRIMARY_CUSTOM_ASSET_CODE} Amount</Th><Th>Type</Th><Th>TX Hash</Th><Th>Verified</Th><Th>Date</Th><Th />
                </tr></thead>
                <tbody className="divide-y divide-white/4">
                  {filtered.map(p => {
                    const w = walletById[p.wallet_id]
                    return (
                      <tr key={p.id} className="hover:bg-white/3">
                        <Td mono><span className="text-xs text-gray-300">{w?.stellar_address ? shortAddr(w.stellar_address) : p.wallet_id.slice(-8)}</span></Td>
                        <Td><span className="font-semibold text-blue-400">{num(p.xlm_amount)} XLM</span></Td>
                        <Td><span className="font-semibold text-yellow-400">{num(p.token_amount)}</span></Td>
                        <Td><span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${p.purchase_type === 'advanced' ? 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30' : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'}`}>{p.purchase_type}</span></Td>
                        <Td mono><span className="text-xs text-gray-500">{p.stellar_tx_hash ? `${p.stellar_tx_hash.slice(0, 16)}…` : '—'}</span></Td>
                        <Td><span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${p.verified ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' : 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30'}`}>{p.verified ? 'Verified' : 'Pending'}</span></Td>
                        <Td><span className="text-gray-500 text-xs">{dt(p.created_at)}</span></Td>
                        <Td>{!p.verified && <button onClick={() => verify(p.id)} disabled={verifyingId === p.id} className="text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded transition disabled:opacity-40">{verifyingId === p.id ? '…' : 'Verify'}</button>}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PurchasesPage() {
  return <Suspense><PurchasesContent /></Suspense>
}
