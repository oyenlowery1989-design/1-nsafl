import type { PackManifest } from '@/packs/types'
import { getDonationsAdminContribution } from './admin/data'
import ProfilePage from '@/packs/stellar-wallet/ProfilePage'

export const donationsPack = {
  id: 'donations',
  admin: [{ href: '/admin/donations', label: 'Donations', icon: 'volunteer_activism' }],
  adminData: getDonationsAdminContribution,
  profile: ProfilePage,
} satisfies PackManifest
