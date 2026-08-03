import type { Tier } from '@/config/tiers'

export default function TierBadge({ tier, className = '' }: { tier: Tier; className?: string }) {
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${className}`}
      style={{ color: tier.color, borderColor: `${tier.color}40`, background: `${tier.color}15` }}
    >
      {tier.label}
    </span>
  )
}
