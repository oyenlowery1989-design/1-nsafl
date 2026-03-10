export interface TierRewards {
  physicalBanks: number
  dailyCrypto: { xlm: number; xrp: number; usdc: number }
  dailyMetals: { gold: number; silver: number }
  cryptoAtms?: number
  cardDeployment?: number
  treasury?: string           // e.g. "$100M", "$1B"
  additionalMinting?: string  // e.g. "$100M/day"
}

export interface Tier {
  id: string                  // 'pre-tier', 'tier-1', ..., 'tier-12'
  label: string               // e.g. 'Tier 1', 'Tier 12'
  emoji: string
  minBalance: number
  maxBalance: number | null   // null for tier-12
  color: string               // badge/accent color hex
  glowColor: string           // rgba for box-shadow glow
  icon: string                // material symbol icon name
  rewards: TierRewards | null // null for pre-tier
}

export const TIERS: Tier[] = [
  {
    id: 'pre-tier',
    label: 'Pre-Tier',
    emoji: '🌱',
    minBalance: 0,
    maxBalance: 49,
    color: '#6B7280',
    glowColor: 'rgba(107,114,128,0.3)',
    icon: 'sprout',
    rewards: null,
  },
  {
    id: 'tier-1',
    label: 'Tier 1',
    emoji: '🔴',
    minBalance: 50,
    maxBalance: 999,
    color: '#F97316',
    glowColor: 'rgba(249,115,22,0.3)',
    icon: 'local_fire_department',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '0.05% share — 11 exchanges',
    },
  },
  {
    id: 'tier-2',
    label: 'Tier 2',
    emoji: '🔴',
    minBalance: 1000,
    maxBalance: 2499,
    color: '#F97316',
    glowColor: 'rgba(249,115,22,0.3)',
    icon: 'local_fire_department',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '1% share — 15 exchanges',
    },
  },
  {
    id: 'tier-3',
    label: 'Tier 3',
    emoji: '🔴',
    minBalance: 2500,
    maxBalance: 4999,
    color: '#D4AF37',
    glowColor: 'rgba(212,175,55,0.3)',
    icon: 'workspace_premium',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '5% share — 23 exchanges',
    },
  },
  {
    id: 'tier-4',
    label: 'Tier 4',
    emoji: '🔴',
    minBalance: 5000,
    maxBalance: 9999,
    color: '#D4AF37',
    glowColor: 'rgba(212,175,55,0.3)',
    icon: 'workspace_premium',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '15% share — 25 exchanges',
    },
  },
  {
    id: 'tier-5',
    label: 'Tier 5',
    emoji: '🔴',
    minBalance: 10000,
    maxBalance: 24999,
    color: '#A78BFA',
    glowColor: 'rgba(167,139,250,0.3)',
    icon: 'bolt',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '33.33% share — 25 exchanges',
    },
  },
  {
    id: 'tier-6',
    label: 'Tier 6',
    emoji: '🔴',
    minBalance: 25000,
    maxBalance: 49999,
    color: '#A78BFA',
    glowColor: 'rgba(167,139,250,0.3)',
    icon: 'bolt',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '55% share — 25 exchanges',
    },
  },
  {
    id: 'tier-7',
    label: 'Tier 7',
    emoji: '🔴',
    minBalance: 50000,
    maxBalance: 99999,
    color: '#38BDF8',
    glowColor: 'rgba(56,189,248,0.3)',
    icon: 'diamond',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '69% share — 25 exchanges',
    },
  },
  {
    id: 'tier-8',
    label: 'Tier 8',
    emoji: '🔴',
    minBalance: 100000,
    maxBalance: 249999,
    color: '#38BDF8',
    glowColor: 'rgba(56,189,248,0.3)',
    icon: 'star',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '81% share — 25 exchanges',
    },
  },
  {
    id: 'tier-9',
    label: 'Tier 9',
    emoji: '👑',
    minBalance: 250000,
    maxBalance: null,
    color: '#34D399',
    glowColor: 'rgba(52,211,153,0.3)',
    icon: 'crown',
    rewards: {
      physicalBanks: 0,
      dailyCrypto: { xlm: 0, xrp: 0, usdc: 0 },
      dailyMetals: { gold: 0, silver: 0 },
      treasury: '🔥 To be revealed — 99%+',
    },
  },
]

export function getTierForBalance(balance: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const tier = TIERS[i]
    if (balance >= tier.minBalance) {
      return tier
    }
  }
  return TIERS[0] // pre-tier fallback
}

export function getNextTier(current: Tier): Tier | null {
  const idx = TIERS.findIndex((t) => t.id === current.id)
  if (idx === -1 || idx === TIERS.length - 1) return null
  return TIERS[idx + 1]
}

/**
 * Format large numbers for display:
 * 476836874 → "476.8M"
 * 781250    → "781.3K"
 * 75        → "75"
 */
export function formatReward(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return `${n}`
}
