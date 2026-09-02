import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/feature-gate'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { getTierForBalance, TIERS } from '@/config/tiers'
import { sendTierClaimPayment } from '@/lib/stellar-payment'
import { BRANDING } from '@/config/branding'
import { createRewardsRepository } from '@/packs/rewards/repository'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID, 10) : null

/** First day of the UTC month containing `d`, as 'YYYY-MM-DD'. Exported for tests. */
export function utcMonthStart(d: Date): string {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

function getUser(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = initData ? validateTelegramInitData(initData, BOT_TOKEN) : null
  if (user) return user
  if (IS_DEV) return { id: 999999999, first_name: 'Dev', last_name: 'User', username: 'devuser' }
  return null
}

async function resolveWalletAndBalance(supabase: ReturnType<typeof createServiceClient>, telegramId: number) {
  const { data: userRow } = await supabase.from('users').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (!userRow) return null
  const { data: walletRow } = await supabase
    .from('wallets').select('id, stellar_address').eq('user_id', userRow.id).eq('is_primary', true).maybeSingle()
  if (!walletRow) return null
  const { data: balanceRow } = await supabase
    .from('wallet_balances').select('primary_asset_balance').eq('wallet_id', walletRow.id).maybeSingle()
  return {
    stellarAddress: walletRow.stellar_address as string,
    balance: Number(balanceRow?.primary_asset_balance ?? 0),
  }
}

export async function GET(req: NextRequest) {
  const disabled = requireFeature('rewards')
  if (disabled) return disabled

  const user = getUser(req)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  const limited = checkRateLimit(req, 30, `rewards-claim-status:${user.id}`)
  if (limited) return limited

  const supabase = createServiceClient()
  const month = utcMonthStart(new Date())
  const claim = await createRewardsRepository(supabase).findMonthlyClaim(user.id, month)

  if (!claim) return ok({ claimed: false })
  return ok({
    claimed: true,
    tierId: claim.tier_id,
    payoutStatus: claim.payout_status,
    txHash: claim.payout_tx_hash,
  })
}

export async function POST(req: NextRequest) {
  const disabled = requireFeature('rewards')
  if (disabled) return disabled

  const user = getUser(req)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  const limited = checkRateLimit(req, 5, `rewards-claim:${user.id}`)
  if (limited) return limited

  const supabase = createServiceClient()
  const resolved = await resolveWalletAndBalance(supabase, user.id)
  if (!resolved) return fail('Wallet not found', 'NOT_FOUND', 404)

  const tier = getTierForBalance(resolved.balance)
  if (!tier.rewards) return fail('No rewards at this tier', 'NO_REWARDS')

  const month = utcMonthStart(new Date())
  const { data: inserted, error: insertError } = await supabase
    .from('tier_reward_claims')
    .insert({
      telegram_id: user.id,
      tier_id: tier.id,
      claim_month: month,
      gold_amount: tier.rewards.gold,
      silver_amount: tier.rewards.silver,
      copper_amount: tier.rewards.copper,
      payout_status: 'pending',
    })
    .select('id, gold_amount, silver_amount, copper_amount')
    .single()

  let claimRow: { id: number; gold_amount: number; silver_amount: number; copper_amount: number }
  let isPhysicalGoldEligible = tier.rewards.physicalGold

  if (!insertError) {
    claimRow = inserted
  } else {
    if (insertError.code !== '23505') return fail(insertError.message, 'DB_ERROR', 500)

    // Row already exists for this month — look it up rather than assuming it's terminal.
    // A prior attempt may have inserted-then-failed-to-pay (e.g. NO_TRUST), which must
    // be retried, not reported as a permanent lockout.
    const { data: existing } = await supabase
      .from('tier_reward_claims')
      .select('id, tier_id, payout_status, payout_tx_hash, gold_amount, silver_amount, copper_amount')
      .eq('telegram_id', user.id)
      .eq('claim_month', month)
      .maybeSingle()

    if (!existing) return fail('Already claimed this month', 'ALREADY_CLAIMED', 409)

    if (existing.payout_status === 'paid') {
      return fail('Already claimed this month', 'ALREADY_CLAIMED', 409)
    }
    if (existing.payout_status === 'paying') {
      return NextResponse.json(
        { success: false, error: 'A previous claim attempt is still in progress', code: 'IN_PROGRESS' },
        { status: 409 },
      )
    }

    // 'pending' — re-drive payment against the amounts already recorded on that
    // row (don't recompute from current tier; the original claimed amounts stand).
    claimRow = { id: existing.id, gold_amount: existing.gold_amount, silver_amount: existing.silver_amount, copper_amount: existing.copper_amount }
    isPhysicalGoldEligible = TIERS.find((t) => t.id === existing.tier_id)?.rewards?.physicalGold ?? false
  }

  const payment = await sendTierClaimPayment(claimRow, resolved.stellarAddress, supabase)

  if (payment.sent) {
    if (isPhysicalGoldEligible && ADMIN_TELEGRAM_ID) {
      await notifyAdminPhysicalGold(user.id, user.username ?? null)
      await supabase.from('tier_reward_claims').update({ physical_gold_notified: true }).eq('id', claimRow.id)
    }
    return ok({ claimed: true, txHash: payment.txHash })
  }

  if (payment.code === 'NO_TRUST') {
    return NextResponse.json(
      { success: false, error: payment.error ?? 'Missing trustline', code: 'NO_TRUST', lobstrDeeplink: payment.lobstrDeeplink },
      { status: 502 },
    )
  }
  return fail(payment.error ?? 'Payment failed', payment.code ?? 'HORIZON_ERROR', 502)
}

/** Telegram DM to the admin. Swallows its own errors — awaiting it never fails the claim. */
async function notifyAdminPhysicalGold(telegramId: number, username: string | null) {
  if (!BOT_TOKEN || !ADMIN_TELEGRAM_ID) return
  const who = username ? `@${username}` : `telegram_id ${telegramId}`
  const message = `🏆 <b>${BRANDING.appName}</b>\n\nTier 10 user ${who} just claimed this month's rewards — arrange physical gold shipping.`
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_ID, text: message, parse_mode: 'HTML' }),
    })
  } catch { /* ignore — claim already succeeded */ }
}
