'use client'
import { useState } from 'react'
import { useWalletStore } from '@/hooks/useStore'
import DashboardView from '@/components/DashboardView'
import BottomNav from '@/components/BottomNav'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { isValidStellarAddress } from '@/lib/stellar'
import { getTelegramInitData } from '@/lib/telegram'

type Phase = 'gate' | 'connecting' | 'celebration' | 'dashboard'

export default function HomePage() {
  const { stellarAddress, nsaflBalance, isConnected, setWallet, setBalances } = useWalletStore()
  const [phase, setPhase] = useState<Phase>(isConnected ? 'dashboard' : 'gate')
  const [inputAddress, setInputAddress] = useState('')
  const [error, setError] = useState('')
  const [celebrationBalance, setCelebrationBalance] = useState('0.00')

  async function handleConnect() {
    const addr = inputAddress.trim()
    if (!isValidStellarAddress(addr)) {
      setError('Invalid Stellar address (must start with G, 56 characters)')
      return
    }
    setError('')
    setPhase('connecting')
    try {
      await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTelegramInitData(),
        },
        body: JSON.stringify({ stellarAddress: addr }),
      })
      const res = await fetch(`/api/stellar/balance?address=${addr}`)
      const json = await res.json()
      if (json.success) {
        setWallet(addr)
        setBalances(json.data.nsafl, json.data.xlm)
        setCelebrationBalance(json.data.nsafl)
      }
      setPhase('celebration')
    } catch {
      setError('Connection failed. Please try again.')
      setPhase('gate')
    }
  }

  if (phase === 'dashboard') {
    return <DashboardView address={stellarAddress!} balance={nsaflBalance} />
  }

  if (phase === 'celebration') {
    return (
      <CelebrationScreen
        address={inputAddress || stellarAddress!}
        balance={celebrationBalance}
        onEnter={() => setPhase('dashboard')}
      />
    )
  }

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37]">sports_football</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">The Homecoming Hub</h1>
            <p className="text-xs text-[#D4AF37] font-medium">NSAFL Dashboard</p>
          </div>
        </div>
      </header>
      <main className="px-6 py-6 space-y-8 pb-32">
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-[#D4AF37]/30">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="w-full flex justify-between items-start mb-6">
              <p className="text-sm text-gray-400 font-medium tracking-wide uppercase">Legacy Wallet</p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                <span className="material-symbols-outlined text-[12px] mr-1">link_off</span>
                Disconnected
              </span>
            </div>
            <div className="mb-6 text-center">
              <span className="material-symbols-outlined text-6xl text-[#D4AF37]/50 mb-4 block">account_balance_wallet</span>
              <p className="text-sm text-gray-300 max-w-xs mx-auto">
                Connect your Stellar wallet to view your {PRIMARY_CUSTOM_ASSET_LABEL} balance.
              </p>
            </div>
            <input
              type="text"
              placeholder="G... (your Stellar address)"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 font-mono mb-3 focus:outline-none focus:border-[#D4AF37]/50"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              onClick={handleConnect}
              disabled={phase === 'connecting'}
              className="w-full bg-[#D4AF37] text-black font-semibold py-4 rounded-xl text-base transition hover:bg-[#D4AF37]/90 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px] mr-2">account_balance_wallet</span>
              {phase === 'connecting' ? 'Connecting...' : 'Connect Stellar Wallet'}
            </button>
          </div>
        </div>
        <div className="opacity-60 pointer-events-none space-y-3">
          <h3 className="text-lg font-bold text-white">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <span className="material-symbols-outlined text-blue-400">stadium</span>
              </div>
              <p className="text-2xl font-bold text-white">-</p>
              <p className="text-xs text-gray-400">Clubs Supported</p>
            </div>
            <div className="glass-card rounded-xl p-5 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                <span className="material-symbols-outlined text-green-400">groups</span>
              </div>
              <p className="text-2xl font-bold text-white">-</p>
              <p className="text-xs text-gray-400">Players Funded</p>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}

function CelebrationScreen({
  address, balance, onEnter,
}: { address: string; balance: string; onEnter: () => void }) {
  const short = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '...'
  return (
    <main className="px-6 py-10 pb-32 flex flex-col items-center justify-center min-h-[100dvh] space-y-10">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-[#D4AF37]/30 rounded-full blur-3xl" />
        <div className="absolute inset-4 bg-[#D4AF37]/20 rounded-full blur-xl animate-pulse" />
        <div className="w-32 h-32 rounded-full border border-[#D4AF37]/50 bg-[#0A0E1A]/80 backdrop-blur-md flex items-center justify-center relative z-10 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
          <span className="material-symbols-outlined text-[72px] text-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,1)]">sports_football</span>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-[#0A0E1A] flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.6)]">
            <span className="material-symbols-outlined text-white text-[20px]">check</span>
          </div>
        </div>
      </div>
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-bold text-[#D4AF37] tracking-tight drop-shadow-md">Wallet Connected</h2>
        <p className="text-gray-400 text-sm max-w-[250px] mx-auto leading-relaxed">
          Your secure link to the Homecoming Hub has been established.
        </p>
      </div>
      <div className="w-full glass-card rounded-2xl p-6 border border-[#D4AF37]/40 bg-gradient-to-br from-white/10 to-transparent shadow-[0_8px_32px_rgba(212,175,55,0.2)]">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center px-3 py-1 mb-4 rounded-full text-[11px] font-semibold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 uppercase tracking-widest">
            <span className="material-symbols-outlined text-[14px] mr-1.5">workspace_premium</span>
            Legacy Wallet
          </span>
          <h3 className="text-4xl font-bold text-white mb-6">
            {balance} <span className="text-xl text-[#D4AF37]">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
          </h3>
          <div className="flex items-center space-x-3 bg-[#0A0E1A]/70 px-4 py-2.5 rounded-xl border border-white/10 w-full justify-center">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Stellar</span>
            <div className="w-px h-4 bg-white/20" />
            <span className="text-sm text-gray-200 font-mono">{short}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onEnter}
        className="w-full bg-[#D4AF37] text-[#0A0E1A] font-bold py-4 rounded-xl text-base hover:bg-[#D4AF37]/90 shadow-[0_0_20px_rgba(212,175,55,0.4)] uppercase tracking-wide flex items-center justify-center"
      >
        Enter Dashboard <span className="material-symbols-outlined ml-2 text-[20px]">arrow_forward</span>
      </button>
    </main>
  )
}
