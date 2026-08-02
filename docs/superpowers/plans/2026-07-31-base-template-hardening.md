# NSAFL Base Template Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the exploitable holes (server-side prize engine, auth hardening, donations verification), fix correctness bugs, and extract a branding layer so the repo works as a clone-and-rebrand base template.

**Architecture:** New `lib/gamePool.ts` owns prize tables, RNG, spin status and consumption for all three games; game routes become thin wrappers that roll server-side and return the result for the client to animate to. Auth fixes concentrate in `lib/telegram.ts` and `app/api/admin/route.ts`. A new `config/branding.ts` centralizes per-clone strings/colors/flags.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service client), stellar-sdk, vitest.

## Global Constraints

- Never hardcode asset names; use `PRIMARY_CUSTOM_ASSET_CODE` / `PRIMARY_CUSTOM_ASSET_LABEL` from `@/lib/constants`.
- Design tokens: background `#0A0E1A`, gold `#D4AF37`.
- Commit as the repo's configured git user only. NO Claude attribution of any kind (no Co-Authored-By, no "Generated with Claude Code").
- DO NOT TOUCH: `components/TrustlineModal.tsx` secret-key posting, `app/api/auth/verify-wallet-key/route.ts`, `app/api/trustlines/record/route.ts` (owner is testing this flow locally — explicitly out of scope).
- Rewards / Stats / Profile pages are marked LOCKED in CLAUDE.md — only make the specific changes this plan names on them, nothing else.
- Verification for every task: `cd telegram-app && npx tsc --noEmit` (0 errors). Tests: `npx vitest run`.
- All paths below are relative to `telegram-app/` unless prefixed with `<root>/`.

---

### Task 1: `lib/gamePool.ts` — prize tables + server RNG

**Files:**
- Create: `lib/gamePool.ts`
- Create: `__tests__/gamePool.test.ts`

**Interfaces:**
- Produces: `type GameSource = 'lucky_draw' | 'slot_machine' | 'scratch_card'`;
  `interface GamePrize { label: string; amount: number | null; weight: number }`;
  `PRIZE_TABLES: Record<GameSource, GamePrize[]>`; `rollPrize(source: GameSource): { prize: GamePrize; index: number }`.

- [ ] **Step 1: Copy the three client prize tables into one server module**

The authoritative data already exists client-side. Copy label/amount/weight EXACTLY from:
- Lucky Draw: `PRIZES` array at `app/game/page.tsx:59` (11 entries, e.g. `{ label: "100 wXLM", weight: 15, amount: 100 }`; entries like "Free Spin", "+2 Spins", "Better Luck" have `amount: null`)
- Slot: prize/combination table in `components/SlotMachine.tsx` (near top, includes "+2 Spins", "Better Luck")
- Scratch: prize table in `components/ScratchCard.tsx` (includes "+2 Cards", "Better Luck")

```ts
// lib/gamePool.ts
export type GameSource = 'lucky_draw' | 'slot_machine' | 'scratch_card'

export interface GamePrize {
  label: string          // exact string stored in lucky_draw_wins.prize, e.g. "100 wXLM"
  amount: number | null  // asset amount for sendable prizes, null for non-asset outcomes
  weight: number
}

export const PRIZE_TABLES: Record<GameSource, GamePrize[]> = {
  lucky_draw: [
    { label: '100 wXLM', amount: 100, weight: 15 },
    // ... copy ALL entries verbatim from app/game/page.tsx PRIZES (label, amount, weight)
  ],
  slot_machine: [
    // ... copy from components/SlotMachine.tsx
  ],
  scratch_card: [
    // ... copy from components/ScratchCard.tsx
  ],
}

export function rollPrize(source: GameSource): { prize: GamePrize; index: number } {
  const table = PRIZE_TABLES[source]
  const total = table.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < table.length; i++) {
    r -= table[i].weight
    if (r <= 0) return { prize: table[i], index: i }
  }
  return { prize: table[table.length - 1], index: table.length - 1 }
}
```

The `// ...` comments above are instructions to the implementer to transcribe the literal
data from the named files — the final file must contain every entry and no comments of that kind.

- [ ] **Step 2: Write tests**

