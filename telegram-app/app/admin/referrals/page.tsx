'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import ReferralsPage from '@/packs/leaderboard/admin/ReferralsPage'

export default function AdminReferralsPage() {
  return <FeatureRedirect feature="leaderboard"><ReferralsPage /></FeatureRedirect>
}
