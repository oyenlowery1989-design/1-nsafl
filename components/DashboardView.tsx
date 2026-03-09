'use client'
import BalanceCard from './_dashboard/BalanceCard'
import BottomNav from './BottomNav'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface Props {
  address: string
  balance: string
}

const FEATURED_PLAYERS = [
  {
    name: 'J. Smith', position: 'Midfielder', club: 'Swan Districts',
    status: 'Signed', statusColor: 'green', borderColor: 'border-l-green-500',
    est: '25k',
  },
  {
    name: 'T. Kelly', position: 'Forward', club: 'South Fremantle',
    status: 'In Talks', statusColor: 'orange', borderColor: 'border-l-orange-500',
    est: '18k',
  },
]

export default function DashboardView({ address, balance }: Props) {
  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D4AF37]">sports_football</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">The Homecoming Hub</h1>
              <p className="text-xs text-[#D4AF37] font-medium">NSAFL Dashboard</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-white/10 transition relative">
            <span className="material-symbols-outlined text-white">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0A0E1A]" />
          </button>
        </div>
      </header>
      <main className="px-6 py-6 space-y-8 pb-32">
        <BalanceCard balance={balance} address={address} />
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Quick Stats</h3>
            <button className="text-sm text-[#D4AF37] hover:text-white transition">View All</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center mb-3">
                <span className="text-blue-400 font-bold text-lg">WCE</span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">42</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Active Targets</p>
            </div>
            <div className="glass-card rounded-xl p-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center mb-3">
                <span className="text-purple-400 font-bold text-lg">FRE</span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">28</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide">In Negotiations</p>
            </div>
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Featured Homecoming</h3>
          </div>
          <div className="space-y-4">
            {FEATURED_PLAYERS.map((p) => (
              <div
                key={p.name}
                className={`glass-card p-4 rounded-xl flex items-center justify-between border-l-4 ${p.borderColor}`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-[#D4AF37]/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#D4AF37]">person</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    <p className="text-xs text-gray-400">{p.position} • {p.club}</p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase border ${p.statusColor === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                        {p.status}
                      </span>
                      <span className="text-[10px] text-gray-500">Est: {p.est} {PRIMARY_CUSTOM_ASSET_LABEL}</span>
                    </div>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition">
                  <span className="material-symbols-outlined text-[#D4AF37] text-sm">chevron_right</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
