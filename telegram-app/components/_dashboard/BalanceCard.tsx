'use client'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import TierBadge from '@/components/TierBadge'
import { getTierForBalance, getNextTier } from '@/config/tiers'

interface Props {
  balance: string
  address: string
  xlmBalance?: string
}

export default function BalanceCard({ balance, address, xlmBalance }: Props) {
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`
  const numericBalance = parseFloat(balance) || 0
  const currentTier = getTierForBalance(numericBalance)
  const nextTier = getNextTier(currentTier)

  let progressPct = 0
  let neededLabel: string | null = null

  if (nextTier) {
    const range = nextTier.minBalance - currentTier.minBalance
    const progress = numericBalance - currentTier.minBalance
    progressPct = Math.min(100, Math.max(0, (progress / range) * 100))
    const needed = Math.ceil(nextTier.minBalance - numericBalance)
    neededLabel = `${needed.toLocaleString()} more ${PRIMARY_CUSTOM_ASSET_LABEL} to ${nextTier.label} (${nextTier.name})`
  }

  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-[#D4AF37]/30 shadow-[0_8px_32px_rgba(212,175,55,0.15)]">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl" />
      <div className="relative z-10">
        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
          Legacy Wallet
        </p>
        <div className="flex items-center space-x-2 bg-black/30 rounded-full px-3 py-1 border border-white/10 w-fit mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-300 font-mono">{short}</span>
        </div>
        <h2 className="text-4xl font-bold text-white mb-1">
          {balance}{' '}
          <span className="text-2xl text-[#D4AF37] font-sans font-semibold">
            {PRIMARY_CUSTOM_ASSET_LABEL}
          </span>
        </h2>
        <TierBadge balance={balance} />

        {/* Tier Progress Bar */}
        <div className="mt-3">
          {nextTier ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">{currentTier.label}</span>
                <span className="text-[10px] text-gray-500">{nextTier.label}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-[#D4AF37] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {neededLabel && (
                <p className="text-[10px] text-gray-500 mt-1">{neededLabel}</p>
              )}
            </>
          ) : (
            <p className="text-[10px] text-[#D4AF37] font-semibold">Maximum tier reached 👑</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
          <span className="text-xs text-gray-400 flex items-center space-x-1">
            <span className="material-symbols-outlined text-[14px]">currency_exchange</span>
            <span>XLM</span>
          </span>
          <span className="text-sm font-semibold text-gray-300">{xlmBalance ?? '0.00'}</span>
        </div>
      </div>
    </div>
  )
}
