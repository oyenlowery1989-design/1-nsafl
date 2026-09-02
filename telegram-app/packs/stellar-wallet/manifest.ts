import type { PackManifest } from '@/packs/types'
import StellarHomePage from './StellarHomePage'
import { stellarWalletCopy } from './copy'
import { getWalletAdminContribution } from './admin/data'

export const stellarWalletPack = {
  id: 'stellar-wallet',
  home: StellarHomePage,
  admin: [
    { href: '/admin/purchases', label: 'Purchases', icon: 'shopping_cart' },
    { href: '/admin/trustline', label: 'Trustlines', icon: 'add_link' },
  ],
  adminData: getWalletAdminContribution,
  copy: stellarWalletCopy,
} satisfies PackManifest
