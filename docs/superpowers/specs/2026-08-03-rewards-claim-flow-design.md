# Rewards Claim Flow — Design Spec
_Date: 2026-08-03_

## Overview

The Rewards page (`/rewards`) currently displays each tier's perks (XLM refund %, trustline multiplier, gold/silver/copper amounts, tier-10 physical gold) but has no backend behind any of it — it's a static preview. This adds an actual claim mechanism for the on-chain-sendable perks (gold/silver/copper) and a lightweight notify-only path for tier 10's physical gold. `xlmRefundPct` and `trustlineMultiplier` stay display-only — they are not part of this feature (refund % is a referral-deposit bonus tracked elsewhere; multiplier has no defined effect anywhere in the code).

**Cadence:** one claim per user per UTC calendar month, regardless of tier changes mid-month. Amount sent is whatever the user's *current* tier grants at claim time.

---

## New Reward Assets

`lib/rewardAssets.ts` gains three entries, following the exact pattern of the existing `wXLM`/`wUSDC`/etc:

```ts
{ code: 'wGOLD',   issuer: ISSUER, label: 'Wrapped Gold',   lobstrDeeplink: `https://lobstr.co/assets/wGOLD:${ISSUER}`   },
{ code: 'wSILVER', issuer: ISSUER, label: 'Wrapped Silver', lobstrDeeplink: `https://lobstr.co/assets/wSILVER:${ISSUER}` },
{ code: 'wCOPPER', issuer: ISSUER, label: 'Wrapped Copper', lobstrDeeplink: `https://lobstr.co/assets/wCOPPER:${ISSUER}` },
```

Same issuer (`NEXT_PUBLIC_REWARD_ASSET_ISSUER`) as the game prize assets — no new issuer account needed. Because they're added to `REWARD_ASSETS`, they automatically appear in the existing `TrustlineModal` "Sign All Trustlines" flow and the `/trustlines` status page — no new trustline UI needed.

**Trustline precondition:** the claim payment is one atomic Stellar transaction with up to 3 payment operations (gold/silver/copper). Stellar transactions are all-or-nothing — if the user is missing a trustline for any of the three, the whole transaction fails. The claim button surfaces this as the existing `NO_TRUST` error path (Lobstr deeplink), same as game prizes. Partial claims are not possible and not attempted.

---

## Data Model

New migration `028_tier_reward_claims.sql`:

```sql
create table public.tier_reward_claims (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.users(telegram_id),
  tier_id text not null,
  claim_month date not null,        -- first day of the UTC month this claim covers
  gold_amount numeric(20,7) not null default 0,
  silver_amount numeric(20,7) not null default 0,
  copper_amount numeric(20,7) not null default 0,
  payout_status text not null default 'pending', -- pending | paying | paid
  payout_tx_hash text,
  payout_notes text,
  physical_gold_notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (telegram_id, claim_month)
);
```

`claim_month` is always pinned to the UTC month start (`date_trunc('month', now() at time zone 'utc')`), matching the existing UTC-pinning convention (CLAUDE.md: "pin to UTC" — see `consume_daily_spin`). The unique constraint on `(telegram_id, claim_month)` is what enforces "one claim per user per month" — no separate cooldown check logic needed, the insert itself fails if already claimed and the API surfaces that as "already claimed this month."

No RLS policy needed beyond what's already standard for this project (service-role only, all access via authed API routes — matches `wallets`/`wallet_balances` pattern already hardened).

---

## API

### `POST /api/rewards/claim`

1. Auth via `x-telegram-init-data` (standard pattern).
2. Resolve caller's wallet + live token balance server-side (never trust a client-sent tier) — same resolution path `wallet-live` already uses.
3. `getTierForBalance(balance)` → if `rewards === null` (pre-tier), reject.
4. Insert a `pending` row for `(telegram_id, tier_id, claim_month=<UTC month start>, gold_amount, silver_amount, copper_amount)`. If the insert fails on the unique constraint, return "already claimed this month" (not an error toast — a normal claimed state).
5. Call `sendTierClaimPayment(row, destination, supabase)` (new function, `lib/stellar-payment.ts`).
6. If tier's `rewards.physicalGold` is true, fire-and-forget a Telegram message to the admin username(s) (`NEXT_PUBLIC_ADMIN_TELEGRAM_USERNAMES`), reusing the bot-send pattern from `notifyPrizeSent`. Mark `physical_gold_notified = true`. This never blocks or fails the main claim.
7. Return `{ claimed: true, txHash }` or a structured error (`NO_TRUST` + `lobstrDeeplink`, `UNDERFUNDED`, etc. — same shape `PaymentResult` already returns).

Rate limit: per-user key (`claim:{telegramId}`), low limit (e.g. 5/min) — this is a low-frequency action, generous limit is just abuse-guard, not a real constraint.

### `sendTierClaimPayment()` — `lib/stellar-payment.ts`

Sibling to `sendPrizePayment`, not a generalization of it — same idempotency-via-row-claim pattern (`pending` → `paying` → `paid`/rollback-to-`pending`), same `parseHorizonError` reuse, but:
- Operates on `tier_reward_claims` instead of `lucky_draw_wins`.
- Builds **one transaction** with up to 3 `Operation.payment()` calls (skip any asset whose amount is 0 — e.g. lower tiers might have 0 for a metal, though current tier config doesn't, defensive anyway).
- Everything else (memo, fee, timeout, signing, error rollback) mirrors `sendPrizePayment` exactly.

### Admin retry

`app/api/admin/send-reward/route.ts` already handles retrying a stuck game payout by winId/table. Extend it to accept a `source: 'tier_claim'` variant (or add a small sibling route) that calls `sendTierClaimPayment` against a `tier_reward_claims.id` instead — same auth (`verifyAdminToken`), same shape.

---

## UI

### Rewards page (`app/rewards/page.tsx`)

The current-tier `TierCard` (the one with `status === 'current'` and `rewards !== null`) gets a new claim button, shown independent of tier progress: below the existing "Buy — Level Up" CTA when there's a next tier, or below the "👑 Maximum tier reached" text for tier 10.

- **Not yet claimed this month:** "Claim This Month's Rewards" button (gold, same visual language as the existing Buy CTA) → calls `POST /api/rewards/claim` → on success shows a brief confirmation (tx hash link, same pattern as game win notifications) and flips to claimed state.
- **Already claimed this month:** disabled/muted state — "Claimed for {Month} ✓", with tx hash link if available.
- **NO_TRUST error:** same inline Lobstr-deeplink prompt pattern used for game prize claims.
- Pre-tier (no rewards): no button, unchanged from today.

No new page, no new route — this lives entirely inside the existing (LOCKED per CLAUDE.md) `TierCard` component. Touching the locked Rewards page is *the point* of this feature, so that's expected — flagging it so the change is deliberate, not an oversight of the lock.

### Admin (`app/admin/`)

New minimal page, `app/admin/rewards-claims/page.tsx` (or a tab within an existing page — implementer's call at plan time), read-only list: telegram user, tier, month, amounts, payout status, tx hash, retry button on failed/pending rows. Mirrors `app/admin/wins/page.tsx` structurally. No fulfillment queue for physical gold — that's Telegram-DM-only per the notify-only decision.

---

## Error Handling

All failure modes reuse existing, already-hardened patterns:
- Missing trustline → `NO_TRUST` + Lobstr deeplink (existing UI component from games).
- Sender wallet underfunded → `UNDERFUNDED`, surfaced as a generic "try again later" (user-facing; this is an operator funding problem, not a user problem).
- Double-claim race (two requests same month) → unique constraint on `tier_reward_claims` rejects the second insert; returns "already claimed," not a 500.
- Payment submits but DB update fails after → same pattern as `sendPrizePayment`: logged server-side, row stays `paying`, admin can reconcile manually (this exact edge case already exists for game payouts and is accepted as-is there).

---

## Testing

- Unit: a `sendTierClaimPayment` test mirroring the existing `gamePool.spinStatus.test.ts` fake-Supabase style — verifies idempotency (double-call doesn't double-send), verifies multi-op transaction only includes non-zero assets, verifies rollback-to-pending on simulated Horizon failure.
- Unit: claim-month UTC pinning — a date near a month boundary in a non-UTC test-runner timezone still resolves to the correct UTC month start.
- Manual: `npx tsc --noEmit` clean, `npm run lint`, and a Playwright walkthrough with `DEV_BYPASS` (same limitation as always — no real funded/trustlined wallet in this environment, so the actual Horizon submission can't be exercised end-to-end here; that step needs manual verification with a funded wallet before shipping).

---

## Out of Scope

- `xlmRefundPct` claim/trigger logic (separate feature, tied to referral deposits).
- `trustlineMultiplier` — no defined effect exists anywhere; not addressed here.
- Physical gold shipping address collection/fulfillment queue — notify-only per explicit decision.
- Retroactive claims for months before this feature ships.