```ts
// __tests__/gamePool.test.ts
import { describe, it, expect } from 'vitest'
import { PRIZE_TABLES, rollPrize } from '@/lib/gamePool'
import { prizeToAsset } from '@/lib/rewardAssets'

describe('PRIZE_TABLES', () => {
  it('every table has positive weights and at least one non-asset outcome', () => {
    for (const table of Object.values(PRIZE_TABLES)) {
      expect(table.length).toBeGreaterThan(0)
      for (const p of table) expect(p.weight).toBeGreaterThan(0)
    }
  })
  it('every asset-shaped label has a numeric amount matching its label prefix', () => {
    for (const table of Object.values(PRIZE_TABLES)) {
      for (const p of table) {
        if (prizeToAsset(p.label)) {
          expect(p.amount).toBe(Number(p.label.trim().split(/\s+/)[0]))
        }
      }
    }
  })
  it('rollPrize always returns an entry from its own table', () => {
    for (let i = 0; i < 200; i++) {
      const { prize, index } = rollPrize('lucky_draw')
      expect(PRIZE_TABLES.lucky_draw[index]).toBe(prize)
    }
  })
})
```

- [ ] **Step 3: Run `npx vitest run __tests__/gamePool.test.ts` — PASS; `npx tsc --noEmit` — 0 errors**
- [ ] **Step 4: Commit** `git add lib/gamePool.ts __tests__/gamePool.test.ts && git commit -m "feat: server-side prize tables and RNG for all games"`

---

### Task 2: `lib/gamePool.ts` — shared spin status + atomic welcome seed + consumption

**Files:**
- Modify: `lib/gamePool.ts`
- Reference (to replace later): `app/api/game/win/route.ts:26-85`, same helper in `slot/route.ts` and `scratch/route.ts`

**Interfaces:**
- Consumes: `createServiceClient` from `@/lib/supabase-server`, `getTierForBalance`, `TIERS` from `@/config/tiers`.
- Produces: `GAME_LIMITS: Record<GameSource, number>`;
  `getSpinStatus(supabase, telegramId, source): Promise<SpinStatus>` (same `SpinStatus` shape as `app/api/game/win/route.ts:18-24` plus `walletAddress: string | null`);
  `consumeSpin(supabase, telegramId, source): Promise<{ ok: boolean }>`.

- [ ] **Step 1: Port the status helper, generalized**

Port `getSpinStatus` from `app/api/game/win/route.ts:26-85` with these changes:
1. Parameter `source: GameSource`; daily count filters `.eq('prize_source', source)`; daily base from `GAME_LIMITS = { lucky_draw: 3, slot_machine: 3, scratch_card: 1 }` (tier 1+; tier 0 base stays 0).
2. Also select the user's primary wallet address (`wallets.stellar_address` where `is_primary`) and return it as `walletAddress` — payout destination comes from here, never from a request body.
3. Welcome seed — ONE seed for the whole pool, race-free:

```ts
// Replaces the per-route blind update at win/route.ts:53-65 (and slot/scratch copies).
// Gate: user has never played ANY game AND pool is exactly 0.
// The .eq('bonus_spins', 0) makes the write atomic — parallel calls: only one wins.
if (isTier0 && bonusSpins === 0 && userRow?.id) {
  const { count: everPlayed } = await (supabase as any)
    .from('lucky_draw_wins')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)          // NOTE: no prize_source filter — all games
  if ((everPlayed ?? 0) === 0) {
    const { data: seeded } = await (supabase as any)
      .from('users')
      .update({ bonus_spins: WELCOME_SPINS_TIER0 })   // = 3
      .eq('telegram_id', telegramId)
      .eq('bonus_spins', 0)                 // optimistic lock: seed exactly once
      .select('bonus_spins')
    if (seeded?.length) bonusSpins = WELCOME_SPINS_TIER0
    else {
      const { data: fresh } = await (supabase as any)
        .from('users').select('bonus_spins').eq('telegram_id', telegramId).single()
      bonusSpins = fresh?.bonus_spins ?? 0
    }
  }
}
```

4. `consumeSpin` = the check-and-decrement currently inlined at `win/route.ts:120-138`, moved verbatim into the module (status check, then optimistic-locked bonus decrement when daily base exhausted). Returns `{ ok: false }` instead of the route's 429.

- [ ] **Step 2: `npx tsc --noEmit` — 0 errors; `npx vitest run` — existing tests still pass**
- [ ] **Step 3: Commit** `git commit -am "feat: shared spin status, atomic welcome seed, spin consumption in gamePool"`

---

### Task 3: Payout idempotency in `lib/stellar-payment.ts`

**Files:**
- Modify: `lib/stellar-payment.ts:78-138`

**Interfaces:**
- Produces: unchanged signature `sendPrizePayment(prize, amount, destination, winId, supabase)`; new behavior: refuses if win row is not `payout_status = 'pending'`.

- [ ] **Step 1: Claim the row before submitting**

Insert at the top of the `try` block in `sendPrizePayment` (before `Keypair.fromSecret`, currently line 95):

