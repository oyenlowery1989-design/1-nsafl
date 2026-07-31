'use client'
import { Badge, Card, Th, Td } from '../ui'
import { dt, num, shortAddr } from '../../utils'
import type { AdminData, WalletRef } from '../../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

interface Props {
  data: AdminData
  walletById: Record<string, WalletRef>
  purchaseFilter: 'all' | 'unverified' | 'direct' | 'advanced'
  setPurchaseFilter: (v: 'all' | 'unverified' | 'direct' | 'advanced') => void
  purchaseSearch: string
  setPurchaseSearch: (v: string) => void
  verifyingId: string | null
  onVerify: (id: string) => void
}

export function PurchasesTab({
  data, walletById, purchaseFilter, setPurchaseFilter, purchaseSearch, setPurchaseSearch, verifyingId, onVerify,
}: Props) {
  const filteredPurchases = data.purchases.filter(p => {
    if (purchaseFilter !== 'all') {
      if (purchaseFilter === 'unverified' && p.verified) return false
      if (purchaseFilter !== 'unverified' && p.purchase_type !== purchaseFilter) return false
    }
    if (purchaseSearch) {
      const q = purchaseSearch.toLowerCase()
      const addr = walletById[p.wallet_id]?.stellar_address ?? ''
      if (!addr.toLowerCase().includes(q) && !(p.stellar_tx_hash ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search by wallet address or TX hash…"
        value={purchaseSearch}
        onChange={e => setPurchaseSearch(e.target.value)}
        className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
      />
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'unverified', 'direct', 'advanced'] as const).map(f => (
          <button key={f} onClick={() => setPurchaseFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
              purchaseFilter === f ? 'bg-[#D4AF37] text-black' : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}>
            {f === 'all' ? 'All' : f === 'unverified' ? 'Unverified' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-[10px] opacity-70">
              {f === 'all' ? data.purchases.length
                : f === 'unverified' ? data.purchases.filter(p => !p.verified).length
                : data.purchases.filter(p => p.purchase_type === f).length}
            </span>
          </button>
        ))}
      </div>
      <Card>
        {filteredPurchases.length === 0
          ? <p className="text-sm text-gray-600 px-6 py-12 text-center">No purchases match this filter</p>
          : <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/3">
                  <tr><Th>Stellar Address</Th><Th>XLM Sent</Th><Th>{PRIMARY_CUSTOM_ASSET_CODE}</Th><Th>Type</Th><Th>TX Hash</Th><Th>Verified</Th><Th>Date</Th><Th /></tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {filteredPurchases.map(p => {
                    const w = walletById[p.wallet_id]
                    return (
                      <tr key={p.id} className="hover:bg-white/3">
                        <Td mono><span className="text-xs text-gray-300">{w?.stellar_address ? shortAddr(w.stellar_address) : p.wallet_id.slice(-8)}</span></Td>
                        <Td><span className="text-gray-300">{num(p.xlm_amount)} XLM</span></Td>
                        <Td><span className="font-semibold text-yellow-400">{num(p.token_amount)}</span></Td>
                        <Td><Badge color={p.purchase_type === 'direct' ? 'blue' : 'purple'}>{p.purchase_type}</Badge></Td>
                        <Td mono><span className="text-xs text-gray-500">{p.stellar_tx_hash ? `${p.stellar_tx_hash.slice(0, 16)}…` : '—'}</span></Td>
                        <Td><Badge color={p.verified ? 'green' : 'yellow'}>{p.verified ? 'Verified' : 'Pending'}</Badge></Td>
                        <Td><span className="text-gray-500 text-xs">{dt(p.created_at)}</span></Td>
                        <Td>
                          {!p.verified && (
                            <button onClick={() => onVerify(p.id)} disabled={verifyingId === p.id}
                              className="text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded transition whitespace-nowrap disabled:opacity-40">
                              {verifyingId === p.id ? '…' : 'Mark Verified'}
                            </button>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
        }
      </Card>
    </div>
  )
}
