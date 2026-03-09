export interface Tier {
  id: string
  label: string
  minBalance: number
  color: string
  icon: string
}

export const TIERS: Tier[] = [
  { id: 'pre-tier', label: 'Pre-Tier', minBalance: 0, color: '#6B7280', icon: 'star_border' },
  { id: 'tier-1', label: 'Foundation', minBalance: 100, color: '#F97316', icon: 'shield' },
  { id: 'tier-2', label: 'Elite', minBalance: 501, color: '#A78BFA', icon: 'verified' },
  { id: 'tier-3', label: 'Gold Legacy', minBalance: 1001, color: '#D4AF37', icon: 'star' },
  { id: 'tier-4', label: 'Platinum', minBalance: 2501, color: '#E2E8F0', icon: 'workspace_premium' },
]

export function getTierForBalance(balance: number): Tier {
  const reversed = [...TIERS].reverse()
  return reversed.find((t) => balance >= t.minBalance) ?? TIERS[0]
}
