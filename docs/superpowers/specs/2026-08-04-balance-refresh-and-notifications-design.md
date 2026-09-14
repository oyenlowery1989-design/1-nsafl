# Balance refresh + bot notifications — design

2026-08-04. Two independent additions to the NSAFL Telegram Mini App: (1) faster balance reflection after a payout, (2) automated Telegram bot DMs for tier-ups, spin reminders, and claim-window openings.

## Background

`wallet_balances` (the table `/api/user/wallet-live` reads for the dashboard) is only written by `syncBalance()` inside `app/api/stellar/balance/route.ts`, fired by the dashboard's own 60s poll fetching Horizon fresh. Game wins (`app/game/page.tsx`) and reward claims (`/api/rewards/claim`) send the on-chain Stellar payment immediately but never touch `wallet_balances` — so a win/claim doesn't visibly update the balance until the next poll tick (up to 60s later).

A prior attempt at Supabase Realtime on `wallets`/`wallet_balances` was removed during a security hardening pass (no RLS policies exist on those tables; an anon-key Realtime subscription would leak every user's balance). That history rules out reintroducing client-side Realtime on those tables without adding RLS first — out of scope here.

Notification infra already partially exists: `users.opt_in_telegram_notifications` (bool), a working preference toggle (`/api/notifications/preferences`), and an admin-only manual sender (`/api/bot/notify`, used by `/admin/broadcast`). What's missing is automation — nothing currently triggers a DM on its own.

## 1. Instant balance refresh after win/claim

**Problem**: user wins a game or claims a tier reward, sees no balance change until the next 60s poll.

**Fix**: after the win/claim response resolves, fire one immediate `GET /api/stellar/balance?address=...` call (the same endpoint the periodic poll already uses) instead of waiting for the next poll tick.

**Touches**:
- `app/game/page.tsx` — all three completion callbacks passed down as props: `handleSpinComplete` (Lucky Draw), `handleSlotSpinComplete` (Slot), `handleScratchComplete` (Scratch Card, confirmed same `onFresh` callback shape). After a win is confirmed (`isAsset` payout, not "Free Spin"/"+2 Spins"/"+2 Cards"), trigger the same balance fetch pattern `DashboardView.tsx` uses.
- Rewards claim UI (wherever `/api/rewards/claim` success is handled) — same immediate fetch after a successful claim.

No new endpoints, no schema changes. Purely "call the existing fetch sooner."

**Edge case**: game pages don't always have the dashboard mounted (user is on `/game`, not `/`) — the balance in Zustand (`tokenBalance`) still updates via `setBalances`, so when the user navigates back to the dashboard it's already current. If the dashboard IS mounted (e.g. a future embedded view), it reads the same Zustand store, so this doesn't require prop drilling or a new store field.

## 2. Tier-up congrats (event-driven, no cron)

**Trigger point**: `syncBalance()` in `app/api/stellar/balance/route.ts` — already runs on every balance poll, already has old + new numeric balance in hand.

**New column**: `users.last_notified_tier` (`text`, nullable) — migration `030_last_notified_tier.sql`. Nullable default lets existing users get compared against `null` on first sync post-deploy (won't fire a spurious congrats — see below).

**Logic** (pure function, unit-testable in isolation):
```ts
function shouldNotifyTierUp(previousTierId: string | null, newTierId: string): boolean {
  if (previousTierId === null) return false // first-ever sync, don't congratulate on baseline
  const prevIdx = TIERS.findIndex(t => t.id === previousTierId)
  const newIdx = TIERS.findIndex(t => t.id === newTierId)
  if (prevIdx === -1) return false // unknown stored tier id, don't guess
  return newIdx > prevIdx
}
```

**Flow in `syncBalance()`**:
1. Compute `newTier = getTierForBalance(tokenBal)` (existing helper from `config/tiers.ts`).
2. Read `users.last_notified_tier` for this wallet's owner.
3. If `shouldNotifyTierUp(lastNotifiedTier, newTier.id)` and the user has `opt_in_telegram_notifications === true`, send a DM (pattern mirrors `notifyPrizeSent` in `lib/stellar-payment.ts` — `sendTelegramMessage`-style fetch to the Bot API, fire-and-forget, swallow errors so a failed DM never blocks the balance sync response).
4. Always update `users.last_notified_tier = newTier.id` after the check (whether or not a DM was sent) — keeps the stored value current even for opted-out users, so re-opting-in later doesn't trigger a flood of back-dated congrats.

**Message copy**: goes in `BRANDING.copy` (new key, e.g. `tierUpNotification: (tierLabel: string) => string` or a template string) — per CLAUDE.md's brand-copy centralization rule, not hardcoded in the route.

## 3. Daily reminder + claim-window notice (one combined Vercel Cron)

**Constraint**: Vercel Hobby plan — cron jobs run at most once per day, max 2 jobs per project. Design must fit inside a single daily job to leave headroom.

**New route**: `app/api/cron/daily-notify/route.ts`, `GET` handler. Protected by comparing an `Authorization: Bearer <CRON_SECRET>` header against a new `CRON_SECRET` env var — Vercel's standard cron-auth pattern (Vercel automatically sends this header for its own scheduled invocations). Distinct trust boundary from `ADMIN_SECRET_TOKEN` (this is Vercel's scheduler calling itself, not a human admin action).

**`vercel.json`** (new file):
```json
{
  "crons": [
    { "path": "/api/cron/daily-notify", "schedule": "0 12 * * *" }
  ]
}
```
(12:00 UTC — arbitrary reasonable default, adjustable later; one job, well under the 2-job Hobby cap.)

**Inside the handler, two independent checks, both gated on `opt_in_telegram_notifications = true`:**

**a. Spin reminder** — query users where:
- tier ≥ tier-1 (pre-tier users get a one-time welcome bonus, not a daily allotment — a daily nudge for them would be misleading)
- today's `lucky_draw_wins` count (any `prize_source`) for that user is 0 (haven't played anything today — reuses the UTC-midnight boundary pattern from `getSpinStatus` in `lib/gamePool.ts`)

