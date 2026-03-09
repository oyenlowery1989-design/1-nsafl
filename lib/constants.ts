export const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'CRYPTOBANK'

export const PRIMARY_CUSTOM_ASSET_LABEL = `$${PRIMARY_CUSTOM_ASSET_CODE}`

export const PRIMARY_CUSTOM_ASSET_ISSUER =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const NAV_ITEMS = [
  { href: '/stats', label: 'Stats', icon: 'query_stats', isCenter: false },
  { href: '/clubs', label: 'Clubs', icon: 'stadium', isCenter: false },
  { href: '/', label: 'Home', icon: 'sports_football', isCenter: true },
  { href: '/rewards', label: 'Rewards', icon: 'redeem', isCenter: false },
  { href: '/profile', label: 'Profile', icon: 'person', isCenter: false },
] as const