```ts
// Idempotency: claim the row first. If a previous attempt already claimed or paid
// this win (crash between submit and update, admin double-click), refuse to re-send.
const { data: claimed } = await supabase
  .from('lucky_draw_wins')
  .update({ payout_status: 'paying' })
  .eq('id', winId)
  .eq('payout_status', 'pending')
  .select('id')
if (!claimed?.length) {
  return { sent: false, error: 'Win is not pending (already paid or in flight)', code: 'ALREADY_PAID' }
}
```

And in the `catch` block (after `parseHorizonError`), release the claim so admin retry works:

```ts
await supabase.from('lucky_draw_wins')
  .update({ payout_status: 'pending', payout_notes: `Auto-send failed: ${code} ${message}`.slice(0, 200) })
  .eq('id', winId).eq('payout_status', 'paying')
```

Check `app/api/admin/send-reward/route.ts` after this change: it already guards `ALREADY_PAID` — make sure new rows inserted by game routes (Task 4) set `payout_status: 'pending'` explicitly, and that the admin route treats `'paying'` as not retryable.

- [ ] **Step 2: `npx tsc --noEmit`; commit** `git commit -am "fix: idempotent prize payout — claim win row before Horizon submit"`

---

### Task 4: Rewrite the three game POST routes — server rolls, server pays

**Files:**
- Modify: `app/api/game/win/route.ts`, `app/api/game/slot/route.ts`, `app/api/game/scratch/route.ts`

**Interfaces:**
- Consumes: `rollPrize`, `getSpinStatus`, `consumeSpin`, `GAME_LIMITS` from `@/lib/gamePool`.
- Produces: `POST` no longer reads `prize`/`amount`/`wallet` from body. Response:
  `ok({ prize: string, amount: number|null, prizeIndex: number, winCode: string|null, freeSpin?: boolean, autoSent: boolean, txHash?, paymentError?, lobstrDeeplink? })`.
  `GET` unchanged shape. This is the contract Task 5's client work relies on.

- [ ] **Step 1: Rewrite `app/api/game/win/route.ts` POST**

Replace the whole POST (lines 106-197) with:

