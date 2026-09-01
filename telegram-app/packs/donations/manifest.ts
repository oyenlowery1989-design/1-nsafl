import type { PackManifest } from '@/packs/types'

export const donationsPack = {
  id: 'donations',
  admin: [{ href: '/admin/donations', label: 'Donations', icon: 'volunteer_activism' }],
} satisfies PackManifest
