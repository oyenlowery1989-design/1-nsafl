import type { PackManifest } from '@/packs/types'
import { getDonationsAdminContribution } from './admin/data'

export const donationsPack = {
  id: 'donations',
  admin: [{ href: '/admin/donations', label: 'Donations', icon: 'volunteer_activism' }],
  adminData: getDonationsAdminContribution,
} satisfies PackManifest