```ts
export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const user = IS_DEV ? { id: 0 } : validateTelegramInitData(initData, BOT_TOKEN)
  if (!user) return fail('Unauthorized', 'UNAUTHORIZED')

  const limited = checkRateLimit(req, 10, `game:lucky_draw:${user.id}`)
  if (limited) return limited

  const supabase = createServiceClient()
  const { prize, index } = rollPrize('lucky_draw')

  // Non-consuming outcome: Free Spin — nothing recorded, nothing consumed
  if (prize.label === 'Free Spin') {
    return ok({ prize: prize.label, amount: null, prizeIndex: index, winCode: null, freeSpin: true, autoSent: false })
  }

  let walletAddress: string | null = null
  if (!IS_DEV) {
    const status = await getSpinStatus(supabase, user.id, 'lucky_draw')
    if (!status.canSpin) return fail('No spins remaining', 'DAILY_LIMIT', 429)
    const consumed = await consumeSpin(supabase, user.id, 'lucky_draw')
    if (!consumed.ok) return fail('No spins remaining', 'DAILY_LIMIT', 429)
    walletAddress = status.walletAddress
  }

  const winCode = `SPIN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const { data: inserted, error } = await (supabase as any)
    .from('lucky_draw_wins')
    .insert({
      telegram_id: user.id,
      prize: prize.label,
      amount: prize.amount,
      win_code: winCode,
      wallet_address: walletAddress,
      claimed: false,
      prize_source: 'lucky_draw',
      payout_status: 'pending',
    })
    .select('id')
    .single()
  if (error) {
    console.error('lucky_draw_wins insert error:', error.message)
    return fail('Failed to save win', 'DB_ERROR', 500)
  }

  if (prize.label === '+2 Spins' && !IS_DEV) {
    const { data: userRow } = await (supabase as any)
      .from('users').select('bonus_spins').eq('telegram_id', user.id).single()
    await (supabase as any)
      .from('users')
      .update({ bonus_spins: (userRow?.bonus_spins ?? 0) + 2 })
      .eq('telegram_id', user.id)
      .eq('bonus_spins', userRow?.bonus_spins ?? 0)
  }

  const winId: number | undefined = inserted?.id
  const isAssetPrize = !!prizeToAsset(prize.label)
  if (!IS_DEV && isAssetPrize && winId && walletAddress && REWARD_SENDER_SECRET) {
    const payment = await sendPrizePayment(prize.label, prize.amount!, walletAddress, winId, supabase)
    if (payment.sent) {
      void notifyPrizeSent(user.id, prize.label, payment.txHash!)
      return ok({ prize: prize.label, amount: prize.amount, prizeIndex: index, winCode, autoSent: true, txHash: payment.txHash })
    }
    return ok({ prize: prize.label, amount: prize.amount, prizeIndex: index, winCode, autoSent: false, paymentError: payment.code, lobstrDeeplink: payment.lobstrDeeplink })
  }
  return ok({ prize: prize.label, amount: prize.amount, prizeIndex: index, winCode, autoSent: false })
}
```

Add imports (`checkRateLimit` from `@/lib/rate-limit`; gamePool exports). Delete the now-unused local `getSpinStatus` helper (lines 12-85) and have GET call the gamePool version with `'lucky_draw'`. In IS_DEV, GET keeps its stub response.

- [ ] **Step 2: Same rewrite for `slot/route.ts` (`source: 'slot_machine'`, win-code prefix `SLOT-`, keeps its "Free Spin" outcome) and `scratch/route.ts` (`source: 'scratch_card'`, prefix `SCRATCH-`, no Free Spin)**

Slot/scratch already call `checkRateLimit(req, 10, ...)` — keep. For scratch's "+2 Cards" prize and quiz's "+1 Ball": in scratch route, add the same optimistic-increment block as "+2 Spins" but for `bonus_spins` (+2) when `prize.label === '+2 Cards'`; in `app/api/quiz/complete/route.ts`, where the prize is rolled server-side, add an increment of `users.bonus_balls` (+1) when the rolled prize is `'+1 Ball'`. Delete the orphaned `app/api/user/bonus-balls/route.ts` (unauthenticated self-grant, zero callers).

- [ ] **Step 3: `npx tsc --noEmit` — 0 errors**
- [ ] **Step 4: Commit** `git commit -am "fix: server-side prize roll and payout for all games — client can no longer choose prizes"`

---

### Task 5: Client games follow the server result

**Files:**
- Modify: `app/game/page.tsx` (LuckyDraw component, `handleSpin` at ~line 319), `components/SlotMachine.tsx`, `components/ScratchCard.tsx`

**Interfaces:**
- Consumes: Task 4's POST response `{ prize, amount, prizeIndex, winCode, freeSpin?, autoSent, txHash?, paymentError?, lobstrDeeplink? }`.

- [ ] **Step 1: Lucky Draw**

In `handleSpin` (`app/game/page.tsx:319-`): delete the local `pickPrize()` call (line 345) and the pre-check GET (lines 324-343). New flow: POST `/api/game/win` FIRST (empty body `{}`), await response;
- on `success: false` with code `DAILY_LIMIT`/`RATE_LIMITED`: set `canSpin(false)`, show the existing "no spins" UI — do NOT start the wheel;
- on network error: show error toast, do not spin;
- on success: `targetPrizeIdxRef.current = data.prizeIndex`, start the wheel animation exactly as today; when the wheel stops, show result using `data.prize`, `data.winCode`, `data.autoSent`, `data.txHash`, `data.paymentError` (this replaces the old post-animation POST — there is no second request). `data.freeSpin === true`: animate to the Free Spin segment, set `freeSpin` state as today.
Keep `PRIZES` client-side ONLY for wheel rendering (labels/colors/emoji must stay in the same order as the server table — add a comment saying the two must match by index).

- [ ] **Step 2: Slot + Scratch — same inversion**

SlotMachine: POST first, map returned `prize` label to reel target combination (the component already maps prize→reels for display), animate to it, surface `DAILY_LIMIT`/errors instead of silently showing a win. ScratchCard: POST on first scratch interaction before revealing, place returned prize in the grid, reveal honestly; remove its client-side `pickPrize` (~line 344). In both, delete the dead `usingBonus` state and the `spinStatusLoaded = true` constant with its conditionals (`app/game/page.tsx:195-196`).

- [ ] **Step 3: Manual check via dev bypass: each game spins, lands, shows result; exhausted spins show the limit message, no fake win banner**
- [ ] **Step 4: `npx tsc --noEmit`; commit** `git commit -am "fix: games animate to server-rolled prize; surface limit/errors instead of fake wins"`

---

### Task 6: initData hardening

**Files:**
- Modify: `lib/telegram.ts:11-44`
- Create: `__tests__/telegram.test.ts`

- [ ] **Step 1: `auth_date` freshness + constant-time compare**

In `validateTelegramInitData`, replace line 36 (`if (expectedHash !== hash) return null`) with:

```ts
const a = Buffer.from(expectedHash, 'hex')
const b = Buffer.from(hash, 'hex')
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

