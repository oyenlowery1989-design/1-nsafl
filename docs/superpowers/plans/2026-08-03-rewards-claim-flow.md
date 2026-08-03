# Rewards Claim Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users claim their current tier's gold/silver/copper rewards once per UTC calendar month as an auto-sent Stellar payment, and notify the admin (no form) when a tier-10 user claims their physical-gold perk.

**Architecture:** A new `tier_reward_claims` table enforces one claim per user per UTC month via a unique constraint. A new `sendTierClaimPayment()` (sibling to the existing `sendPrizePayment()`) sends one atomic multi-asset Stellar transaction. The Rewards page's existing (LOCKED) `TierCard` gets a claim button wired to a new `/api/rewards/claim` route. A minimal admin page lists claims with a retry action, mirroring the existing `/admin/wins` pattern.

**Tech Stack:** Next.js App Router API routes, Supabase (service-role client), `stellar-sdk`, Vitest.

## Global Constraints

- Never hardcode asset names — this feature adds `wGOLD`/`wSILVER`/`wCOPPER` as literal new asset codes (they're new assets being introduced, not the primary token — this is fine and matches the existing `wXLM`/`wUSDC` pattern in `lib/rewardAssets.ts`).
- All new dates/boundaries pinned to UTC (`now() at time zone 'utc'`), not session/server-local time — established convention (`consume_daily_spin`).
- All new API routes: read `x-telegram-init-data`, validate via `validateTelegramInitData`, return `ok()`/`fail()` shape, rate-limited with a per-user key.
- `(supabase as any)` casts are banned in this codebase — use the generated `Database` types (extend `lib/database.types.ts` for the new table).
- Touching `app/rewards/page.tsx` (LOCKED per CLAUDE.md) is deliberate and in-scope for this feature — do not treat the lock as blocking, but do not touch anything else on that page beyond what this plan specifies.
- Any `supabase db push` against production must be confirmed with the user first (destructive/irreversible on a live DB) — do not run it unattended.

---

## Task 1: Migration — `tier_reward_claims` table

**Files:**
- Create: `telegram-app/supabase/migrations/028_tier_reward_claims.sql`
- Modify: `telegram-app/lib/database.types.ts` (add `tier_reward_claims` table type, alphabetically among the other table entries)

**Interfaces:**
- Produces: table `public.tier_reward_claims` with columns `id, telegram_id, tier_id, claim_month, gold_amount, silver_amount, copper_amount, payout_status, payout_tx_hash, payout_notes, physical_gold_notified, created_at`; unique constraint `(telegram_id, claim_month)`.

- [ ] **Step 1: Write the migration**

```sql
-- telegram-app/supabase/migrations/028_tier_reward_claims.sql
-- One claim per user per UTC calendar month for the current tier's
-- gold/silver/copper perks. claim_month is always the UTC month start —
-- pinned explicitly so it can't drift with session timezone config
-- (see 026_consume_daily_spin_utc.sql for the same convention).
create table "public"."tier_reward_claims" (
  "id" bigint generated always as identity primary key,
  "telegram_id" bigint not null references "public"."users"("telegram_id"),
  "tier_id" text not null,
  "claim_month" date not null,
  "gold_amount" numeric(20,7) not null default 0,
  "silver_amount" numeric(20,7) not null default 0,
  "copper_amount" numeric(20,7) not null default 0,
  "payout_status" text not null default 'pending',
  "payout_tx_hash" text,
  "payout_notes" text,
  "physical_gold_notified" boolean not null default false,
  "created_at" timestamptz not null default now(),
  unique ("telegram_id", "claim_month")
);

create index "tier_reward_claims_telegram_id_idx" on "public"."tier_reward_claims" ("telegram_id");
```

- [ ] **Step 2: Add the TypeScript type**

Open `lib/database.types.ts`. Find the `wallets` table entry (search for `wallets: {`) — insert a new `tier_reward_claims` entry immediately before it (alphabetical order matches the rest of the file):

```typescript
      tier_reward_claims: {
        Row: {
          claim_month: string
          copper_amount: number
          created_at: string
          gold_amount: number
          id: number
          payout_notes: string | null
          payout_status: string
          payout_tx_hash: string | null
          physical_gold_notified: boolean
          silver_amount: number
          telegram_id: number
          tier_id: string
        }
        Insert: {
          claim_month: string
          copper_amount?: number
          created_at?: string
          gold_amount?: number
          id?: number
          payout_notes?: string | null
          payout_status?: string
          payout_tx_hash?: string | null
          physical_gold_notified?: boolean
          silver_amount?: number
          telegram_id: number
          tier_id: string
        }
        Update: {
          claim_month?: string
          copper_amount?: number
          created_at?: string
          gold_amount?: number
          id?: number
          payout_notes?: string | null
          payout_status?: string
          payout_tx_hash?: string | null
          physical_gold_notified?: boolean
          silver_amount?: number
          telegram_id?: number
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_reward_claims_telegram_id_fkey"
            columns: ["telegram_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["telegram_id"]
          },
        ]
      }
```

- [ ] **Step 3: Verify tsc is still clean**

Run: `cd telegram-app && npx tsc --noEmit`
Expected: no new errors (this step only adds a type, nothing consumes it yet).

- [ ] **Step 4: Apply the migration to production**

Ask the user to confirm before running (per Global Constraints — this writes to the live DB):

Run: `cd telegram-app && supabase db push`
Expected: output includes `028_tier_reward_claims.sql` under `migrations`, `"dryRun":false`.

- [ ] **Step 5: Commit**

```bash
git add telegram-app/supabase/migrations/028_tier_reward_claims.sql telegram-app/lib/database.types.ts
git commit -m "feat: add tier_reward_claims table for monthly reward claims"
```

---

## Task 2: New reward assets — wGOLD/wSILVER/wCOPPER

**Files:**
- Modify: `telegram-app/lib/rewardAssets.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `REWARD_ASSETS` now includes entries with `code: 'wGOLD' | 'wSILVER' | 'wCOPPER'`, each with `issuer`, `label`, `lobstrDeeplink`. `prizeToAsset()` (existing function, unchanged) will now also resolve these codes since it looks them up in `REWARD_ASSETS`.

- [ ] **Step 1: Add the three assets**

In `lib/rewardAssets.ts`, add to the `REWARD_ASSETS` array (after the existing `wDAI` entry):

```typescript
  { code: 'wGOLD',   issuer: ISSUER, label: 'Wrapped Gold',   lobstrDeeplink: `https://lobstr.co/assets/wGOLD:${ISSUER}`   },
  { code: 'wSILVER', issuer: ISSUER, label: 'Wrapped Silver', lobstrDeeplink: `https://lobstr.co/assets/wSILVER:${ISSUER}` },
  { code: 'wCOPPER', issuer: ISSUER, label: 'Wrapped Copper', lobstrDeeplink: `https://lobstr.co/assets/wCOPPER:${ISSUER}` },
```

- [ ] **Step 2: Write a test verifying the assets resolve**

Add to `__tests__/stellar.test.ts` (or create `__tests__/rewardAssets.test.ts` if `stellar.test.ts` doesn't already cover `rewardAssets.ts` — check the file first):

```typescript
import { describe, it, expect } from 'vitest'
import { REWARD_ASSETS, prizeToAsset } from '@/lib/rewardAssets'

describe('tier reward assets', () => {
  it('includes wGOLD, wSILVER, wCOPPER', () => {
    const codes = REWARD_ASSETS.map((a) => a.code)
    expect(codes).toContain('wGOLD')
    expect(codes).toContain('wSILVER')
    expect(codes).toContain('wCOPPER')
  })

  it('prizeToAsset resolves a wGOLD prize label', () => {
    const asset = prizeToAsset('5 wGOLD')
    expect(asset?.code).toBe('wGOLD')
  })
})
```

- [ ] **Step 3: Run the test**

Run: `cd telegram-app && npx vitest run __tests__/stellar.test.ts` (or the new file if you created one)
Expected: PASS, including the 2 new tests.

- [ ] **Step 4: Commit**

```bash
git add telegram-app/lib/rewardAssets.ts telegram-app/__tests__/
git commit -m "feat: add wGOLD/wSILVER/wCOPPER reward assets"
```

---

## Task 3: `sendTierClaimPayment()` in `lib/stellar-payment.ts`

**Files:**
- Modify: `telegram-app/lib/stellar-payment.ts`
- Test: `telegram-app/__tests__/tierClaimPayment.test.ts`

**Interfaces:**
- Consumes: `REWARD_SENDER_SECRET`, `parseHorizonError`, `prizeToAsset` (all already exported/imported in this file); `Database['public']['Tables']['tier_reward_claims']['Row']` type from Task 1.
- Produces:
```typescript
export async function sendTierClaimPayment(
  claim: { id: number; gold_amount: number; silver_amount: number; copper_amount: number },
  destination: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<PaymentResult>
```
Later tasks (API route, admin retry route) call this exact signature.

- [ ] **Step 1: Write the failing test**

The fake Supabase client below is a minimal chainable query builder, not the ad hoc per-call-shape stub from earlier drafts of this plan — `sendTierClaimPayment` awaits some update chains directly (`.eq().eq()` with no trailing `.select()`, used by the failure-rollback path) and calls `.select()` on others; the fake must resolve correctly either way, against one shared mutable row, since real `supabase-js` query builders are thenable at every step.

```typescript
// telegram-app/__tests__/tierClaimPayment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const submitTransaction = vi.fn()
const loadAccount = vi.fn()

vi.mock('stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('stellar-sdk')>('stellar-sdk')
  return {
    ...actual,
    Horizon: {
      Server: vi.fn().mockImplementation(() => ({
        loadAccount,
        submitTransaction,
      })),
    },
  }
})

process.env.REWARD_SENDER_SECRET = 'SBZVMB4PC5FGBQ5G6HPXWJ4EVQ3KAQVGF3MF5DZTKZTLHXVUFH2WHXK'
process.env.NEXT_PUBLIC_REWARD_ASSET_ISSUER = 'GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL'

import { sendTierClaimPayment } from '@/lib/stellar-payment'

// Minimal chainable query builder over one shared mutable row. Every step
// (each .eq(), a trailing .select(), or awaiting the chain directly with
// no .select()) resolves the same way real supabase-js does — as a thenable.
function fakeSupabase(initialRow: Record<string, unknown>) {
  const row: Record<string, unknown> = { ...initialRow }

  function makeBuilder(patch: Record<string, unknown>, filters: [string, unknown][]) {
    async function apply() {
      const matched = filters.every(([col, val]) => row[col] === val)
      if (matched) Object.assign(row, patch)
      return matched
    }
    return {
      eq(col: string, val: unknown) {
        return makeBuilder(patch, [...filters, [col, val]])
      },
      async select(_cols?: string) {
        const matched = await apply()
        return { data: matched ? [{ ...row }] : [], error: null }
      },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        apply().then(() => resolve({ data: null, error: null }), reject)
      },
    }
  }

  return {
    from: (_table: string) => ({ update: (patch: Record<string, unknown>) => makeBuilder(patch, []) }),
    getRow: () => row,
  }
}

