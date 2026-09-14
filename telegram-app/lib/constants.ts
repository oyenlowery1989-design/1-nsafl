export const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'

export const PRIMARY_CUSTOM_ASSET_LABEL = `$${PRIMARY_CUSTOM_ASSET_CODE}`

// Brand-derived browser storage keys — follow the asset code so clones rebrand automatically
const KEY_PREFIX = PRIMARY_CUSTOM_ASSET_CODE.toLowerCase()
export const REFERRER_STORAGE_KEY = `${KEY_PREFIX}_referrer`
export const ACCESS_RECORDED_STORAGE_KEY = `${KEY_PREFIX}_access_recorded`

export const PRIMARY_CUSTOM_ASSET_ISSUER =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Asset config parsed from NEXT_PUBLIC_SHOWN_ASSETS
// Format: comma-separated entries. Two forms supported:
//   "XLM"              → native XLM (no issuer)
//   "CODE:ISSUER"      → explicit issuer
//   "CODE"             → issuer falls back to NEXT_PUBLIC_REWARD_ASSET_ISSUER
//                        then NEXT_PUBLIC_PRIMARY_ASSET_ISSUER
// This lets you write just code names when all assets share one issuer, e.g.:
//   XLM,<PRIMARY>,w<PRIMARY>,wXLM,wXRP,wUSDC,wUSDT,wDAI
export interface AssetConfig {
  code: string
  issuer: string | null  // null = native XLM
  label: string          // display label e.g. "$<CODE>" or "XLM"
}

const DEFAULT_ISSUER =
  process.env.NEXT_PUBLIC_REWARD_ASSET_ISSUER ??
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ??
  ''

export const SHOWN_ASSET_CONFIGS: AssetConfig[] = (
  process.env.NEXT_PUBLIC_SHOWN_ASSETS ?? 'XLM'
)
  .split(',')
  .map((entry) => {
    const [code, issuer] = entry.trim().split(':')
    const cleanCode = code.trim()
    // XLM is always native (no issuer)
    const cleanIssuer = cleanCode === 'XLM' ? null : (issuer?.trim() || DEFAULT_ISSUER)
    return {
      code: cleanCode,
      issuer: cleanIssuer,
      label: cleanCode === 'XLM' ? 'XLM' : `$${cleanCode}`,
    }
  })
