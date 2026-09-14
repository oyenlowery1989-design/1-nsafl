import type { PackManifest } from '@/packs/types'
import StellarHomePage from './StellarHomePage'
import ProfilePage from './ProfilePage'
import { stellarWalletCopy } from './copy'
import { getWalletAdminContribution } from './admin/data'
import { createStellarWalletRepository } from './repository'

export const stellarWalletPack = {
  id: 'stellar-wallet',
  home: StellarHomePage,
  profile: ProfilePage,
  admin: [
    { href: '/admin/purchases', label: 'Purchases', icon: 'shopping_cart' },
    { href: '/admin/trustline', label: 'Trustlines', icon: 'add_link' },
  ],
  adminData: getWalletAdminContribution,
  sessionData: async (supabase, userId) => ({
    hasWallet: await createStellarWalletRepository(supabase).hasWallet(userId),
  }),
  copy: stellarWalletCopy,
} satisfies PackManifest
