'use client'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import TierBadge from '@/components/TierBadge'

interface Props {
  balance: string
  address: string
  xlmBalance?: string
}

export default function BalanceCard({ balance, address, xlmBalance }: Props) {
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`
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