beforeEach(() => {
  submitTransaction.mockReset()
  loadAccount.mockReset()
  loadAccount.mockResolvedValue({
    accountId: () => 'GSENDER',
    sequenceNumber: () => '1',
    incrementSequenceNumber: () => {},
  })
})

describe('sendTierClaimPayment', () => {
  it('refuses to send when the claim row is not pending', async () => {
    const supabase = fakeSupabase({ id: 1, payout_status: 'paid' })
    const result = await sendTierClaimPayment(
      { id: 1, gold_amount: 5, silver_amount: 40, copper_amount: 500 },
      'GDEST',
      supabase,
    )
    expect(result.sent).toBe(false)
    expect(result.code).toBe('ALREADY_PAID')
    expect(submitTransaction).not.toHaveBeenCalled()
  })

  it('only includes non-zero asset legs in the transaction', async () => {
    submitTransaction.mockResolvedValue({ hash: 'txhash123' })
    const supabase = fakeSupabase({ id: 2, payout_status: 'pending' })
    const result = await sendTierClaimPayment(
      { id: 2, gold_amount: 5, silver_amount: 0, copper_amount: 10 },
      'GDEST',
      supabase,
    )
    expect(result.sent).toBe(true)
    // submitTransaction receives the real, unmocked Transaction built by
    // TransactionBuilder — .operations reflects exactly what was added.
    const submittedTx = submitTransaction.mock.calls[0][0] as { operations: unknown[] }
    expect(submittedTx.operations).toHaveLength(2) // gold + copper, silver skipped
    expect(supabase.getRow().payout_status).toBe('paid')
    expect(supabase.getRow().payout_tx_hash).toBe('txhash123')
  })

  it('rolls back to pending and records the error when Horizon submission fails', async () => {
    submitTransaction.mockRejectedValue({
      response: { data: { extras: { result_codes: { transaction: 'tx_bad_auth' } } } },
    })
    const supabase = fakeSupabase({ id: 3, payout_status: 'pending' })
    const result = await sendTierClaimPayment(
      { id: 3, gold_amount: 5, silver_amount: 40, copper_amount: 500 },
      'GDEST',
      supabase,
    )
    expect(result.sent).toBe(false)
    expect(result.code).toBe('BAD_AUTH')
    expect(supabase.getRow().payout_status).toBe('pending')
    expect(supabase.getRow().payout_notes).toContain('BAD_AUTH')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd telegram-app && npx vitest run __tests__/tierClaimPayment.test.ts -v`
Expected: FAIL — `sendTierClaimPayment is not a function` (it doesn't exist yet).

- [ ] **Step 3: Implement `sendTierClaimPayment`**

Add to `lib/stellar-payment.ts`, after the existing `sendPrizePayment` function:

```typescript
/**
 * Send a tier reward claim payment — one atomic transaction with up to 3
 * payment operations (gold/silver/copper). Sibling to sendPrizePayment,
 * not a generalization of it: operates on tier_reward_claims instead of
 * lucky_draw_wins, and builds a multi-operation transaction instead of one.
 *
 * @param claim        Row from tier_reward_claims (id + the 3 amounts)
 * @param destination  Recipient's Stellar public key
 * @param supabase     Service-role Supabase client
 */
export async function sendTierClaimPayment(
  claim: { id: number; gold_amount: number; silver_amount: number; copper_amount: number },
  destination: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<PaymentResult> {
  if (!REWARD_SENDER_SECRET) {
    return { sent: false, error: 'REWARD_SENDER_SECRET not configured', code: 'CONFIG_ERROR' }
  }

  const legs: { code: 'wGOLD' | 'wSILVER' | 'wCOPPER'; amount: number }[] = [
    { code: 'wGOLD', amount: claim.gold_amount },
    { code: 'wSILVER', amount: claim.silver_amount },
    { code: 'wCOPPER', amount: claim.copper_amount },
  ].filter((leg) => leg.amount > 0)

  if (legs.length === 0) {
    return { sent: false, error: 'Claim has no non-zero reward amounts', code: 'NOT_SENDABLE' }
  }

  const assets = legs.map((leg) => ({ leg, asset: prizeToAsset(`${leg.amount} ${leg.code}`) }))
  const missing = assets.find((a) => !a.asset || !a.asset.issuer)
  if (missing) {
    return { sent: false, error: `Issuer not configured for ${missing.leg.code}`, code: 'CONFIG_ERROR' }
  }

  try {
    const { data: claimed, error: claimError } = await supabase
      .from('tier_reward_claims')
      .update({ payout_status: 'paying' })
      .eq('id', claim.id)
      .eq('payout_status', 'pending')
      .select('id')
    if (claimError) {
      return { sent: false, error: claimError.message, code: 'DB_ERROR' }
    }
    if (!claimed?.length) {
      return { sent: false, error: 'Claim is not pending (already paid or in flight)', code: 'ALREADY_PAID' }
    }

    const senderKeypair = Keypair.fromSecret(REWARD_SENDER_SECRET)
    const server = new Horizon.Server(HORIZON_URL)
    const senderAccount = await server.loadAccount(senderKeypair.publicKey())

    const txBuilder = new TransactionBuilder(senderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC,
    })

    for (const { leg, asset } of assets) {
      txBuilder.addOperation(Operation.payment({
        destination,
        asset: new Asset(asset!.code, asset!.issuer),
        amount: String(leg.amount),
      }))
    }

    const tx = txBuilder.addMemo(Memo.text(REWARD_MEMO)).setTimeout(180).build()
    tx.sign(senderKeypair)
    const result = await server.submitTransaction(tx)

    const { error: paidError } = await supabase.from('tier_reward_claims').update({
      payout_status: 'paid',
      payout_tx_hash: result.hash,
      payout_notes: `Auto-sent. Memo: ${REWARD_MEMO}`,
    }).eq('id', claim.id)

    if (paidError) {
      console.error(`sendTierClaimPayment: paid update failed for claim ${claim.id}, txHash ${result.hash}:`, paidError.message)
    }

    return { sent: true, txHash: result.hash }
  } catch (err) {
    const { message, code } = parseHorizonError(err)
    console.error(`sendTierClaimPayment error [${code}]:`, message)

    await supabase.from('tier_reward_claims')
      .update({ payout_status: 'pending', payout_notes: `Auto-send failed: ${code} ${message}`.slice(0, 200) })
      .eq('id', claim.id).eq('payout_status', 'paying')

    const failedAsset = assets[0]?.asset
    return {
      sent: false,
      error: message,
      code,
      lobstrDeeplink: code === 'NO_TRUST' ? failedAsset?.lobstrDeeplink : undefined,
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd telegram-app && npx vitest run __tests__/tierClaimPayment.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add telegram-app/lib/stellar-payment.ts telegram-app/__tests__/tierClaimPayment.test.ts
git commit -m "feat: add sendTierClaimPayment for multi-asset tier reward claims"
```

---

## Task 4: `POST`/`GET /api/rewards/claim`

**Files:**
- Create: `telegram-app/app/api/rewards/claim/route.ts`
- Test: `telegram-app/__tests__/rewardsClaimMonth.test.ts` (UTC month-pinning helper only — the route itself needs live Supabase/Horizon and is covered by manual verification in Task 8)

**Interfaces:**
- Consumes: `validateTelegramInitData` (`lib/telegram.ts`), `createServiceClient` (`lib/supabase-server.ts`), `ok`/`fail` (`lib/api-response.ts`), `checkRateLimit` (`lib/rate-limit.ts`), `getTierForBalance` (`config/tiers.ts`), `sendTierClaimPayment` (Task 3).
- Produces: `GET /api/rewards/claim` → `{ claimed: boolean, tierId?: string, payoutStatus?: string, txHash?: string }` for the current UTC month. `POST /api/rewards/claim` → `{ claimed: true, txHash }` on success, or a `fail()` response with `code` one of `UNAUTHORIZED | RATE_LIMITED | NOT_FOUND | NO_REWARDS | ALREADY_CLAIMED | NO_TRUST | CONFIG_ERROR | HORIZON_ERROR | DB_ERROR`.

- [ ] **Step 1: Write the failing test for the UTC month helper**

```typescript
// telegram-app/__tests__/rewardsClaimMonth.test.ts
import { describe, it, expect } from 'vitest'
import { utcMonthStart } from '@/app/api/rewards/claim/route'

describe('utcMonthStart', () => {
  it('returns the first day of the UTC month as YYYY-MM-DD', () => {
    const d = new Date('2026-08-15T23:59:00Z')
    expect(utcMonthStart(d)).toBe('2026-08-01')
  })

  it('handles a date near a UTC month boundary correctly regardless of local offset', () => {
    // 2026-03-01T00:30:00Z is still March 1st in UTC even if the test
    // runner's local timezone would put it in February.
    const d = new Date('2026-03-01T00:30:00Z')
    expect(utcMonthStart(d)).toBe('2026-03-01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd telegram-app && npx vitest run __tests__/rewardsClaimMonth.test.ts -v`
Expected: FAIL — module `@/app/api/rewards/claim/route` doesn't exist yet.

- [ ] **Step 3: Implement the route**

```typescript
// telegram-app/app/api/rewards/claim/route.ts
import { NextRequest } from 'next/server'
import { validateTelegramInitData } from '@/lib/telegram'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { getTierForBalance } from '@/config/tiers'
import { sendTierClaimPayment } from '@/lib/stellar-payment'
import { BRANDING } from '@/config/branding'

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
  const user = getUser(req)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED', 401)

  const limited = checkRateLimit(req, 30, `rewards-claim-status:${user.id}`)
  if (limited) return limited

  const supabase = createServiceClient()
  const month = utcMonthStart(new Date())
  const { data: claim } = await supabase
    .from('tier_reward_claims')
    .select('tier_id, payout_status, payout_tx_hash')
    .eq('telegram_id', user.id)
    .eq('claim_month', month)
    .maybeSingle()

  if (!claim) return ok({ claimed: false })
  return ok({
    claimed: true,
    tierId: claim.tier_id,
    payoutStatus: claim.payout_status,
    txHash: claim.payout_tx_hash,
  })
}

export async function POST(req: NextRequest) {
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
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return fail('Already claimed this month', 'ALREADY_CLAIMED', 409)
    return fail(insertError.message, 'DB_ERROR', 500)
  }

  const payment = await sendTierClaimPayment(
    { id: inserted.id, gold_amount: tier.rewards.gold, silver_amount: tier.rewards.silver, copper_amount: tier.rewards.copper },
    resolved.stellarAddress,
    supabase,
  )

  if (tier.rewards.physicalGold && ADMIN_TELEGRAM_ID) {
    void notifyAdminPhysicalGold(user.id, user.username ?? null)
    await supabase.from('tier_reward_claims').update({ physical_gold_notified: true }).eq('id', inserted.id)
  }

  if (payment.sent) {
    return ok({ claimed: true, txHash: payment.txHash })
  }

  if (payment.code === 'NO_TRUST') {
    return fail(payment.error ?? 'Missing trustline', 'NO_TRUST', 502)
  }
  return fail(payment.error ?? 'Payment failed', payment.code ?? 'HORIZON_ERROR', 502)
}

/** Fire-and-forget Telegram DM to the admin — never blocks or fails the claim. */
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
```

Note: this deliberately uses `ADMIN_TELEGRAM_ID` (the existing numeric server-side env var, already used in `app/api/admin/user/[telegramId]/route.ts`) rather than `NEXT_PUBLIC_ADMIN_TELEGRAM_USERNAMES` — the Telegram Bot API sends messages by numeric `chat_id`, not by username, so the numeric var is the only one that actually works for this.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd telegram-app && npx vitest run __tests__/rewardsClaimMonth.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd telegram-app && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add telegram-app/app/api/rewards/claim/route.ts telegram-app/__tests__/rewardsClaimMonth.test.ts
git commit -m "feat: add /api/rewards/claim route"
```

---

## Task 5: Admin retry route

**Files:**
- Create: `telegram-app/app/api/admin/retry-tier-claim/route.ts`

**Interfaces:**
- Consumes: `verifyAdminToken` (`app/api/admin/route.ts`), `sendTierClaimPayment` (Task 3), `createServiceClient`.
- Produces: `POST /api/admin/retry-tier-claim` with body `{ claimId: number }` → `{ sent: true, txHash }` or `fail()` with the same error codes as Task 4's POST.

- [ ] **Step 1: Implement the route**

```typescript
// telegram-app/app/api/admin/retry-tier-claim/route.ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'
import { sendTierClaimPayment, REWARD_SENDER_SECRET } from '@/lib/stellar-payment'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  if (!REWARD_SENDER_SECRET) return fail('REWARD_SENDER_SECRET not configured', 'CONFIG_ERROR', 500)

  const body = await req.json().catch(() => null)
  const claimId = body?.claimId
  if (!claimId) return fail('Missing claimId', 'BAD_REQUEST')

  const supabase = createServiceClient()

  const { data: claim } = await supabase
    .from('tier_reward_claims')
    .select('id, telegram_id, gold_amount, silver_amount, copper_amount, payout_status')
    .eq('id', claimId)
    .single()

  if (!claim) return fail('Claim not found', 'NOT_FOUND', 404)
  if (claim.payout_status === 'paid' || claim.payout_status === 'paying') {
    return fail('Already paid or in flight', 'ALREADY_PAID', 409)
  }

  const { data: userRow } = await supabase.from('users').select('id').eq('telegram_id', claim.telegram_id).single()
  if (!userRow) return fail('User not found', 'NOT_FOUND', 404)

  const { data: walletRow } = await supabase
    .from('wallets').select('stellar_address').eq('user_id', userRow.id).eq('is_primary', true).single()
  if (!walletRow) return fail('Wallet not found', 'NOT_FOUND', 404)

  const payment = await sendTierClaimPayment(claim, walletRow.stellar_address, supabase)

  if (payment.sent) return ok({ sent: true, txHash: payment.txHash })
  if (payment.code === 'NO_TRUST') {
    return fail(payment.error ?? 'Missing trustline', 'NO_TRUST', 502)
  }
  return fail(payment.error ?? 'Payment failed', payment.code ?? 'HORIZON_ERROR', 502)
}
```

- [ ] **Step 2: Typecheck**

Run: `cd telegram-app && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add telegram-app/app/api/admin/retry-tier-claim/route.ts
git commit -m "feat: add admin retry route for tier reward claims"
```

---

## Task 6: Admin claims list page + `GET /api/admin/tier-claims`

**Files:**
- Create: `telegram-app/app/api/admin/tier-claims/route.ts`
- Create: `telegram-app/app/admin/rewards-claims/page.tsx`
- Modify: `telegram-app/app/admin/components/AdminShell.tsx` (add nav entry)

**Interfaces:**
- Consumes: `verifyAdminToken`, `createServiceClient`, `useAdminToken` hook (`app/admin/hooks/useAdminToken.ts`), the `/api/admin/retry-tier-claim` route from Task 5.
- Produces: nav entry `/admin/rewards-claims` visible in the admin shell's "Activity" section.

- [ ] **Step 1: Implement the list API**

```typescript
// telegram-app/app/api/admin/tier-claims/route.ts
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const supabase = createServiceClient()
  const { data: claims, error } = await supabase
    .from('tier_reward_claims')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return fail('Failed to fetch claims', 'DB_ERROR', 500)

  const telegramIds = [...new Set((claims ?? []).map((c) => c.telegram_id))]
  const userMap: Record<number, { first_name: string | null; username: string | null }> = {}
  if (telegramIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('telegram_id, telegram_first_name, telegram_username')
      .in('telegram_id', telegramIds)
    for (const u of users ?? []) {
      userMap[u.telegram_id] = { first_name: u.telegram_first_name ?? null, username: u.telegram_username ?? null }
    }
  }

  return ok({
    claims: (claims ?? []).map((c) => ({
      ...c,
      user_first_name: userMap[c.telegram_id]?.first_name ?? null,
      user_username: userMap[c.telegram_id]?.username ?? null,
    })),
  })
}
```

- [ ] **Step 2: Implement the admin page**

```tsx
// telegram-app/app/admin/rewards-claims/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAdminToken } from '@/app/admin/hooks/useAdminToken'

interface ClaimRow {
  id: number
  telegram_id: number
  user_first_name: string | null
  user_username: string | null
  tier_id: string
  claim_month: string
  gold_amount: number
  silver_amount: number
  copper_amount: number
  payout_status: 'pending' | 'paying' | 'paid'
  payout_tx_hash: string | null
  physical_gold_notified: boolean
  created_at: string
}

const STATUS_COLOR: Record<ClaimRow['payout_status'], string> = {
  pending: 'text-yellow-400',
  paying: 'text-blue-400',
  paid: 'text-green-400',
}

export default function RewardsClaimsPage() {
  const token = useAdminToken() ?? ''
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch('/api/admin/tier-claims', { headers: { 'x-admin-token': token } })
    const json = await res.json()
    if (json.success) setClaims(json.data.claims)
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function retry(claimId: number) {
    setRetrying(claimId)
    await fetch('/api/admin/retry-tier-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ claimId }),
    })
    setRetrying(null)
    load()
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-bold mb-4">Tier Reward Claims</h1>
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-white/10">
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Tier</th>
              <th className="py-2 pr-4">Month</th>
              <th className="py-2 pr-4">Gold</th>
              <th className="py-2 pr-4">Silver</th>
              <th className="py-2 pr-4">Copper</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Tx</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="py-2 pr-4">{c.user_username ? `@${c.user_username}` : c.user_first_name ?? c.telegram_id}</td>
                <td className="py-2 pr-4">{c.tier_id}</td>
                <td className="py-2 pr-4">{c.claim_month}</td>
                <td className="py-2 pr-4">{c.gold_amount}</td>
                <td className="py-2 pr-4">{c.silver_amount}</td>
                <td className="py-2 pr-4">{c.copper_amount}</td>
                <td className={`py-2 pr-4 font-semibold ${STATUS_COLOR[c.payout_status]}`}>{c.payout_status.toUpperCase()}</td>
                <td className="py-2 pr-4 font-mono text-xs">{c.payout_tx_hash ? `${c.payout_tx_hash.slice(0, 8)}…` : '—'}</td>
                <td className="py-2 pr-4">
                  {c.payout_status !== 'paid' && (
                    <button
                      onClick={() => retry(c.id)}
                      disabled={retrying === c.id}
                      className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-50"
                    >
                      {retrying === c.id ? 'Retrying…' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the nav entry**

In `app/admin/components/AdminShell.tsx`, find the `'Activity'` section's `items` array (contains `/admin/wins`). Add immediately after the `/admin/wins` entry:

```typescript
      { href: '/admin/rewards-claims', label: 'Reward Claims', icon: 'diamond' },
```

- [ ] **Step 4: Typecheck**

Run: `cd telegram-app && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add telegram-app/app/api/admin/tier-claims/route.ts telegram-app/app/admin/rewards-claims/page.tsx telegram-app/app/admin/components/AdminShell.tsx
git commit -m "feat: add admin reward claims list page"
```

---

## Task 7: Rewards page — claim button

**Files:**
- Modify: `telegram-app/app/rewards/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/rewards/claim` (Task 4), `getTelegramInitData` (`lib/telegram.ts` — check existing imports elsewhere in this file's sibling pages for the exact import path/usage before adding).

- [ ] **Step 1: Add claim state to `RewardsPage`**

In `app/rewards/page.tsx`, inside `export default function RewardsPage()`, after the existing `progressPct` calculation, add:

```typescript
  const [claimStatus, setClaimStatus] = useState<{ claimed: boolean; txHash?: string; payoutStatus?: string } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<{ message: string; lobstrDeeplink?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadClaimStatus() {
      const initData = getTelegramInitData()
      const res = await fetch('/api/rewards/claim', { headers: { 'x-telegram-init-data': initData } })
      const json = await res.json()
      if (!cancelled && json.success) setClaimStatus(json.data)
    }
    loadClaimStatus()
    return () => { cancelled = true }
  }, [])

  async function handleClaim() {
    setClaiming(true)
    setClaimError(null)
    const initData = getTelegramInitData()
    const res = await fetch('/api/rewards/claim', {
      method: 'POST',
      headers: { 'x-telegram-init-data': initData },
    })
    const json = await res.json()
    setClaiming(false)
    if (json.success) {
      setClaimStatus({ claimed: true, txHash: json.data.txHash, payoutStatus: 'paid' })
    } else if (json.code === 'NO_TRUST') {
      setClaimError({ message: json.error, lobstrDeeplink: json.lobstrDeeplink })
    } else if (json.code === 'ALREADY_CLAIMED') {
      setClaimStatus({ claimed: true })
    } else {
      setClaimError({ message: json.error ?? 'Claim failed — try again later.' })
    }
  }
```

Add the needed imports at the top of the file:
```typescript
import { useState, useEffect } from 'react'
import { getTelegramInitData } from '@/lib/telegram'
```

(Check whether `useState`/`useEffect` are already imported from `'react'` in this file before adding — merge into the existing import line if so.)

- [ ] **Step 2: Add the claim UI to the current tier's `TierCard`**

`TierCard` currently renders the Buy CTA when `isCurrent && nextTier && progressPct !== undefined`, and a "Maximum tier reached" line when `isCurrent && !nextTier`. Add a claim section that renders for *any* current tier with non-null rewards, regardless of `nextTier`. Extend `TierCard`'s props and JSX:

```typescript
function TierCard({ tier, status, balance, nextTier, progressPct, onBuy, claimStatus, onClaim, claiming, claimError }: {
  tier: Tier
  status: 'current' | 'past' | 'next' | 'locked'
  balance: number
  nextTier?: Tier | null
  progressPct?: number
  onBuy?: () => void
  claimStatus?: { claimed: boolean; txHash?: string } | null
  onClaim?: () => void
  claiming?: boolean
  claimError?: { message: string; lobstrDeeplink?: string } | null
}) {
```

Inside the component, after the existing `{isCurrent && !nextTier && (...Maximum tier reached...)}` block, add:

```tsx
      {isCurrent && r && (
        <div className="mt-2.5 pt-2.5 border-t border-white/8">
          {claimStatus?.claimed ? (
            <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/25">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Claimed this month
              {claimStatus.txHash && (
                <a
                  href={`https://stellar.expert/explorer/public/tx/${claimStatus.txHash}`}
                  target="_blank" rel="noreferrer"
                  className="underline ml-1"
                >
                  view tx
                </a>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={onClaim}
                disabled={claiming}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-black transition active:scale-[0.98] disabled:opacity-50"
                style={{ background: tier.color }}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>redeem</span>
                {claiming ? 'Claiming…' : 'Claim This Month\'s Rewards'}
              </button>
              {claimError && (
                <p className="text-[9px] text-red-400 mt-1.5 text-center">
                  {claimError.message}
                  {claimError.lobstrDeeplink && (
                    <> — <a href={claimError.lobstrDeeplink} target="_blank" rel="noreferrer" className="underline">add trustline</a></>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}
```

- [ ] **Step 3: Wire the props at the call site**

In the `TIERS.filter(...).map(...)` block, pass the new props only for the current tier:

```tsx
              <TierCard
                key={tier.id}
                tier={tier}
                status={status}
                balance={balance}
                nextTier={status === 'current' ? nextTier : undefined}
                progressPct={status === 'current' ? progressPct : undefined}
                onBuy={status === 'current' && nextTier ? () => router.push('/buy') : undefined}
                claimStatus={status === 'current' ? claimStatus : undefined}
                onClaim={status === 'current' ? handleClaim : undefined}
                claiming={status === 'current' ? claiming : undefined}
                claimError={status === 'current' ? claimError : undefined}
              />
```

- [ ] **Step 4: Typecheck**

Run: `cd telegram-app && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Manual browser verification**

Run: `cd telegram-app && npm run dev`, navigate to `/rewards` with `NEXT_PUBLIC_DEV_BYPASS=true` and a wallet connected via localStorage (see Task 8 for the exact steps used earlier this session). Confirm:
- Current tier card shows the claim button.
- Clicking it calls the API (network tab) — full success requires a funded/trustlined wallet, which this environment doesn't have; confirming the button renders and the request fires is sufficient here.
- Reloading the page re-fetches claim status via the `GET` call.

- [ ] **Step 6: Commit**

```bash
git add telegram-app/app/rewards/page.tsx
git commit -m "feat: add claim button to rewards page current-tier card"
```

---

## Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd telegram-app && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `cd telegram-app && npx vitest run`
Expected: all tests pass, including the new ones from Tasks 2, 3, 4.

- [ ] **Step 3: Lint the changed files**

Run: `cd telegram-app && npx eslint app/api/rewards/claim/route.ts app/api/admin/retry-tier-claim/route.ts app/api/admin/tier-claims/route.ts app/admin/rewards-claims/page.tsx app/rewards/page.tsx lib/stellar-payment.ts lib/rewardAssets.ts`
Expected: no new errors introduced by this feature (pre-existing errors elsewhere in `app/rewards/page.tsx`, if any, are out of scope — verify via `git diff` line numbers that any reported errors predate this change).

- [ ] **Step 4: Update CLAUDE.md**

Add a `### Rewards Claim Flow` subsection under "LESSONS LEARNED" (or extend the existing Rewards/Games Hub notes) documenting: `tier_reward_claims` table, one claim per UTC month, `sendTierClaimPayment` sibling pattern, `wGOLD`/`wSILVER`/`wCOPPER` new assets, `ADMIN_TELEGRAM_ID` used for the physical-gold notify (not the username env var). Also remove the completed "Rewards page — actual claim flow (not just display)" line from the "Improvements Backlog" section.

- [ ] **Step 5: Commit**

```bash
git add telegram-app/CLAUDE.md
git commit -m "docs: document rewards claim flow in CLAUDE.md"
```

---

## Self-Review Notes (for the implementer)

- Task 1's migration push and Task 8 assume you'll confirm with the user before any `supabase db push` — do not skip that confirmation.
- `REWARD_SENDER_SECRET` in Task 3's test is a syntactically-valid but non-real Stellar secret key (starts with `S`, correct length) — it's never actually used to sign a real submitted transaction since `submitTransaction` is mocked; it only needs to pass `Keypair.fromSecret()`'s format validation.
- No env vars need to be added to Vercel for this feature — `REWARD_SENDER_SECRET`, `NEXT_PUBLIC_REWARD_ASSET_ISSUER`, `TELEGRAM_BOT_TOKEN`, and `ADMIN_TELEGRAM_ID` all already exist from prior features.
- If `ADMIN_TELEGRAM_ID` is not actually set in the current environment, the physical-gold notify silently no-ops (by design — it should never block a successful claim) — flag this to the user if `admin/rewards-claims` shows a tier-10 claim with `physical_gold_notified: false`.
