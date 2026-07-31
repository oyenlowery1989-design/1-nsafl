'use client'
import { Badge, Card, Th, Td, DonationTypeBadge } from '../ui'
import { dt, num, shortAddr } from '../../utils'
import type { AdminData, WalletRef } from '../../types'

interface Props {
  data: AdminData
  walletById: Record<string, WalletRef>
  donationFilter: 'all' | 'unverified' | 'team' | 'player' | 'general'
  setDonationFilter: (v: 'all' | 'unverified' | 'team' | 'player' | 'general') => void
  donationSearch: string
  setDonationSearch: (v: string) => void
  verifyingId: string | null
  onVerify: (id: string) => void
}

export function DonationsTab({
  data, walletById, donationFilter, setDonationFilter, donationSearch, setDonationSearch, verifyingId, onVerify,
}: Props) {
  const filteredDonations = data.donations.filter(d => {
    if (donationFilter !== 'all') {
      if (donationFilter === 'unverified' && d.verified) return false
      if (donationFilter !== 'unverified' && d.donation_type !== donationFilter) return false
    }
    if (donationSearch) {
      const q = donationSearch.toLowerCase()
      const addr = walletById[d.wallet_id]?.stellar_address ?? ''
      if (
        !addr.toLowerCase().includes(q) &&
        !(d.stellar_tx_hash ?? '').toLowerCase().includes(q) &&
        !(d.donation_target ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search by wallet address, TX hash, or donation target…"
        value={donationSearch}
        onChange={e => setDonationSearch(e.target.value)}
        className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
      />
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'unverified', 'team', 'player', 'general'] as const).map(f => (
          <button key={f} onClick={() => setDonationFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
              donationFilter === f ? 'bg-[#D4AF37] text-black' : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}>
            {f === 'all' ? 'All' : f === 'unverified' ? 'Unverified' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-[10px] opacity-70">
              {f === 'all' ? data.donations.length
                : f === 'unverified' ? data.donations.filter(d => !d.verified).length
                : data.donations.filter(d => d.donation_type === f).length}
            </span>
          </button>
        ))}
      </div>
      <Card>
        {filteredDonations.length === 0
          ? <p className="text-sm text-gray-600 px-6 py-12 text-center">No donations match this filter</p>
          : <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/3">
                  <tr><Th>Stellar Address</Th><Th>Amount</Th><Th>Asset</Th><Th>Type</Th><Th>Target</Th><Th>TX Hash</Th><Th>Verified</Th><Th>Date</Th><Th /></tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {filteredDonations.map(d => {
                    const w = walletById[d.wallet_id]
                    return (
                      <tr key={d.id} className="hover:bg-white/3">
                        <Td mono><span className="text-xs text-gray-300">{w?.stellar_address ? shortAddr(w.stellar_address) : d.wallet_id.slice(-8)}</span></Td>
                        <Td><span className="font-semibold text-yellow-400">{num(d.amount)}</span></Td>
                        <Td><span className="text-gray-300">{d.asset_code}</span></Td>
                        <Td><DonationTypeBadge type={d.donation_type} /></Td>
                        <Td>
                          {d.donation_target
                            ? <span className="font-bold text-[#D4AF37] text-sm">{d.donation_target}</span>
                            : <span className="text-gray-500 italic text-sm">General</span>}
                        </Td>
                        <Td mono><span className="text-xs text-gray-500">{d.stellar_tx_hash ? `${d.stellar_tx_hash.slice(0, 16)}…` : '—'}</span></Td>
                        <Td><Badge color={d.verified ? 'green' : 'yellow'}>{d.verified ? 'Verified' : 'Pending'}</Badge></Td>
                        <Td><span className="text-gray-500 text-xs">{dt(d.created_at)}</span></Td>
                        <Td>
                          {!d.verified && (
                            <button onClick={() => onVerify(d.id)} disabled={verifyingId === d.id}
                              className="text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded transition whitespace-nowrap disabled:opacity-40">
                              {verifyingId === d.id ? '…' : 'Mark Verified'}
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
