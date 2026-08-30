// Prize asset configuration for Lucky Draw rewards.
// All reward assets share a single issuer (NEXT_PUBLIC_REWARD_ASSET_ISSUER).

import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

export interface RewardAsset {
  code: string
  issuer: string
  label: string
  lobstrDeeplink: string
}

const ISSUER =
  process.env.NEXT_PUBLIC_REWARD_ASSET_ISSUER ??
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ??
  ''

export const WRAPPED_PRIMARY_ASSET_CODE = `w${PRIMARY_CUSTOM_ASSET_CODE}`

export type GamePrizeSource = 'lucky_draw' | 'slot_machine' | 'scratch_card'

export interface GamePrizeDefinition {
  label: string
  amount: number | null
  weight: number
  isAsset?: boolean
  isPrimaryAsset?: boolean
  isMiss?: boolean
}

// Single source for server payout records and client game displays. Presentation-only
// emoji and color remain with the components that render them.
export const GAME_PRIZE_DEFINITIONS: Record<GamePrizeSource, GamePrizeDefinition[]> = {
  lucky_draw: [
    { label: '100 wXLM', amount: 100, weight: 15, isAsset: true },
    { label: '50 wXLM', amount: 50, weight: 20, isAsset: true },
    { label: '20 wXLM', amount: 20, weight: 30, isAsset: true },
    { label: `5000 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 5000, weight: 10, isAsset: true, isPrimaryAsset: true },
    { label: `2500 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 2500, weight: 25, isAsset: true, isPrimaryAsset: true },
    { label: `1000 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 1000, weight: 50, isAsset: true, isPrimaryAsset: true },
    { label: '50 wXRP', amount: 50, weight: 50, isAsset: true },
    { label: '100 wUSDC', amount: 100, weight: 50, isAsset: true },
    { label: '+2 Spins', amount: null, weight: 50 },
    { label: 'Free Spin', amount: null, weight: 250 },
    { label: 'Better Luck', amount: null, weight: 450 },
  ],
  slot_machine: [
    { label: '100 wXLM', amount: 100, weight: 10, isAsset: true },
    { label: `5000 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 5000, weight: 15, isAsset: true, isPrimaryAsset: true },
    { label: `2500 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 2500, weight: 25, isAsset: true, isPrimaryAsset: true },
    { label: `1000 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 1000, weight: 50, isAsset: true, isPrimaryAsset: true },
    { label: '50 wXRP', amount: 50, weight: 50, isAsset: true },
    { label: '100 wUSDC', amount: 100, weight: 50, isAsset: true },
    { label: '+2 Spins', amount: null, weight: 50 },
    { label: 'Free Spin', amount: null, weight: 250 },
    { label: 'Better Luck', amount: null, weight: 450 },
  ],
  scratch_card: [
    { label: '100 wXLM', amount: 100, weight: 8, isAsset: true },
    { label: `5000 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 5000, weight: 12, isAsset: true, isPrimaryAsset: true },
    { label: `2500 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 2500, weight: 20, isAsset: true, isPrimaryAsset: true },
    { label: `1000 ${WRAPPED_PRIMARY_ASSET_CODE}`, amount: 1000, weight: 40, isAsset: true, isPrimaryAsset: true },
    { label: '50 wXRP', amount: 50, weight: 40, isAsset: true },
    { label: '100 wUSDC', amount: 100, weight: 40, isAsset: true },
    { label: '+2 Cards', amount: null, weight: 60 },
    { label: 'Better Luck', amount: null, weight: 780, isMiss: true },
  ],
}

export const REWARD_ASSETS: RewardAsset[] = [
  { code: 'wXLM',   issuer: ISSUER, label: 'Wrapped XLM',   lobstrDeeplink: `https://lobstr.co/assets/wXLM:${ISSUER}`   },
  { code: WRAPPED_PRIMARY_ASSET_CODE, issuer: ISSUER, label: `Wrapped ${PRIMARY_CUSTOM_ASSET_CODE}`, lobstrDeeplink: `https://lobstr.co/assets/${WRAPPED_PRIMARY_ASSET_CODE}:${ISSUER}` },
  { code: 'wXRP',   issuer: ISSUER, label: 'Wrapped XRP',   lobstrDeeplink: `https://lobstr.co/assets/wXRP:${ISSUER}`   },
  { code: 'wUSDC',  issuer: ISSUER, label: 'Wrapped USDC',  lobstrDeeplink: `https://lobstr.co/assets/wUSDC:${ISSUER}`  },
  { code: 'wUSDT',  issuer: ISSUER, label: 'Wrapped USDT',  lobstrDeeplink: `https://lobstr.co/assets/wUSDT:${ISSUER}`  },
  { code: 'wDAI',   issuer: ISSUER, label: 'Wrapped DAI',   lobstrDeeplink: `https://lobstr.co/assets/wDAI:${ISSUER}`   },
  { code: 'wGOLD',  issuer: ISSUER, label: 'Wrapped Gold',   lobstrDeeplink: `https://lobstr.co/assets/wGOLD:${ISSUER}`  },
  { code: 'wSILVER', issuer: ISSUER, label: 'Wrapped Silver', lobstrDeeplink: `https://lobstr.co/assets/wSILVER:${ISSUER}` },
  { code: 'wCOPPER', issuer: ISSUER, label: 'Wrapped Copper', lobstrDeeplink: `https://lobstr.co/assets/wCOPPER:${ISSUER}` },
]

/** Parse prize label like "100 wXLM" → RewardAsset or null if not a sendable asset.
 *  Never returns native XLM — only custom Stellar assets with an explicit issuer. */
export function prizeToAsset(prizeLabel: string): RewardAsset | null {
  const parts = prizeLabel.trim().split(/\s+/)
  const code = parts[parts.length - 1]
  // Block native XLM — must use a wrapped token (wXLM) with an issuer
  if (code === 'XLM') return null
  const asset = REWARD_ASSETS.find(a => a.code === code) ?? null
  // Extra safety: never return an asset without a configured issuer
  if (asset && !asset.issuer) return null
  return asset
}
