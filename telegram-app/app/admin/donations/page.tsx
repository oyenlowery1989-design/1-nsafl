'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import DonationsPage from '@/packs/donations/admin/DonationsPage'

export default function AdminDonationsPage() {
  return <FeatureRedirect feature="donations"><DonationsPage /></FeatureRedirect>
}
