export interface TierRewards {
  xlmRefundPct: number          // e.g. 20 = 20% XLM refund
  trustlineMultiplier: number   // e.g. 1, 2, 4, ...
  gold: number                  // oz
  silver: number                // oz
  copper: number                // units
  physicalGold?: boolean        // Tier 10 only — 1 oz/month delivered forever
}

export interface Tier {
  id: string
  label: string
  name: string                  // e.g. 'The Starter', 'The Legend'
  emoji: string
  minBalance: number
  maxBalance: number | null     // null for tier-10
  color: string
  glowColor: string
  icon: string
  rewards: TierRewards | null   // null for pre-tier
}

export const TIERS: Tier[] = [
  {
    id: 'pre-tier',
    label: 'Pre-Tier',
    name: 'Unranked',
    emoji: '🌱',
    minBalance: 0,
    maxBalance: 99,
    color: '#6B7280',
    glowColor: 'rgba(107,114,128,0.3)',
    icon: 'sprout',
    rewards: null,
  },
  {
    id: 'tier-1',
    label: 'Tier 1',
    name: 'The Starter',
    emoji: '💸',
    minBalance: 100,
    maxBalance: 500,
    color: '#F97316',
    glowColor: 'rgba(249,115,22,0.3)',
    icon: 'local_fire_department',
    rewards: {
      xlmRefundPct: 20,
      trustlineMultiplier: 1,
      gold: 5,
      silver: 40,
      copper: 500,
    },
  },
  {
    id: 'tier-2',
    label: 'Tier 2',
    name: 'The Builder',
    emoji: '💸',
    minBalance: 501,
    maxBalance: 1500,
    color: '#FB923C',
    glowColor: 'rgba(251,146,60,0.3)',
    icon: 'construction',
    rewards: {
      xlmRefundPct: 35,
      trustlineMultiplier: 2,
      gold: 15,
      silver: 120,
      copper: 2000,
    },
  },
  {
    id: 'tier-3',
    label: 'Tier 3',
    name: 'The Networker',
    emoji: '💸',
    minBalance: 1501,
    maxBalance: 4000,
    color: '#FBBF24',
    glowColor: 'rgba(251,191,36,0.3)',
    icon: 'hub',
    rewards: {
      xlmRefundPct: 50,
      trustlineMultiplier: 4,
      gold: 50,
      silver: 400,
      copper: 8000,
    },
  },
  {
    id: 'tier-4',
    label: 'Tier 4',
    name: 'The Operator',
    emoji: '💸',
    minBalance: 4001,
    maxBalance: 8000,
    color: '#D4AF37',
    glowColor: 'rgba(212,175,55,0.3)',
    icon: 'settings_suggest',
    rewards: {
      xlmRefundPct: 65,
      trustlineMultiplier: 8,
      gold: 150,
      silver: 1200,
      copper: 25000,
    },
  },
  {
    id: 'tier-5',
    label: 'Tier 5',
    name: 'The Director',
    emoji: '💸',
    minBalance: 8001,
    maxBalance: 15000,
    color: '#A78BFA',
    glowColor: 'rgba(167,139,250,0.3)',
    icon: 'manage_accounts',
    rewards: {
      xlmRefundPct: 80,
      trustlineMultiplier: 16,
      gold: 500,
      silver: 4000,
      copper: 75000,
    },
  },
  {
    id: 'tier-6',
    label: 'Tier 6',
    name: 'The Executive',
    emoji: '💸',
    minBalance: 15001,
    maxBalance: 25000,
    color: '#818CF8',
    glowColor: 'rgba(129,140,248,0.3)',
    icon: 'business_center',
    rewards: {
      xlmRefundPct: 100,
      trustlineMultiplier: 32,
      gold: 2000,
      silver: 15000,
      copper: 250000,
    },
  },
  {
    id: 'tier-7',
    label: 'Tier 7',
    name: 'The Ambassador',
    emoji: '💸',
    minBalance: 25001,
    maxBalance: 40000,
    color: '#38BDF8',
    glowColor: 'rgba(56,189,248,0.3)',
    icon: 'public',
    rewards: {
      xlmRefundPct: 125,
      trustlineMultiplier: 64,
      gold: 8000,
      silver: 60000,
      copper: 1000000,
    },
  },
  {
    id: 'tier-8',
    label: 'Tier 8',
    name: 'The Architect',
    emoji: '💸',
    minBalance: 40001,
    maxBalance: 60000,
    color: '#34D399',
    glowColor: 'rgba(52,211,153,0.3)',
    icon: 'architecture',
    rewards: {
      xlmRefundPct: 150,
      trustlineMultiplier: 128,
      gold: 25000,
      silver: 200000,
      copper: 5000000,
    },
  },
  {
    id: 'tier-9',
    label: 'Tier 9',
    name: 'The Sovereign',
    emoji: '💸',
    minBalance: 60001,
    maxBalance: 100000,
    color: '#F472B6',
    glowColor: 'rgba(244,114,182,0.3)',
    icon: 'shield_star',
    rewards: {
      xlmRefundPct: 200,
      trustlineMultiplier: 256,
      gold: 80000,
      silver: 600000,
      copper: 20000000,
    },
  },
  {
    id: 'tier-10',
    label: 'Tier 10',
    name: 'The Legend',
    emoji: '👑',
    minBalance: 100001,
    maxBalance: null,
    color: '#D4AF37',
    glowColor: 'rgba(212,175,55,0.5)',
    icon: 'crown',
    rewards: {
      xlmRefundPct: 300,
      trustlineMultiplier: 512,
      gold: 250000,
      silver: 2000000,
      copper: 100000000,
      physicalGold: true,
    },
  },
]

export function getTierForBalance(balance: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].minBalance) return TIERS[i]
  }
  return TIERS[0]
}

export function getNextTier(current: Tier): Tier | null {
  const idx = TIERS.findIndex((t) => t.id === current.id)
  if (idx === -1 || idx === TIERS.length - 1) return null
  return TIERS[idx + 1]
}

export function formatReward(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${n}`
}
