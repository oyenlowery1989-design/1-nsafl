import type { PackManifest } from '@/packs/types'
import StellarHomePage from './StellarHomePage'
import { stellarWalletCopy } from './copy'

export const stellarWalletPack = {
  id: 'stellar-wallet',
  home: StellarHomePage,
  copy: stellarWalletCopy,
} satisfies PackManifest
