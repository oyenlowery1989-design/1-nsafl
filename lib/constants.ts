export const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NYSEAU'

export const PRIMARY_CUSTOM_ASSET_LABEL = `$${PRIMARY_CUSTOM_ASSET_CODE}`

export const PRIMARY_CUSTOM_ASSET_ISSUER =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Asset config parsed from NEXT_PUBLIC_SHOWN_ASSETS
// Format: comma-separated entries
//   Native XLM → "XLM"  (no colon — issuer will be null, matched by asset_type=native)
//   Custom asset → "CODE:ISSUER_ADDRESS"
// Example: "XLM,NYSEAU:GCVLZL2..."
// DO NOT use "XLM:native" — "native" would be treated as a literal issuer and break balance lookup
export interface AssetConfig {
  code: string
  issuer: string | null  // null = native XLM
  label: string          // display label e.g. "$NYSEAU" or "XLM"
}

export const SHOWN_ASSET_CONFIGS: AssetConfig[] = (
  process.env.NEXT_PUBLIC_SHOWN_ASSETS ?? 'XLM'
)
  .split(',')
  .map((entry) => {
    const [code, issuer] = entry.trim().split(':')
    const cleanCode = code.trim()
    // "XLM" or "XLM:native" both mean native Stellar XLM (no issuer)
    const cleanIssuer = cleanCode === 'XLM' ? null : (issuer?.trim() ?? null)
    return {
      code: cleanCode,
      issuer: cleanIssuer,
      label: cleanCode === 'XLM' ? 'XLM' : `$${cleanCode}`,
    }
  })

export const NAV_ITEMS = [
  { href: '/stats', label: 'Stats', icon: 'query_stats', isCenter: false },
  { href: '/clubs', label: 'Clubs', icon: 'stadium', isCenter: false },
  { href: '/', label: 'Home', icon: 'sports_football', isCenter: true },
  { href: '/rewards', label: 'Rewards', icon: 'redeem', isCenter: false },
  { href: '/profile', label: 'Profile', icon: 'person', isCenter: false },
] as const
