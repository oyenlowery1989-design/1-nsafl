const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'CRYPTOBANK'

export interface StellarBalance {
  asset: string
  balance: string
  isNative: boolean
}

export async function fetchStellarBalances(address: string): Promise<StellarBalance[]> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`Stellar API error: ${res.status}`)
  const data = await res.json()

  return (data.balances as any[]).map((b: any) => ({
    asset: b.asset_type === 'native' ? 'XLM' : b.asset_code,
    balance: parseFloat(b.balance).toFixed(2),
    isNative: b.asset_type === 'native',
  }))
}

export async function fetchCustomAssetBalance(address: string): Promise<string> {
  const balances = await fetchStellarBalances(address)
  const asset = balances.find((b) => b.asset === PRIMARY_CUSTOM_ASSET_CODE)
  return asset?.balance ?? '0.00'
}

export async function fetchXlmBalance(address: string): Promise<string> {
  const balances = await fetchStellarBalances(address)
  const xlm = balances.find((b) => b.isNative)
  return xlm?.balance ?? '0.00'
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address)
}
