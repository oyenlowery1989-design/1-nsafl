'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { useWalletStore } from '@/hooks/useStore'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface TxDisplay {
  label: string
  amount: string
  date: string
  isIncoming: boolean
  icon: string
}

export default function ProfilePage() {
  const { stellarAddress, nsaflBalance, disconnect } = useWalletStore()
  const [copied, setCopied] = useState(false)
  const [txns, setTxns] = useState<TxDisplay[]>([])

  useEffect(() => {
    if (!stellarAddress) return
    fetch(`/api/stellar/transactions?address=${stellarAddress}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.records.length > 0) {
          interface HorizonPayment { to: string; amount?: string; asset_code?: string; created_at: string }
          const mapped: TxDisplay[] = j.data.records.slice(0, 5).map((r: HorizonPayment) => {
            const isIncoming = r.to === stellarAddress
            return {
              label: isIncoming ? 'Deposit' : 'Send',
              amount: `${r.amount ?? '?'} ${r.asset_code ?? 'XLM'}`,
              date: new Date(r.created_at).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric',
              }),
              isIncoming,
              icon: isIncoming ? 'south_west' : 'north_east',
            }
          })
          setTxns(mapped)
        }
      })
  }, [stellarAddress])

  function copyAddress() {
    if (!stellarAddress) return
    navigator.clipboard.writeText(stellarAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const short = stellarAddress
    ? `${stellarAddress.slice(0, 4)}...${stellarAddress.slice(-4)}`
    : 'Not connected'

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button onClick={() => history.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Wallet Profile</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Stellar Network</p>
          </div>
        </div>
      </header>
      <main className="px-6 py-6 space-y-6 pb-32">
        <div className="glass-card p-6 rounded-2xl flex flex-col items-center space-y-4 border-t-2 border-t-[#D4AF37]/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D4AF37]/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center border border-[#D4AF37]/30 z-10">
            <span className="material-symbols-outlined text-3xl text-[#D4AF37]">account_balance_wallet</span>
          </div>
          <div className="text-center z-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {nsaflBalance} <span className="text-xl text-[#D4AF37]">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1">Available Balance</p>
          </div>
          {stellarAddress && (
            <div className="flex items-center space-x-2 bg-black/30 px-4 py-2 rounded-lg border border-white/5 z-10">
              <span className="text-xs font-mono text-gray-300">{short}</span>
              <button onClick={copyAddress} className="text-gray-400 hover:text-[#D4AF37] transition">
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Transaction History</h3>
            <button className="text-xs text-[#D4AF37] font-medium hover:underline">View All</button>
          </div>
          {txns.length === 0 ? (
            <div className="glass-card p-4 rounded-xl text-center text-gray-400 text-sm">
              No transactions found
            </div>
          ) : (
            txns.map((tx, i) => (
              <div key={i} className="glass-card p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${tx.isIncoming ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <span className={`material-symbols-outlined text-sm ${tx.isIncoming ? 'text-green-400' : 'text-red-400'}`}>{tx.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{tx.label}</h4>
                    <p className="text-[10px] text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.isIncoming ? 'text-green-400' : 'text-white'}`}>{tx.amount}</p>
                  <p className="text-[10px] text-gray-500 font-mono">Completed</p>
                </div>
              </div>
            ))
          )}
        </div>
        <button
          onClick={disconnect}
          className="w-full glass-card border border-white/10 rounded-xl py-4 flex items-center justify-center space-x-2 hover:bg-white/5 transition text-white"
        >
          <span className="material-symbols-outlined text-gray-400 text-sm">link_off</span>
          <span className="text-sm font-semibold">Disconnect Wallet</span>
        </button>
      </main>
      <BottomNav />
    </>
  )
}