// Reject stale initData — a captured string must not be a permanent credential
const authDate = Number(params.get('auth_date') ?? 0)
const MAX_AGE_SECONDS = 24 * 60 * 60
if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null
```

- [ ] **Step 2: Test** — build a valid initData string in the test with a known bot token (sign it with the same HMAC scheme), assert: fresh passes, `auth_date` 25h old fails, tampered hash fails. Run `npx vitest run __tests__/telegram.test.ts` — PASS.
- [ ] **Step 3: Also fix `parseTelegramUser` double-decode (`lib/telegram.ts:118`): `JSON.parse(userStr)` — `URLSearchParams.get` already decoded.**
- [ ] **Step 4: Commit** `git commit -am "fix: initData auth_date expiry, constant-time hash compare, double-decode"`

---

### Task 7: Webhook secret + quiz DEV_BYPASS guard

**Files:**
- Modify: `app/api/bot/webhook/route.ts`, `app/api/quiz/session/route.ts`, `app/api/quiz/answer/route.ts`, `app/api/quiz/complete/route.ts`, `app/api/quiz/status/route.ts`

- [ ] **Step 1: Webhook** — first lines of POST:

```ts
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
  return new Response('forbidden', { status: 403 })
}
```

Add `TELEGRAM_WEBHOOK_SECRET` to `.env.local` (generate: `openssl rand -hex 32`) and note in the commit message that the Telegram `setWebhook` call must be re-run with `secret_token` — leave a TODO note in `docs/deployment-checklist.md`.

- [ ] **Step 2: Quiz routes** — change each `const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'` to `const DEV_BYPASS = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'` (matches `app/api/auth/wallet/route.ts:11`).
- [ ] **Step 3: `npx tsc --noEmit`; commit** `git commit -am "fix: webhook secret token check; quiz dev bypass gated on NODE_ENV"`

---

### Task 8: Admin token hardening

**Files:**
- Modify: `app/api/admin/route.ts:5-8`, `app/admin/hooks/useAdminToken.ts`, `app/admin/page.tsx`

- [ ] **Step 1: Harden `verifyAdminToken`** (all 20 admin routes import this one function — single-site fix):

```ts
import crypto from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'

