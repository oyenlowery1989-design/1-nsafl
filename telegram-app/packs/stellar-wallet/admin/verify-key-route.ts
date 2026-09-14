/**
 * POST /api/admin/verify-key
 * Derives a public key from a provided Stellar secret key and looks it up in Supabase.
 * Returns the matching wallet + user info (or valid: false if not found).
 * Admin-token auth only — never call from client with real secret keys.
 *
 * NOTE: The secret key is used ONLY to derive the public key client-side.
 *       This endpoint receives only the PUBLIC KEY — never the secret.
 */
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'
import { requirePack } from '@/lib/feature-gate'

export async function POST(req: NextRequest) {
  const disabled = requirePack('stellar-wallet')
  if (disabled) return disabled
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  let body: { publicKey?: unknown } = {}
  try { body = await req.json() } catch { /* fallthrough */ }

  if (typeof body.publicKey !== 'string' || !body.publicKey.trim()) {
    return fail('publicKey is required', 'BAD_REQUEST', 400)
  }

  const publicKey = body.publicKey.trim()

  // Check if this is the reward sender wallet — derive from secret server-side
  const rewardSecret = process.env.REWARD_SENDER_SECRET ?? ''
  if (rewardSecret) {
    try {
      const { Keypair } = await import('stellar-sdk')
      const rewardSenderAddress = Keypair.fromSecret(rewardSecret).publicKey()
      if (publicKey === rewardSenderAddress) {
        return ok({
          valid: true,
          publicKey,
          isRewardSender: true,
          wallet: null,
          user: null,
          balance: null,
        })
      }
    } catch { /* invalid secret — skip */ }
  }

  const supabase = createServiceClient()

  // Find wallet with this stellar address
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, stellar_address, label, is_primary, created_at, last_connected_at, user_id')
    .eq('stellar_address', publicKey)
    .single()

  if (!wallet) {
    return ok({ valid: false, reason: 'No wallet found with this public key.' })
  }

  // Fetch the owning user
  const { data: user } = await supabase
    .from('users')
    .select('telegram_id, telegram_username, telegram_first_name, created_at')
    .eq('id', wallet.user_id)
    .single()

  // Fetch the wallet balance
  const { data: balance } = await supabase
    .from('wallet_balances')
    .select('primary_asset_balance, xlm_balance, last_synced_at')
    .eq('wallet_id', wallet.id)
    .single()

  return ok({
    valid: true,
    publicKey,
    wallet: {
      id: wallet.id,
      label: wallet.label,
      isPrimary: wallet.is_primary,
      createdAt: wallet.created_at,
      lastConnectedAt: wallet.last_connected_at,
    },
    user: user ? {
      telegramId: user.telegram_id,
      username: user.telegram_username,
      firstName: user.telegram_first_name,
      createdAt: user.created_at,
    } : null,
    balance: balance ? {
      nsafl: balance.primary_asset_balance,
      xlm: balance.xlm_balance,
      lastSynced: balance.last_synced_at,
    } : null,
  })
}
