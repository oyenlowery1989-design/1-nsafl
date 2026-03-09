'use client'
import BottomNav from '@/components/BottomNav'
import RewardsCard from '@/components/RewardsCard'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance, TIERS } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

const REWARDS = {
  legendary: [
    { name: 'Optus Stadium VIP Box', description: 'Exclusive 10-person suite for the Derby', cost: '500k', available: true },
    { name: 'Signed West Coast Eagles Guernsey', description: 'Authentic 2024 team signed kit', cost: '150k', available: true },
  ],
  elite: [
    { name: 'Premium Match Tickets', description: '2x Level 1 seating for selected games', cost: '50k', available: false },
  ],
  foundation: [
    { name: 'Fan Merchandise Pack', description: 'Cap, scarf, and exclusive pin', cost: '10k', available: false },
  ],
}

export default function RewardsPage() {
  const { nsaflBalance } = useWalletStore()
  const balance = parseFloat(nsaflBalance)
  const tier = getTierForBalance(balance)
  const tierIndex = TIERS.findIndex((t) => t.id === tier.id)
  const nextTier = tierIndex < TIERS.length - 1 ? TIERS[tierIndex + 1] : null

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button onClick={() => history.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Rewards Market</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Tiered Legacy</p>
          </div>
        </div>
      </header>
      <main className="px-6 py-6 space-y-8 pb-32">
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-8xl text-[#D4AF37]">workspace_premium</span>
          </div>
          <div className="relative z-10">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Current Tier</p>
            <h2 className="text-2xl font-bold text-[#D4AF37] mb-4">{tier.label}</h2>
            {nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-300">{balance.toFixed(0)} {PRIMARY_CUSTOM_ASSET_LABEL}</span>
                  <span className="text-gray-400">Next: {nextTier.label}</span>
                </div>
                <div className="w-full bg-[#0A0E1A] rounded-full h-2.5 border border-white/10">
                  <div
                    className="bg-[#D4AF37] h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (balance / nextTier.minBalance) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 text-right">
                  {nextTier.minBalance.toLocaleString()} {PRIMARY_CUSTOM_ASSET_LABEL} to unlock {nextTier.label} rewards
                </p>
              </div>
            )}
          </div>
        </div>
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-[#D4AF37]">star</span>
            <h3 className="text-xl font-bold text-white">Legendary</h3>
          </div>
          <div className="space-y-4">
            {REWARDS.legendary.map((r) => <RewardsCard key={r.name} {...r} />)}
          </div>
        </section>
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-gray-300">verified</span>
            <h3 className="text-xl font-bold text-white">Elite</h3>
          </div>
          <div className="space-y-4">
            {REWARDS.elite.map((r) => <RewardsCard key={r.name} {...r} />)}
          </div>
        </section>
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-orange-400">shield</span>
            <h3 className="text-xl font-bold text-white">Foundation</h3>
          </div>
          <div className="space-y-4">
            {REWARDS.foundation.map((r) => <RewardsCard key={r.name} {...r} />)}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
