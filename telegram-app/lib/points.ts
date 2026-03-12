import { getTierForBalance, TIERS } from '@/config/tiers'

/**
 * Returns the number of points earned from the user's tier.
 * Pre-Tier = 0, Tier 1 = 1, Tier 2 = 2, ..., Tier 9 = 9
 */
export function getPointsFromTier(balance: number): number {
  const tier = getTierForBalance(balance)
  const idx = TIERS.findIndex((t) => t.id === tier.id)
  // idx 0 = pre-tier (0 points), idx 1 = T1 (1 point), etc.
  return Math.max(0, idx)
}

/**
 * Total points = tier points + referral points + future task points.
 * referralCount and taskPoints will default to 0 until those systems are built.
 */
export function getTotalPoints(balance: number, referralCount = 0, taskPoints = 0): number {
  return getPointsFromTier(balance) + referralCount + taskPoints
}