export function verifyAdminToken(req: NextRequest): boolean {
  if (checkRateLimit(req, 30, `admin:${req.headers.get('x-forwarded-for') ?? 'local'}`)) return false
  const token = req.headers.get('x-admin-token') ?? ''   // header only — no query param
  const secret = process.env.ADMIN_SECRET_TOKEN ?? ''
  if (!token || !secret) return false
  const a = crypto.createHash('sha256').update(token).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)  // hash first: equal length, constant-time
}
```

- [ ] **Step 2: Client side** — `useAdminToken.ts`: stop reading `?token=` from the URL; keep localStorage + the login form on `app/admin/page.tsx` as entry. Check `app/api/bot/notify/route.ts:34-37` and align: header `x-admin-token` only, drop legacy `x-admin-key`.
- [ ] **Step 3: Manual check (dev): admin login form works, `?token=` no longer grants access. Commit** `git commit -am "fix: admin token header-only, constant-time, rate-limited"`

---

### Task 9: Donations auth + real verification

**Files:**
- Modify: `app/api/donations/route.ts`

- [ ] **Step 1: POST requires initData** — same pattern as `app/api/auth/wallet/route.ts`: read `x-telegram-init-data`, `validateTelegramInitData`, 401 on failure; resolve the caller's wallet from DB (users→wallets by `telegram_id`) and ignore any `stellarAddress` in the body.
- [ ] **Step 2: Verification checks issuer AND amount** — in the Horizon payment-matching block (~lines 205-213), a payment only verifies the donation if: `asset_code` matches AND `asset_issuer === process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER` (or `asset_type === 'native'` for XLM donations) AND `Number(payment.amount) >= claimed amount`.
- [ ] **Step 3: GET `?address=`** — require initData too; only return history for the caller's own wallet address (from DB), ignore the query param except for admin calls carrying a valid `x-admin-token`.
- [ ] **Step 4: `npx tsc --noEmit`; manual dev check of `/donate`; commit** `git commit -am "fix: donations require auth, verify amount and issuer on-chain"`

---

### Task 10: notifications/read per-user + small route fixes

**Files:**
- Modify: `app/api/notifications/read/route.ts`, `app/api/game/wins/route.ts`, `app/api/user/referrer/route.ts`, `components/NotificationDrawer.tsx`

- [ ] **Step 1: Per-user broadcast reads** — add migration `supabase/migrations/022_notification_reads.sql`:

```sql
alter table users add column if not exists read_broadcast_ids jsonb not null default '[]';
```

`read/route.ts`: for personal notifications keep the current update scoped `.eq('telegram_id', user.id)` but DROP the `.or(...telegram_id.is.null)` global write; for broadcast rows append their ids to the caller's `users.read_broadcast_ids`. `NotificationDrawer.tsx` unread computation: a broadcast is unread if its id is not in the user's `read_broadcast_ids` (return that array from `GET /api/notifications`). Fix the opt-in toggle while in the file: `GET /api/notifications` must return `telegramAlertsOptIn` (read `users.opt_in_telegram_notifications`), which `NotificationDrawer.tsx:49` already expects.
- [ ] **Step 2: `game/wins/route.ts`** — add `checkRateLimit(req, 30)`; stop returning raw `telegram_id`: select the display fields and return `display_name` derived server-side (reuse `lib/display-name.ts`), or at minimum mask the id (`String(id).slice(0,3) + '***'`).
- [ ] **Step 3: `user/referrer/route.ts`** — only allow looking up the id stored as the CALLER's own `referred_by` (fetch caller row first, compare), otherwise 403.
- [ ] **Step 4: Apply migration via supabase CLI/dashboard; `npx tsc --noEmit`; commit** `git commit -am "fix: per-user broadcast reads, wins feed privacy, referrer lookup scoped"`

---

### Task 11: Correctness batch — clubs, referral, buy, tiers, stats honesty

**Files:**
- Modify: `app/clubs/page.tsx:600`, `app/page.tsx:29-31`, `app/api/auth/session/route.ts:64-72`, `app/buy/page.tsx:18,24-25`, `app/stats/page.tsx:318-321`, `app/api/stats/funding/route.ts:159-178`, `components/DashboardView.tsx:27,362-364`

- [ ] **Step 1: Clubs** — add `headers: { 'x-telegram-init-data': getTelegramInitData() }` to the `/api/leaderboard` fetch at `app/clubs/page.tsx:600` (import already exists in the file for other calls).
- [ ] **Step 2: Referral welcome** — `app/page.tsx`: initial phase must not read `sessionStorage['nsafl_referrer']` during `useState` init (TelegramGuard writes it later). Move the check into a `useEffect` that runs after mount: if the key exists, the user is new (no `hasSeenOnboarding`), and phase is `onboarding`/`gate`, switch phase to `referral-welcome`.
- [ ] **Step 3: Session referral rule** — `app/api/auth/session/route.ts:64-72`: replace the 10-second `created_at` window with the wallet route's rule (`app/api/auth/wallet/route.ts:51-71`): write `referred_by` only if currently null, referrer exists, and referrer ≠ self.
- [ ] **Step 4: Buy page** — `parseInt` → `parseFloat` at line 18. Lines 24-25: remove the hardcoded fallback address; if `NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS` is unset, render an error card instead of any address. Replace `Memo.text('NSAFL buy')` at line 138 with `` Memo.text(`${PRIMARY_CUSTOM_ASSET_CODE} buy`) ``.
- [ ] **Step 5: Tier labels from one source** — in `app/stats/page.tsx:318-321` and `app/api/stats/funding/route.ts:171-178`, derive bucket boundaries/labels from `TIERS` in `@/config/tiers` (e.g. three buckets: first non-zero tier min, `TIERS[5].minBalance`, `TIERS[TIERS.length-1].minBalance`) — delete the hardcoded "Tier 9–12" and divergent numbers; rename `DashboardView.tsx:27` field accordingly.
- [ ] **Step 6: Stats honesty** — `DashboardView.tsx:362-364`: delete the three `* 10` multipliers. `app/api/stats/funding/route.ts:159-168`: delete the synthesized weekly series and its "Live" label consumer (remove the chart block in `app/stats/page.tsx` that renders it).
- [ ] **Step 7: `npx tsc --noEmit`; `npx vitest run`; commit** `git commit -am "fix: clubs auth header, referral timing, buy page rate/address, tier labels single-source, honest stats"`

---

### Task 12: RLS check + dashboard query behind API

**Files:**
- Inspect: Supabase project `vrqlxguhfndrqiipisyi` (dashboard or MCP)
- Modify: `components/DashboardView.tsx:163` area
- Possibly create: `app/api/user/wallet-live/route.ts`

- [ ] **Step 1: Check RLS** on `wallets` and `wallet_balances` (Supabase dashboard → table editor → RLS, or `select relrowsecurity from pg_class where relname in ('wallets','wallet_balances')`). Record the answer in the PR/commit message.
- [ ] **Step 2: If RLS is disabled** (expected): move `DashboardView`'s direct browser query + Realtime subscription on those tables behind a new authed route `app/api/user/wallet-live/route.ts` (initData-validated, returns the caller's own wallet + balance rows); replace the Realtime subscription with a 60s poll of that route. Do NOT author RLS policies (keeps anon key useless for those tables).
- [ ] **Step 3: `npx tsc --noEmit`; manual dev check dashboard balance renders; commit** `git commit -am "fix: wallet data fetched via authed API, no anon-key table access from browser"`

---

### Task 13: Dead code sweep + repo junk

**Files:**
- Delete: `app/admin/components/tabs/` (whole dir), `app/admin/components/AdminSidebar.tsx`, `app/admin/components/AdminHeader.tsx`, `app/admin/components/SummaryStrip.tsx`, `components/Header.tsx`, `components/RewardsCard.tsx`, `components/TierHeroCard.tsx`, `components/_dashboard/BalanceCard.tsx`, `components/TierBadge.tsx`, `app/api/buy/direct/route.ts`, `app/api/buy/advanced/route.ts`, `app/api/game/route.ts`, `app/buy/page.tsx:358-458` hidden block (+ its state/handler/`import('stellar-sdk')`), `NoTrustlineHelp.tsx:194-292` hidden Advanced block
- Delete at `<root>/`: `test.py`, `tier.md`, `package-lock.json` (90-byte stub), `.playwright-mcp/`
- Modify: `<root>/.gitignore` — add `MEMORY/`, `.claude/worktrees/`

**KEEP (owner decision): `components/TrustlineModal.tsx` untouched including its hidden Advanced block.**

- [ ] **Step 1: Before each delete, verify zero importers**: `grep -rn "<basename-without-ext>" app components lib config hooks --include='*.ts*' | grep -v "<its own path>"`. If any hit, leave the file and note it.
- [ ] **Step 2: Check `ErrorBoundary`** — audit flagged it referenced as a string in `app/layout.tsx` but not imported. Read `app/layout.tsx`; if genuinely unused, delete `components/ErrorBoundary.tsx`; if used, wire it correctly (proper import) and leave it.
- [ ] **Step 3: `git worktree prune` at `<root>/`. Run `npx tsc --noEmit` + `npm run build` (build catches route-level dead imports). Commit** `git commit -am "chore: remove dead code, abandoned admin tab refactor, repo junk"`

---

### Task 14: `config/branding.ts` + literal sweep

**Files:**
- Create: `config/branding.ts`
- Modify: `components/OnboardingSlides.tsx:12,18`, `lib/telegram.ts:75-76` (REFERRAL_SHARE_TEXT), `app/admin/broadcast/page.tsx:9-21`, `app/admin/wins/page.tsx:1009`, `app/admin/usersearch/page.tsx:91`, `app/api/quiz/complete/route.ts:16-18`, `lib/stellar-payment.ts:21,29`, `app/globals.css` (`@theme`)

**Interfaces:**
- Produces: `BRANDING` object — the ONLY per-clone edit point besides `.env` and `config/afl.ts`/`config/tiers.ts`.

- [ ] **Step 1: Create the config**

```ts
// config/branding.ts — per-clone file. A new project edits THIS file, .env,
// config/tiers.ts, config/afl.ts, and public/ assets. Nothing else.
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

