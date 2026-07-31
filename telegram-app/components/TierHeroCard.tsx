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
      className="glass-card rounded-2xl p-4 relative overflow-hidden border"
      style={{ borderColor: `${currentTier.color}4D`, background: '#0A0E1A' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -right-8 -top-8 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: currentTier.glowColor }}
      />

      {/* TOP — current tier */}
      <div className="relative z-10">
        <div className="flex items-center space-x-2.5 mb-3">
          <span className="text-2xl leading-none">{currentTier.emoji}</span>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Your Tier</p>
            <h2 className="text-base font-serif font-bold leading-tight" style={{ color: currentTier.color }}>
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
          <div className="flex flex-wrap gap-1.5">
            {/* XLM Refund */}
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-xs leading-none">currency_exchange</span>
              <span>+{currentTier.rewards.xlmRefundPct}% XLM Refund</span>
            </span>
            {/* Gold */}
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-xs leading-none">diamond</span>
              <span>{formatReward(currentTier.rewards.gold)} GOLD</span>
            </span>
            {/* Silver */}
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-xs leading-none">toll</span>
              <span>{formatReward(currentTier.rewards.silver)} SILVER</span>
            </span>
            {/* Trustline multiplier */}
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold border"
              style={{ background: `${currentTier.color}1A`, borderColor: `${currentTier.color}33`, color: currentTier.color }}>
              <span className="material-symbols-outlined text-xs leading-none">hub</span>
              <span>X{currentTier.rewards.trustlineMultiplier} Trustline</span>
            </span>
            {/* Physical gold badge for Tier 10 */}
            {currentTier.rewards.physicalGold && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-[#D4AF37]/50 bg-[#D4AF37]/20 text-[#D4AF37]">
                <span className="material-symbols-outlined text-xs leading-none">local_shipping</span>
                <span>1 Physical Gold / Month</span>
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Divider */}
      <div className="relative my-2 border-t border-white/10" />

      {/* BOTTOM — next tier / max */}
      <div className="relative z-10">
        {isMaxTier ? (
          <p className="text-xs font-bold text-center" style={{ color: currentTier.color }}>👑 Maximum Tier — Hall of Fame</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-400 truncate pr-2">
                {isPreTier || !isConnected
                  ? `Hold 100 ${PRIMARY_CUSTOM_ASSET_LABEL} to unlock Tier 1`
                  : `${Math.round(toNextTier).toLocaleString()} more → ${nextTier!.label}`}
              </p>
              <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: currentTier.color }}>
                {isPreTier || !isConnected ? '0%' : `${progressPct}%`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${isPreTier || !isConnected ? 0 : progressPct}%`,
                  background: `linear-gradient(90deg, ${currentTier.color}99, ${currentTier.color})`,
                }}
              />
            </div>
            <Link
              href="/buy"
              className="flex items-center justify-center space-x-1.5 w-full py-2 rounded-xl text-xs font-bold bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 transition active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              <span>Buy {PRIMARY_CUSTOM_ASSET_LABEL} — Level Up</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
