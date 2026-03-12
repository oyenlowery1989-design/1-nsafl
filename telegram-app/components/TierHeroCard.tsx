'use client'
import Link from 'next/link'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance, getNextTier, formatReward } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

export default function TierHeroCard() {
  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const isConnected = useWalletStore((s) => s.isConnected)

  const balance = parseFloat(tokenBalance) || 0
  const currentTier = getTierForBalance(balance)
  const nextTier = getNextTier(currentTier)

  const isMaxTier = nextTier === null
  const isPreTier = currentTier.id === 'pre-tier'

  const progressPct =
    nextTier && !isPreTier
      ? Math.min(100, Math.round(((balance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100))
      : isMaxTier ? 100 : 0

  const toNextTier =
    nextTier ? Math.max(0, nextTier.minBalance - balance) : 0

  return (
    <div
      className="glass-card rounded-2xl p-5 relative overflow-hidden border"
      style={{ borderColor: `${currentTier.color}4D`, background: '#0A0E1A' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -right-8 -top-8 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: currentTier.glowColor }}
      />

      {/* TOP — current tier */}
      <div className="relative z-10">
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-4xl leading-none">{currentTier.emoji}</span>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Your Tier</p>
            <h2 className="text-2xl font-serif font-bold leading-tight" style={{ color: currentTier.color }}>
              {currentTier.label} — {currentTier.name}
            </h2>
          </div>
        </div>

        {isPreTier || !isConnected ? (
          <div className="flex items-center space-x-2 py-3 px-4 rounded-xl bg-white/5 border border-white/10">
            <span className="material-symbols-outlined text-base" style={{ color: currentTier.color }}>info</span>
            <p className="text-sm text-gray-300 leading-snug">
              Hold <span className="font-semibold text-white">100 {PRIMARY_CUSTOM_ASSET_LABEL}</span> to unlock Tier 1
            </p>
          </div>
        ) : currentTier.rewards ? (
          <div className="flex flex-wrap gap-2">
            {/* XLM Refund */}
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-sm leading-none">currency_exchange</span>
              <span>+{currentTier.rewards.xlmRefundPct}% XLM Refund</span>
            </span>
            {/* Gold */}
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-sm leading-none">diamond</span>
              <span>{formatReward(currentTier.rewards.gold)} GOLD</span>
            </span>
            {/* Silver */}
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-sm leading-none">toll</span>
              <span>{formatReward(currentTier.rewards.silver)} SILVER</span>
            </span>
            {/* Trustline multiplier */}
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-sm leading-none">hub</span>
              <span>X{currentTier.rewards.trustlineMultiplier} Trustline</span>
            </span>
            {/* Physical gold badge for Tier 10 */}
            {currentTier.rewards.physicalGold && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#D4AF37]/50 bg-[#D4AF37]/20 text-[#D4AF37]">
                <span className="material-symbols-outlined text-sm leading-none">local_shipping</span>
                <span>1 Physical Gold / Month</span>
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Divider */}
      <div className="relative my-5 border-t border-white/10" style={{ boxShadow: `0 1px 0 ${currentTier.glowColor}` }} />

      {/* BOTTOM — next tier / max */}
      <div className="relative z-10">
        {isMaxTier ? (
          <div className="flex flex-col items-center text-center py-2 space-y-2">
            <p className="text-2xl">✨⭐️✨</p>
            <p className="text-base font-bold text-white">👑 Maximum Tier — Hall of Fame</p>
            <p className="text-xs text-gray-400">You&apos;ve reached the pinnacle of the {PRIMARY_CUSTOM_ASSET_LABEL} ecosystem.</p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-400">
                  {isPreTier || !isConnected
                    ? `Hold 100 ${PRIMARY_CUSTOM_ASSET_LABEL} to unlock ${nextTier!.label}`
                    : `${Math.round(toNextTier).toLocaleString()} more to unlock ${nextTier!.label} — ${nextTier!.name} 🔥`}
                </p>
                <span className="text-xs font-semibold" style={{ color: currentTier.color }}>
                  {isPreTier || !isConnected ? '0%' : `${progressPct}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${isPreTier || !isConnected ? 0 : progressPct}%`,
                    background: `linear-gradient(90deg, ${currentTier.color}99, ${currentTier.color})`,
                    boxShadow: `0 0 8px ${currentTier.color}80`,
                  }}
                />
              </div>
            </div>

            {/* Next tier teaser */}
            {isConnected && !isPreTier && nextTier?.rewards && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#D4AF37' }}>
                  <span className="material-symbols-outlined text-sm leading-none">trending_up</span>
                  <span>+{nextTier.rewards.xlmRefundPct}% XLM Refund at {nextTier.label}</span>
                </div>
              </div>
            )}

            <Link
              href="/buy"
              className="mt-3 flex items-center justify-center space-x-2 w-full py-3 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 transition active:scale-[0.98] shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              <span>Buy {PRIMARY_CUSTOM_ASSET_LABEL} — Level Up</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