export const BRANDING = {
  appName: 'NSAFL Homecoming Hub',
  shortName: 'NSAFL Hub',
  domain: 'app.nsafl.com',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot',
  colors: { background: '#0A0E1A', primary: '#D4AF37' },
  teamSelection: 'afl' as 'afl' | 'custom' | 'off',
  copy: {
    onboardingSlides: [ /* move the 3 slide title/body strings from OnboardingSlides.tsx here,
                           with ${PRIMARY_CUSTOM_ASSET_LABEL} interpolated where "$NSAFL" was */ ],
    referralShareText: /* move REFERRAL_SHARE_TEXT from lib/telegram.ts here */ '',
    broadcastTemplates: [ /* move the template strings from app/admin/broadcast/page.tsx here,
                             asset name via PRIMARY_CUSTOM_ASSET_LABEL */ ],
    buyMemo: `${PRIMARY_CUSTOM_ASSET_CODE} buy`,
    rewardMemo: `${PRIMARY_CUSTOM_ASSET_CODE} Prize`,
    prizeNotificationTitle: `Your ${PRIMARY_CUSTOM_ASSET_CODE} prize has been sent!`,
  },
} as const
```

The `/* move ... */` comments are transcription instructions — final file contains the real strings, no such comments.

- [ ] **Step 2: Point every listed call site at `BRANDING`** — `lib/telegram.ts` imports `BRANDING.copy.referralShareText`; quiz prize labels become `` `100 ${PRIMARY_CUSTOM_ASSET_CODE}` `` etc.; admin pages' "NSAFL"/"$NSAFL" literals → `PRIMARY_CUSTOM_ASSET_LABEL`; `stellar-payment.ts` `REWARD_MEMO` default → `BRANDING.copy.rewardMemo`, notification heading → `BRANDING.copy.prizeNotificationTitle`.
- [ ] **Step 3: Colors** — in `app/globals.css` `@theme`, ensure background/gold are defined once as CSS variables; grep `#0A0E1A` and `#D4AF37` across `app components` — leave Tailwind arbitrary values as-is where they reference the same two colors (they ARE the brand tokens; a clone re-greps and replaces two hex strings — document this in Step 4's README section). Full CSS-variable migration of every arbitrary class is out of scope (hundreds of sites, zero logic value).
- [ ] **Step 4: Add a "Cloning this base" section to `<root>/CLAUDE.md`**: list the per-clone edit points (branding.ts, .env, tiers.ts, afl.ts, public/ logos, the two hex codes, Supabase project + migrations, BotFather setup).
- [ ] **Step 5: Verify: `grep -rn 'NSAFL' app components lib --include='*.ts*' | grep -v PRIMARY_CUSTOM_ASSET | grep -v branding` returns only env fallbacks (`?? 'NSAFL'`) and `config/` files. `npx tsc --noEmit`. Commit** `git commit -am "feat: branding config layer — single per-clone edit point"`

