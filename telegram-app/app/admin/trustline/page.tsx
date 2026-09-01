'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import TrustlinePage from '@/packs/stellar-wallet/admin/TrustlinePage'

export default function AdminTrustlinePage() {
  return <FeatureRedirect feature="stellar-wallet"><TrustlinePage /></FeatureRedirect>
}
