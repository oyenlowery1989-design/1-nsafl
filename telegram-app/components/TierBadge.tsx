'use client'
import { getTierForBalance } from '@/config/tiers'

interface Props {
  /** Raw balance string or number */
  balance: string | number
  /** 'pill' = small inline badge (default), 'card' = larger card with progress */
  variant?: 'pill' | 'card'
  /** Override the balance-derived tier for static display */
  tierId?: string
}

/**
 * Reusable tier badge. Reads the tier from a balance and renders either a
 * compact pill or a card-style badge with colour and emoji.
 *
 * Usage:
 *   <TierBadge balance={tokenBalance} />
 *   <TierBadge balance={tokenBalance} variant="card" />
 */
export default function TierBadge({ balance, variant = 'pill' }: Props) {
  const numeric = typeof balance === 'string' ? parseFloat(balance) || 0 : balance
  const tier = getTierForBalance(numeric)

  if (variant === 'card') {
    return (
      <div
        className="inline-flex items-center space-x-2 px-3 py-2 rounded-xl border"
        style={{
          borderColor: `${tier.color}40`,
          background: `${tier.color}10`,
        }}
      >
        <span className="text-lg leading-none">{tier.emoji}</span>
        <div>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Tier</p>
          <p className="text-sm font-bold leading-none" style={{ color: tier.color }}>
            {tier.label}
          </p>
        </div>
      </div>
    )
  }

  // pill (default)
  return (
    <span
      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
      style={{
        color: tier.color,
        borderColor: `${tier.color}40`,
        background: `${tier.color}15`,
      }}
    >
      <span>{tier.emoji}</span>
      <span>{tier.label}</span>
    </span>
  )
}
