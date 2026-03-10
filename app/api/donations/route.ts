import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase-server'

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'
const ASSET_CODE = process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NYSEAU'
const SUPPORTER_WALLET = process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''

function formatAmount(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(1))}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return k % 1 === 0 ? `${k}k` : `${parseFloat(k.toFixed(1))}k`
  }
  return String(Math.round(value))
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()

    // If ?address= is provided, return that wallet's own donations
    const address = req.nextUrl.searchParams.get('address')
    if (address) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('stellar_address', address)
        .maybeSingle()

      if (!wallet) return ok({ donations: [] })

      const { data: rows } = await supabase
        .from('donations')
        .select('id, amount, asset_code, donation_type, donation_target, stellar_tx_hash, verified, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })

      return ok({ donations: rows ?? [] })
    }

    // Top donors — aggregate donations by wallet, join to get display info
    const { data: donorRows, error: donorErr } = await supabase
      .from('donations')
      .select('amount, wallet_id, donation_type, donation_target, wallets(stellar_address, users(telegram_username, telegram_first_name))')
      .eq('verified', true)
      .order('created_at', { ascending: false })

    if (donorErr) {
      return fail('Failed to load donations', 'DB_ERROR', 500)
    }

    // Aggregate by wallet_id
    type DonationRow = {
      amount: number
      wallet_id: string
      donation_type: string | null
      donation_target: string | null
      wallets: {
        stellar_address: string
        users: { telegram_username: string | null; telegram_first_name: string | null } | null
      } | null
    }

    const rows = (donorRows ?? []) as DonationRow[]
    const walletTotals = new Map<string, { total: number; row: DonationRow; causes: string[] }>()

    for (const r of rows) {
      const wid = r.wallet_id
      const cause = r.donation_type === 'team' && r.donation_target
        ? `Team: ${r.donation_target}`
        : r.donation_type === 'player' && r.donation_target
        ? `Player: ${r.donation_target}`
        : 'General'
      const existing = walletTotals.get(wid)
      if (existing) {
        existing.total += Number(r.amount) || 0
        if (!existing.causes.includes(cause)) existing.causes.push(cause)
      } else {
        walletTotals.set(wid, { total: Number(r.amount) || 0, row: r, causes: [cause] })
      }
    }

    // Sort by total descending, take top 10
    const sorted = [...walletTotals.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)

    const topDonors = sorted.map(([, { total, row, causes }], i) => {
      const wallet = row.wallets
      const user = wallet?.users ?? null
      const name = user?.telegram_username
        ? `@${user.telegram_username}`
        : user?.telegram_first_name ?? 'Anonymous'
      const stellarAddress = wallet?.stellar_address ?? ''
      const hub = stellarAddress.length >= 6
        ? `...${stellarAddress.slice(-6)}`
        : 'Unknown'
      return {
        rank: i + 1,
        name,
        hub,
        amount: formatAmount(total),
        amountRaw: total,
        causes,
      }
    })

    // Total donated
    const totalDonated = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    return ok({
      topDonors: topDonors.length > 0
        ? topDonors
        : [{ rank: 1, name: 'Be the first!', hub: 'Donate now', amount: '0', amountRaw: 0 }],
      totalDonated: formatAmount(totalDonated),
      totalDonatedRaw: totalDonated,
      donationCount: rows.length,
    })
  } catch {
    return ok({
      topDonors: [],
      totalDonated: '0',
      totalDonatedRaw: 0,
      donationCount: 0,
    })
  }
}

export async function POST(req: NextRequest) {
  const rateLimitError = checkRateLimit(req, 10) // 10 donations/min max
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()
    const { stellarAddress, amount, donationType, donationTarget, txHash } = body as {
      stellarAddress: string
      amount: number
      donationType: string
      donationTarget?: string
      txHash: string
    }

    // Validate required fields
    if (!stellarAddress || !amount || !donationType || !txHash) {
      return fail('Missing required fields', 'MISSING_FIELDS')
    }

    if (!['general', 'team', 'player'].includes(donationType)) {
      return fail('Invalid donation type', 'INVALID_TYPE')
    }

    if (amount <= 0 || amount > 10_000_000) {
      return fail('Amount must be between 0 and 10M', 'INVALID_AMOUNT')
    }

    const TX_HASH_RE = /^[a-f0-9]{64}$/i
    if (!TX_HASH_RE.test(txHash)) {
      return fail('Invalid transaction hash format', 'INVALID_TX_HASH')
    }

    // Verify transaction on Stellar Horizon
    let verified = false
    try {
      const txRes = await fetch(`${HORIZON_URL}/transactions/${txHash}`)
      if (txRes.ok) {
        // Fetch operations for this transaction to verify destination and asset
        const opsRes = await fetch(`${HORIZON_URL}/transactions/${txHash}/operations`)
        if (opsRes.ok) {
          const opsData = await opsRes.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const operations = opsData._embedded?.records ?? [] as any[]
          // Check if any payment operation matches our criteria
          for (const op of operations) {
            const isPayment = op.type === 'payment'
            const destMatch = op.to === SUPPORTER_WALLET
            const assetMatch = op.asset_code === ASSET_CODE
            if (isPayment && destMatch && assetMatch) {
              verified = true
              break
            }
          }
        }
      }
    } catch {
      // Horizon unreachable — record as unverified
    }

    const supabase = createServiceClient()

    // Look up wallet_id from stellar_address
    const { data: walletData, error: walletErr } = await supabase
      .from('wallets')
      .select('id')
      .eq('stellar_address', stellarAddress)
      .single()

    if (walletErr || !walletData) {
      return fail('Wallet not found — connect your wallet first', 'WALLET_NOT_FOUND')
    }

    // Check for duplicate tx hash
    const { data: existingDonation } = await supabase
      .from('donations')
      .select('id')
      .eq('stellar_tx_hash', txHash)
      .single()

    if (existingDonation) {
      return fail('This transaction has already been recorded', 'DUPLICATE_TX')
    }

    // Insert donation
    const { data: donation, error: insertErr } = await supabase
      .from('donations')
      .insert({
        wallet_id: walletData.id,
        amount,
        asset_code: ASSET_CODE,
        donation_type: donationType,
        donation_target: donationTarget ?? null,
        stellar_tx_hash: txHash,
        verified,
      })
      .select('id, amount, verified, created_at')
      .single()

    if (insertErr) {
      return fail('Failed to record donation', 'INSERT_ERROR', 500)
    }

    return ok({
      donation,
      verified,
      message: verified
        ? 'Donation verified and recorded!'
        : 'Donation recorded but could not be verified on-chain. It will be reviewed.',
    })
  } catch {
    return fail('Unexpected error', 'INTERNAL_ERROR', 500)
  }
}