Send one combined reminder DM (not per-game) — "You've got spins waiting" style copy from `BRANDING.copy`.

**b. Claim-window-open** — only actually sends anything if `today` is the 1st of the UTC month (`new Date().getUTCDate() === 1`); otherwise this check is a no-op for 29 days out of 30. When it is the 1st: query users tier ≥ tier-1 who have no `tier_reward_claims` row for the current `claim_month` yet, send a DM pointing them to `/rewards`.

**Batching**: both queries can return the full opted-in user list in one shot (this app's scale doesn't need pagination); `Promise.all` the sends same as the existing broadcast route does in `app/api/bot/notify/route.ts`.

## Testing

- `shouldNotifyTierUp` — pure function, direct unit tests (null previous tier, same tier, tier drop, tier climb by 1, tier climb by several, unknown stored id).
- Daily-notify eligibility queries — fake-Supabase-builder unit tests following the existing pattern in `__tests__/gamePool.spinStatus.test.ts` (in-memory table stand-ins, no live network/DB). Cover: opted-out users excluded, tier-0 excluded from spin reminder, already-played-today excluded, non-1st-of-month short-circuits claim-window entirely, already-claimed-this-month excluded.
- No test attempts to hit the real Telegram Bot API or Horizon — matches existing project convention (those are mocked/stubbed or the test isolates the pure logic around them).

## Out of scope (explicitly deferred)

- Client-side Supabase Realtime / server-authed Realtime relay for cross-device balance sync — deferred; current fix only addresses same-session staleness.
- RLS policies on `wallets`/`wallet_balances` — prerequisite for ever safely doing direct client Realtime on those tables; not needed for anything in this spec.
- Per-notification-type opt-out granularity (e.g. "tier-ups yes, spin reminders no") — single `opt_in_telegram_notifications` boolean stays the only toggle, matching existing UI.
