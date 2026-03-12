const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'

export interface HorizonPayment {
  id: string
  paging_token: string
  type: string
  created_at: string
  to?: string
  from?: string
  amount?: string
  asset_code?: string
  asset_type?: string
  asset_issuer?: string
}

export interface StellarBalance {
  asset: string
  issuer: string | null
  balance: string
  isNative: boolean
}

export async function fetchStellarBalances(address: string): Promise<StellarBalance[]> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Stellar API error: ${res.status}`)
  const data = await res.json()

  interface HorizonBalance {
    asset_type: string
    asset_code?: string
    asset_issuer?: string
    balance: string
  }
  return (data.balances as HorizonBalance[]).map((b) => ({
    asset: b.asset_type === 'native' ? 'XLM' : (b.asset_code ?? 'UNKNOWN'),
    issuer: b.asset_issuer ?? null,
    balance: parseFloat(b.balance).toFixed(2),
    isNative: b.asset_type === 'native',
  }))
}

// Returns all shown asset balances as a record { CODE: balance }
// Matches by issuer when provided, by code only when issuer is null
export async function fetchAllShownBalances(
  address: string
): Promise<Record<string, string>> {
  // Import here to avoid circular — constants imports nothing from stellar
  const { SHOWN_ASSET_CONFIGS } = await import('./constants')
  const balances = await fetchStellarBalances(address)
  const result: Record<string, string> = {}
  for (const cfg of SHOWN_ASSET_CONFIGS) {
    const match = balances.find((b) => {
      if (cfg.issuer) return b.asset === cfg.code && b.issuer === cfg.issuer
      // No issuer = native XLM — match strictly by isNative to avoid spam tokens named "XLM"
      if (cfg.code === 'XLM') return b.isNative
      return b.asset === cfg.code && b.issuer === null
    })
    result[cfg.code] = match?.balance ?? '0.00'
  }
  return result
}

/**
 * Check whether an account has a trustline for the primary custom asset.
 * Returns true if the trustline exists (even with 0 balance).
 */
export async function hasPrimaryAssetTrustline(address: string): Promise<boolean> {
  const { SHOWN_ASSET_CONFIGS } = await import('./constants')
  const primary = SHOWN_ASSET_CONFIGS.find((c) => c.code === PRIMARY_CUSTOM_ASSET_CODE && c.issuer)
  if (!primary) return false // can't verify without issuer
  const balances = await fetchStellarBalances(address)
  return balances.some((b) => b.asset === primary.code && b.issuer === primary.issuer)
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address)
}

export interface StellarAccountInfo {
  homeDomain: string | null   // set by account owner via manage_data, e.g. "example.com"
  subentryCount: number       // number of trustlines + offers + signers
  sequence: string            // current sequence number (useful for age estimation)
}

/** Fetch lightweight account metadata — home domain, subentry count, sequence */
export async function fetchAccountInfo(address: string): Promise<StellarAccountInfo> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Stellar account not found: ${res.status}`)
  const data = await res.json()
  return {
    homeDomain: data.home_domain ?? null,
    subentryCount: data.subentry_count ?? 0,
    sequence: data.sequence ?? '',
  }
}
