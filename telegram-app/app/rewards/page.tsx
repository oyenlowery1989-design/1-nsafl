'use client'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance, getNextTier, TIERS, type Tier } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

function getTierStatus(tier: Tier, currentTier: Tier, nextTier: Tier | null): 'current' | 'past' | 'next' | 'locked' {
  if (tier.id === currentTier.id) return 'current'
  const tierIdx = TIERS.findIndex((t) => t.id === tier.id)
  const currentIdx = TIERS.findIndex((t) => t.id === currentTier.id)
  if (tierIdx < currentIdx) return 'past'
  if (nextTier && tier.id === nextTier.id) return 'next'
  return 'locked'
}

function TierCard({ tier, status, balance, nextTier, progressPct, onBuy }: {
  tier: Tier
  status: 'current' | 'past' | 'next' | 'locked'
  balance: number
  nextTier?: Tier | null
  progressPct?: number
  onBuy?: () => void
}) {
  const r = tier.rewards
  const isCurrent = status === 'current'
  const isLocked = status === 'locked'
  const isNext = status === 'next'

  return (
    <div
      className={`rounded-xl p-3 relative overflow-hidden${isLocked ? ' opacity-40' : ''}`}
      style={{
        background: isCurrent ? `linear-gradient(135deg, ${tier.color}18, #0A0E1A)` : 'rgba(255,255,255,0.02)',
        border: isCurrent ? `1px solid ${tier.color}66` : isNext ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isCurrent ? `0 0 20px ${tier.color}22` : 'none',
      }}
    >
      {isCurrent && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{tier.emoji}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white leading-none">{tier.label}</h3>
              {isCurrent && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full text-black leading-none" style={{ background: tier.color }}>YOU</span>}
              {isNext && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-black leading-none">NEXT</span>}
              {status === 'past' && <span className="material-symbols-outlined text-sm" style={{ color: tier.color, fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
              {isLocked && <span className="material-symbols-outlined text-xs text-gray-500">lock</span>}
            </div>
            <p className="text-[9px] text-gray-500 mt-0.5">
              {tier.maxBalance
                ? `${tier.minBalance.toLocaleString()}–${tier.maxBalance.toLocaleString()} ${PRIMARY_CUSTOM_ASSET_LABEL}`
                : `${tier.minBalance.toLocaleString()}+ ${PRIMARY_CUSTOM_ASSET_LABEL}`}
            </p>
          </div>
        </div>
      </div>

      {/* Rewards */}
      {r === null ? (
        <p className="text-[10px] text-gray-500">Hold 100 {PRIMARY_CUSTOM_ASSET_LABEL} to unlock Tier 1.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {[
            { icon: 'currency_exchange', label: `+${r.xlmRefundPct}% XLM` },
            { icon: 'hub',               label: `×${r.trustlineMultiplier} Trustline` },
            { icon: 'diamond',           label: `${r.gold.toLocaleString()} GOLD` },
            { icon: 'toll',              label: `${r.silver.toLocaleString()} SILVER` },
            { icon: 'generating_tokens', label: `${r.copper.toLocaleString()} COPPER` },
            ...(r.physicalGold ? [{ icon: 'local_shipping', label: '1 Physical Gold/mo' }] : []),
          ].map(({ icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
              style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}30`, color: tier.color }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Progress + buy for current tier */}
      {isCurrent && nextTier && progressPct !== undefined && (
        <div className="mt-2.5 pt-2.5 border-t border-white/8">
          <div className="flex items-center justify-between text-[9px] mb-1">
            <span className="text-gray-500">{(nextTier.minBalance - balance).toLocaleString()} more → {nextTier.label}</span>
            <span className="font-bold" style={{ color: tier.color }}>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/8 overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})` }} />
          </div>
          {onBuy && (
            <button onClick={onBuy}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-black transition active:scale-[0.98]"
              style={{ background: tier.color }}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              Buy {PRIMARY_CUSTOM_ASSET_LABEL} — Level Up
            </button>
          )}
        </div>
      )}

      {isCurrent && !nextTier && (
        <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-white/8 text-center">👑 Maximum tier reached</p>
      )}

      {isNext && (
        <p className="text-[9px] text-amber-400 font-semibold mt-2 pt-2 border-t border-white/8">
          🔥 {(tier.minBalance - balance).toLocaleString()} more {PRIMARY_CUSTOM_ASSET_LABEL} to unlock
        </p>
      )}
    </div>
  )
}

export default function RewardsPage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const ready = useMinLoader(true)
  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const balance = parseFloat(tokenBalance) || 0
  const currentTier = getTierForBalance(balance)
  const nextTier = getNextTier(currentTier)
  const progressPct = nextTier
    ? Math.min(100, ((balance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100)
    : 100

  if (!ready) {
    return (
      <WalletGuard>
        <PageLoader label="Loading rewards…" />
        <BottomNav />
      </WalletGuard>
    )
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[18px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Rewards</h1>
            <p className="text-[10px] text-[#D4AF37]">Exchange Shares &amp; Tier Roadmap</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-3 pb-32 space-y-4">

        {/* Tier list */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Exchange Share Tiers</p>
          {TIERS.filter((tier) => getTierStatus(tier, currentTier, nextTier) !== 'past').map((tier) => {
            const status = getTierStatus(tier, currentTier, nextTier)
            return (
              <TierCard
                key={tier.id}
                tier={tier}
                status={status}
                balance={balance}
                nextTier={status === 'current' ? nextTier : undefined}
                progressPct={status === 'current' ? progressPct : undefined}
                onBuy={status === 'current' && nextTier ? () => router.push('/buy') : undefined}
              />
            )
          })}
        </div>

        {/* Donate CTA — compact */}
        <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 px-3 py-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#D4AF37] text-xl flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight mb-0.5">Support the Movement</p>
              <p className="text-[10px] text-gray-400 leading-snug">Donate {PRIMARY_CUSTOM_ASSET_LABEL} to AFL homecoming campaigns. Top donors featured on the board.</p>
              <div className="flex gap-1.5 mt-2">
                {['AFL General', 'A Team', 'A Player'].map((label) => (
                  <span key={label} className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' }}>{label}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => router.push('/donate')}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-bold active:scale-[0.98] transition">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
            Donate Now
          </button>
        </div>

        {/* Donation history */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 mb-2">Donation History</p>
          <div className="glass-card rounded-xl flex flex-col items-center justify-center py-10 text-center space-y-2 border border-white/6">
            <span className="material-symbols-outlined text-2xl text-gray-600">receipt_long</span>
            <p className="text-xs font-semibold text-gray-400">No donations yet</p>
            <p className="text-[10px] text-gray-600 max-w-[200px] leading-relaxed">Your donation history will appear here.</p>
          </div>
        </div>

      </main>
      <BottomNav />
    </WalletGuard>
  )
}