---

### Task 15: Team-select flag

**Files:**
- Modify: `app/page.tsx` (phase machine), `config/branding.ts`

- [ ] **Step 1:** In the phase transitions of `app/page.tsx`: wherever the machine routes to `'team-select'` (post-celebration and the `isConnected && !favoriteTeam` open), first check `BRANDING.teamSelection === 'off'` → go straight to `'dashboard'`. `'afl'` and `'custom'` both render `TeamSelectScreen` (custom = clone swapped `config/afl.ts` contents; no code difference).
- [ ] **Step 2: Manual dev check: flag `'off'` skips team selection; default `'afl'` unchanged. `npx tsc --noEmit`. Commit** `git commit -am "feat: teamSelection branding flag (afl/custom/off)"`

---

### Task 16: Types regen, docs truth, final commit sweep

**Files:**
- Modify: `lib/database.types.ts` (regenerate), `<root>/CLAUDE.md`
- Create: `supabase/migrations/` — schema dump for missing 001-010, 012

- [ ] **Step 1: Regenerate types**: `npx supabase gen types typescript --project-id vrqlxguhfndrqiipisyi > lib/database.types.ts` (needs `supabase login` — if not authed, ask owner to run it). Then remove now-unneeded `(supabase as any)` casts: `grep -rln 'supabase as any' app lib` and fix each file; `npx tsc --noEmit` must stay at 0.
- [ ] **Step 2: Recover missing migrations**: `npx supabase db dump --project-id vrqlxguhfndrqiipisyi --schema public -f supabase/migrations/000_baseline_schema.sql` — a baseline dump replaces the lost 001-010/012 (do not fabricate individual files).
- [ ] **Step 3: Update `<root>/CLAUDE.md`**: 11 tiers (not 5), 8 phases (not 6), correct reference path `html examples/`, document admin panel + quiz + notifications + games hub reality, migration status "baseline dump + 011,013-022", remove claims contradicted by this plan (client-side prize picking, etc.).
- [ ] **Step 4: Commit remaining untracked/modified work in logical chunks** (admin panel, games, trustlines, config, docs — separate commits, plain messages, owner's git user, no attribution). `git status` must end clean except `MEMORY/`/`.claude/worktrees/` (now ignored).
- [ ] **Step 5: Final verification: `npx tsc --noEmit` 0 errors, `npm run lint`, `npx vitest run` all pass, `npm run build` succeeds. Manual dev-bypass run: connect → team → each game → admin login.**

---

## Self-review notes

- Spec section A → Tasks 1-8; B → Tasks 13-15 + 16; C → Tasks 9-12, 11. Out-of-scope secret-key flow explicitly fenced in Global Constraints.
- Transcription markers (`// ...` / `/* move ... */`) are deliberate: literal data exists in named files; copying it into this doc would drift.
- Type/name consistency: `GameSource`, `GamePrize`, `rollPrize`, `getSpinStatus(supabase, telegramId, source)`, `consumeSpin`, `BRANDING` used identically across Tasks 1-5, 14-15.
