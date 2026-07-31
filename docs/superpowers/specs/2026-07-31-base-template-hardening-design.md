# NSAFL Base Template — Hardening + Extraction Design

Date: 2026-07-31
Status: approved by owner

## Goal

Fix and clean the NSAFL Telegram Mini App so it doubles as a reusable base template:
new similar projects = clone repo, edit branding config (names, text, colors, logos,
teams), keep all logic (wallet, trustlines, games, quiz, tiers, referrals, admin,
donations, leaderboard, profile) unchanged.

## Explicitly out of scope (owner decision)

- **Secret-key flow left as-is for local testing**: `components/TrustlineModal.tsx`
  posting the user's Stellar secret to `/api/auth/verify-wallet-key` and
  `/api/trustlines/record` (stored in `trustline_submissions.xdr`) is NOT changed.
  ⚠️ Must be fixed before real users touch that screen in production — secrets are
  in prod DB + Vercel logs if anyone used "Sign All Trustlines" live.

## Section A — Security + game engine

### A1. Server-side prize engine (`lib/gamePool.ts`, new)
- Per-game prize tables (label, amount, weight) for Lucky Draw, Slot, Scratch;
  server RNG picks the prize. Quiz already does this correctly
  (`app/api/quiz/complete/route.ts`) — same pattern.
- Client sends a spin request; server returns the chosen prize; wheel/reels/scratch
  UI animates to land on the server result.
- Payout destination wallet comes from the user's DB record, never the request body.
- Shared status/consume logic (currently ~250 lines triplicated across
  `api/game/win|slot|scratch`); routes become thin wrappers.
- Welcome-spin seeding: single atomic increment, no blind overwrite; fixes the
  3-parallel-GET race and the farmable "one-time" bonus.
- Payout idempotency: mark win `paying` before Horizon submit, re-check before send
  (fixes double-pay window in `lib/stellar-payment.ts` call sites).
- Fix silent lost wins: server error/429 on the consume path must surface in the UI,
  not render a win banner for an unrecorded prize.
- Dead prizes ("+2 Cards", quiz "+1 Ball"): implement server branches
  (increment `bonus_spins` / `bonus_balls`) or remove from wheels — implement,
  they're one-line increments.

### A2. Auth hardening
- `lib/telegram.ts` `validateTelegramInitData`: reject `auth_date` older than 24h;
  use `crypto.timingSafeEqual` for hash compare.
- `app/api/bot/webhook`: require `X-Telegram-Bot-Api-Secret-Token` header match.
- Quiz routes (`session|answer|complete|status`): add
  `process.env.NODE_ENV !== 'production' &&` to DEV_BYPASS.

### A3. Admin token
- Header-only (`x-admin-token`), drop `?token=` query param acceptance.
- Constant-time compare; per-IP rate limit on all `/api/admin/*` routes.

### A4. Donations
- `POST /api/donations` requires Telegram initData.
- On-chain verification checks amount AND asset issuer, not just asset code.

## Section B — Base/template extraction

### B1. `config/branding.ts` (new)
Single per-clone file: app name, tagline, bot username, domain, onboarding copy,
referral share text, broadcast templates, buy memo, logo paths, brand colors
(navy `#0A0E1A`, gold `#D4AF37` → CSS variables in `globals.css` `@theme` fed from
branding). Remaining hardcoded `NSAFL` literals (quiz prize labels, buy memo,
onboarding slides, admin broadcast templates) routed through
`PRIMARY_CUSTOM_ASSET_CODE`/branding.

### B2. Team-select module flag
`branding.teamSelection: 'afl' | 'custom' | 'off'` — one branch in the `app/page.tsx`
phase machine. `config/afl.ts` stays as the NSAFL club list; clones swap or disable.
No other speculative flexibility (YAGNI).

### B3. Cleanup
- Dead-code sweep: `app/admin/components/tabs/*` (~774 lines), unused components
  (`TierHeroCard`, `RewardsCard`, `Header`, `BalanceCard`+`TierBadge`), unused routes
  (`api/user/bonus-balls`, `api/buy/direct`, `api/buy/advanced`, `api/game/route.ts`),
  hidden Advanced block on Buy page, dead `usingBonus` state in games.
  TrustlineModal's hidden Advanced block KEPT (owner testing it).
- Regenerate Supabase types (`lib/database.types.ts`) — removes ~101 `as any` casts.
- Root junk: delete `tier.md`, `test.py`, root `package-lock.json`, `.playwright-mcp/`;
  gitignore `MEMORY/`, `.claude/worktrees/`.
- Commit all uncommitted work + check in missing migrations if recoverable from the
  live DB (dump schema); update CLAUDE.md to reality (11 tiers, 8 phases, admin
  panel, quiz, notifications, correct reference paths).

## Section C — Correctness + honesty

- `POST /api/notifications/read`: per-user broadcast read state (jsonb read-ids on
  `users`), stop global `.or(telegram_id.is.null)` update.
- Clubs page: send `x-telegram-init-data` on the leaderboard fetch (dead panel fix).
- Referral: read `sessionStorage['nsafl_referrer']` in an effect after TelegramGuard
  writes it; `api/auth/session` adopts the wallet route's referral rule
  (null-check + referrer-exists, not the 10-second window).
- Buy page: `parseFloat` for `XLM_TO_TOKEN_RATE`; remove stale fallback address —
  missing env shows an error instead of a wrong wallet.
- Tier labels: stats page + funding API buckets derived from `config/tiers.ts`;
  delete hardcoded "Tier 9–12" and divergent boundary sets.
- Stats honesty: remove `* 10` multipliers in `DashboardView`; drop the synthetic
  weekly chart.
- RLS: verify on `wallets`/`wallet_balances` (project `vrqlxguhfndrqiipisyi`).
  If absent, move `DashboardView`'s browser-side query behind an API route rather
  than authoring RLS policies.

## Verification

- `npx tsc --noEmit` = 0 errors; `npm run lint`; existing vitest passes.
- New tests: gamePool (weights, label→amount, welcome-spin idempotency),
  initData `auth_date` rejection.
- Manual dev-bypass run: connect → team → each game → admin.

## Execution order

A (security + game engine) → C (bugs) → B (cleanup + branding + commits).
Commits in logical chunks, as owner's git user only, no Claude attribution.
