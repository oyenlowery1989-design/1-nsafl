# Cloning This Base — Runbook

Ordered steps to fork this app for a new token/brand. Background and file-by-file rationale live in `CLAUDE.md` under "🧬 Cloning This Base" — this doc is the copy-paste execution order.

Core logic (auth, Stellar balance/trustline, games engine, rewards payouts, admin panel, referrals, donations, quiz, notifications) is brand-agnostic — none of the steps below touch `app/api/**`, `lib/**` (except config-style files noted), or `hooks/**`.

---

## 1. Supabase project

```bash
# New project in Supabase dashboard, then:
cd telegram-app
supabase link --project-ref <new-project-id>
supabase db push   # applies 000_baseline_schema.sql, then 011, 013–029 in order
npx supabase gen types typescript --project-id <new-project-id> > lib/database.types.ts
```

Grab `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the new project's API settings.

## 2. Stellar asset

Have the new token's Stellar issuer address ready (or issue one). Decide the wrapped-reward-asset issuer (`NEXT_PUBLIC_REWARD_ASSET_ISSUER`) — can be the same account as the primary issuer, or a separate hot wallet that signs game/reward payouts.

## 3. `.env.local`

```bash
cp telegram-app/.env.example telegram-app/.env.local
```

Fill every value — see comments in `.env.example`. Set `NEXT_PUBLIC_DEV_BYPASS=true` for local dev only.

## 4. `config/branding.ts`

Edit `BRANDING`: `appName`, `shortName`, `domain`, `botUsername` (or leave reading from env), `colors`, `teamSelection` (`'afl' | 'custom' | 'off'`), all `copy.*` strings (onboarding slides, referral share text, broadcast templates, memos, notification titles).

## 5. `config/tiers.ts`

Set real `minBalance`/`maxBalance` thresholds and reward percentages per tier.

## 6. Team selection (skip if `teamSelection: 'off'`)

- `config/afl.ts` — replace `AFL_CLUBS`/`WAFL_CLUBS` with the new domain's team list (or delete if not sports-themed)
- `config/afl-players.ts` — replace or empty
- `config/partnerClub.ts` — edit or empty; also swap/remove its `public/` image
- `next.config.ts` `remotePatterns` — add the new logo/image CDN hostnames, remove TheSportsDB/Wikimedia if unused

## 7. Reward assets + prize tables

Edit in this order, keeping the four prize arrays index-aligned (label + order must match exactly — `__tests__/gamePrizeAlignment.test.ts` fails the build if they drift):

1. `lib/rewardAssets.ts` — `REWARD_ASSETS` list + Lobstr deeplinks
2. `lib/gamePool.ts` — `PRIZE_TABLES` (server-authoritative; this is what actually gets rolled/paid)
3. `components/SlotMachine.tsx` — `SLOT_PRIZES`
4. `components/ScratchCard.tsx` — `SCRATCH_PRIZES`
5. `app/game/page.tsx` — `PRIZES` (Lucky Draw wheel)
6. `components/TrustlineModal.tsx` — `THEME` map keys (currently keyed by literal asset codes like `wNSAFL`)

Run `npm test` after — the alignment test is the fast feedback loop, don't skip it.

## 8. Colors

Three files only:
- `app/globals.css` `@theme` block (2 CSS vars)
- `config/branding.ts` `colors`
- `config/tiers.ts` (2 tier `color` entries)

No project-wide grep needed — components use theme classes (`bg-background-dark`, `text-primary`), not inline hex.

## 9. Fonts

`app/layout.tsx` `<head>` — swap the `<link>` tags for the new heading/body fonts. Material Symbols Outlined stays (icon system, not brand-specific).

## 10. `public/` assets

Replace logos, `favicon.ico`, `apple-touch-icon.png`, and any partner-club image.

## 11. Page copy

Not centralized by design — brand sentences live inline in page JSX (dashboard, stats, rewards, donate, leaderboard, clubs, onboarding). These are also your per-clone *redesign* surface, so editing text and layout together in the same pass is the point — see CLAUDE.md's note on this. Grep for `AFL`/`WAFL`/`Homecoming` to find sport-specific copy if disabling team selection.

**LOCKED pages** (per CLAUDE.md: profile, rewards, stats) still need their copy edited for a new brand — "locked" means don't restructure the layout/logic without asking, not don't rebrand the text.

## 12. Telegram bot

```
BotFather → /newbot (or reuse existing) → /newapp → set Web App URL to the new domain
```

Set `TELEGRAM_BOT_TOKEN` to match. After deploy, register the webhook:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/bot/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## 13. Deploy

- Vercel project → set all env vars from `.env.local` (Production environment) — remember `NEXT_PUBLIC_*` vars are baked at build time, redeploy after changing any
- **Do not** set `NEXT_PUBLIC_DEV_BYPASS` in production
- `vercel --prod` or `/vercel:deploy` skill

## 14. Smoke test

- `npx tsc --noEmit` / `npm run lint` / `npm test` — all clean before deploy
- Open the bot in real Telegram: wallet connect → trustline check → team select (if on) → each of the 3 games → rewards claim → admin panel (`/admin`, token auth)
- Direct browser access to the domain shows the Telegram-only block screen

---

## Known gap — fix before real users

`components/TrustlineModal.tsx`'s "Sign All Trustlines" advanced flow posts the raw Stellar **secret key** to the server for verification (`/api/auth/verify-wallet-key`), not just the derived public key. Currently gated behind `NEXT_PUBLIC_TRUSTLINE_BYPASS` / admin-only visibility for testing. Do not let this reach production users unmodified — verify the keypair client-side only and send just the derived public key.
