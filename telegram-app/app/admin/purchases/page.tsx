'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import PurchasesPage from '@/packs/stellar-wallet/admin/PurchasesPage'

export default function AdminPurchasesPage() {
  return <FeatureRedirect feature="stellar-wallet"><PurchasesPage /></FeatureRedirect>
}
