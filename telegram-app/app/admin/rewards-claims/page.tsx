'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import RewardsClaimsPage from '@/packs/rewards/admin/RewardsClaimsPage'

export default function AdminRewardsClaimsPage() {
  return <FeatureRedirect feature="rewards"><RewardsClaimsPage /></FeatureRedirect>
}
