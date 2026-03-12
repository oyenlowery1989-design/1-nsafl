'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance, getNextTier, TIERS, type Tier } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { haptic } from '@/lib/telegram-ui'


function getTierStatus(tier: Tier, currentTier: Tier, nextTier: Tier | null): 'current' | 'past' | 'next' | 'locked' {
  if (tier.id === currentTier.id) return 'current'
  const tierIdx = TIERS.findIndex((t) => t.id === tier.id)
  const currentIdx = TIERS.findIndex((t) => t.id === currentTier.id)
  if (tierIdx < currentIdx) return 'past'
  if (nextTier && tier.id === nextTier.id) return 'next'
  return 'locked'
}

interface TierCardProps {
  tier: Tier
  status: 'current' | 'past' | 'next' | 'locked'
  balance: number
  nextTier?: Tier | null
  progressPct?: number
  onBuy?: () => void
}

function TierCard({ tier, status, balance, nextTier, progressPct, onBuy }: TierCardProps) {
  const r = tier.rewards
  const toUnlock = tier.minBalance - balance

  const isLocked = status === 'locked'

  const borderStyle =
    status === 'current'
      ? { border: `1.5px solid ${tier.color}`, boxShadow: `0 0 24px ${tier.glowColor}` }
      : status === 'next'
      ? { border: '1px solid rgba(245,158,11,0.35)' }
      : { border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div
      className={`glass-card rounded-xl p-4${isLocked ? ' opacity-40' : ''}`}
      style={borderStyle}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{tier.emoji}</span>
          <div>
            <h3 className="font-bold text-white text-base leading-tight">{tier.label}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {tier.maxBalance
                ? `${tier.minBalance.toLocaleString()} – ${tier.maxBalance.toLocaleString()} ${PRIMARY_CUSTOM_ASSET_LABEL}`
                : `${tier.minBalance.toLocaleString()}+ ${PRIMARY_CUSTOM_ASSET_LABEL}`}
            </p>
          </div>
        </div>
        <div>
          {status === 'current' && (
            <span
              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-black tracking-wide"
              style={{ background: tier.color }}
            >
              YOUR TIER
            </span>
          )}
          {status === 'next' && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/90 text-black tracking-wide">
              NEXT
            </span>
          )}
          {status === 'past' && (
            <span className="material-symbols-outlined text-lg" style={{ color: tier.color, fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          )}
          {isLocked && (
            <span className="material-symbols-outlined text-base text-gray-500">lock</span>
          )}
        </div>
      </div>

      {/* Reward grid — always shown (locked tiers are dimmed by parent opacity) */}
      {r === null ? (
        <p className="text-xs text-gray-400">Hold 100 {PRIMARY_CUSTOM_ASSET_LABEL} to unlock Tier 1.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: 'currency_exchange', label: 'XLM Refund',    value: `+${r.xlmRefundPct}%` },
            { icon: 'hub',              label: 'Trustline',       value: `X${r.trustlineMultiplier}` },
            { icon: 'diamond',          label: 'Gold',            value: r.gold.toLocaleString() },
            { icon: 'toll',             label: 'Silver',          value: r.silver.toLocaleString() },
            { icon: 'generating_tokens',label: 'Copper',          value: r.copper.toLocaleString() },
            ...(r.physicalGold ? [{ icon: 'local_shipping', label: 'Physical Gold', value: '1 / mo' }] : []),
          ].map(({ icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span
                className="material-symbols-outlined text-xl flex-shrink-0"
                style={{ color: tier.color, fontVariationSettings: "'FILL' 1" }}
              >
                {icon}
              </span>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold leading-none mb-0.5">{label}</p>
                <p className="text-sm text-white font-bold truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current tier — progress + Buy Now */}
      {status === 'current' && nextTier && progressPct !== undefined && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-gray-400">
              <span style={{ color: tier.color }} className="font-semibold">
                {(nextTier.minBalance - balance).toLocaleString()} {PRIMARY_CUSTOM_ASSET_LABEL}
              </span>
              {' '}to {nextTier.label}
            </span>
            <span style={{ color: tier.color }} className="font-bold">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-[#0A0E1A] rounded-full h-1.5 border border-white/10">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${tier.color}99, ${tier.color})`, boxShadow: `0 0 6px ${tier.color}80` }}
            />
          </div>
          {onBuy && (
            <button
              onClick={onBuy}
              className="mt-1 w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-bold text-black transition active:scale-[0.98] shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
              style={{ background: tier.color }}
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              <span>Buy {PRIMARY_CUSTOM_ASSET_LABEL} — Level Up</span>
            </button>
          )}
        </div>
      )}

      {/* Max tier */}
      {status === 'current' && !nextTier && (
        <div className="mt-3 pt-3 border-t border-white/10 text-center">
          <p className="text-xs text-gray-400">You&apos;ve reached the top tier! Maximum stock exchange share unlocked.</p>
          {onBuy && (
            <button
              onClick={onBuy}
              className="mt-2 w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: tier.color }}
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              <span>Buy {PRIMARY_CUSTOM_ASSET_LABEL} &amp; Level Up</span>
            </button>
          )}
        </div>
      )}

      {/* Next tier unlock prompt */}
      {status === 'next' && toUnlock > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 text-center">
          <p className="text-[11px] text-amber-400 font-semibold">
            Hold {toUnlock.toLocaleString()} more {PRIMARY_CUSTOM_ASSET_LABEL} to unlock! 🔥
          </p>
        </div>
      )}
    </div>
  )
}

function DonateCTA({ onNavigate }: { onNavigate: () => void }) {
  return (
    <section>
      <div className="flex items-center space-x-2 mb-3">
        <span className="material-symbols-outlined text-[#D4AF37]">volunteer_activism</span>
        <h3 className="text-xl font-bold text-white">Support the Movement</h3>
      </div>
      <div className="glass-card p-4 rounded-xl space-y-3" style={{ borderLeft: '3px solid #D4AF37' }}>
        <p className="text-sm text-gray-300 leading-relaxed">
          Donate {PRIMARY_CUSTOM_ASSET_LABEL} to support AFL homecoming campaigns — back a team, a player, or the general movement. Top donors get featured on the <span className="text-[#D4AF37] font-semibold">Top Supporters</span> board.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { icon: 'sports_football', label: 'AFL General' },
            { icon: 'stadium',         label: 'A Team' },
            { icon: 'person',          label: 'A Player' },
          ]).map(({ icon, label }) => (
            <div key={icon} className="glass-card p-2.5 rounded-xl text-center border border-white/8">
              <span className="material-symbols-outlined text-[#D4AF37] text-lg">{icon}</span>
              <p className="text-[9px] text-gray-400 mt-1 font-semibold">{label}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm active:scale-[0.98] transition shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
          Donate Now
        </button>
      </div>
    </section>
  )
}

export default function RewardsPage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const ready = useMinLoader(true)
  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const stellarAddress = useWalletStore((s) => s.stellarAddress)
  const balance = parseFloat(tokenBalance) || 0
  const currentTier = getTierForBalance(balance)
  const nextTier = getNextTier(currentTier)
  const toNext = nextTier ? nextTier.minBalance - balance : 0
  const progressPct = nextTier
    ? Math.min(
        100,
        ((balance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100,
      )
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
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Rewards</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Stock Exchange Shares &amp; Tier Roadmap</p>
          </div>
        </div>
      </header>

      <main className="px-6 pt-4 pb-32 space-y-6">

        {/* Section 1 — Tier Roadmap */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-[#D4AF37]">show_chart</span>
            <h3 className="text-xl font-bold text-white">Exchange Share Tiers</h3>
          </div>
          <div className="space-y-3">
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
        </section>

        {/* Section 3 — Support the Movement (Donations) */}
        <DonateCTA onNavigate={() => router.push('/donate')} />

        {/* Section 4 — Donation History (empty state) */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-[#D4AF37]">receipt_long</span>
            <h3 className="text-xl font-bold text-white">Donation History</h3>
          </div>
          <div className="glass-card rounded-xl">
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="material-symbols-outlined text-2xl text-gray-500">receipt_long</span>
              </div>
              <p className="text-sm font-semibold text-gray-300">No donations yet</p>
              <p className="text-xs text-gray-500 max-w-[220px] leading-relaxed">Your donation history will appear here.</p>
            </div>
          </div>
        </section>

      </main>

      <BottomNav />
    </WalletGuard>
  )
}
