# CLAUDE.md — NSAFL Homecoming Hub (Telegram Mini App)

## 🎯 Project Overview

**"The Homecoming Hub"** is a Telegram Mini App for the NSAFL ($NSAFL Stellar token) ecosystem.
Users connect their Stellar blockchain wallet, view their $NSAFL token balance,
track AFL player homecoming campaigns, and participate in the community movement.

**This app ONLY works inside Telegram.** Any direct browser access shows a block screen.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"` syntax — NOT `@tailwind base/components/utilities`) |
| State | Zustand with `persist` middleware |
| Backend | Supabase (Postgres + Realtime) |
| Blockchain | Stellar Horizon REST API |
| Auth | Telegram initData (HMAC-SHA256 validation) |
| Icons | Material Symbols Outlined (Google) |
| Deployment | Vercel |

---

## 📁 Project Structure

```
html1 - nasfl-app/
├── CLAUDE.md                          ← YOU ARE HERE (root)
├── docs/plans/
│   └── 2026-03-09-nsafl-homecoming-hub.md
├── Dashboard connect wallet.html      ← HTML reference designs
├── Connected.html
├── Dashboard.html
├── Stats.html
├── Rewards.html
├── Profile.html
└── telegram-app/                      ← Next.js app root
    ├── app/
    │   ├── layout.tsx                 ← Root layout (TelegramGuard, Google Fonts via <link>, Telegram SDK)
    │   ├── page.tsx                   ← Phase state machine (onboarding→gate→connecting→celebration→team-select→dashboard)
    │   ├── globals.css                ← Tailwind v4 @import, @theme tokens, .glass-card, animations
    │   ├── stats/page.tsx             ← Stats + Top Supporters (with donation causes) + Team Allegiance
    │   ├── profile/page.tsx           ← Profile + team badge + transactions (live from Horizon)
    │   ├── clubs/page.tsx             ← AFL/WAFL tabs, fan hub, fixtures
    │   ├── rewards/page.tsx           ← Tier display + donation form (auto-memo) + Buy CTA
    │   ├── buy/page.tsx               ← Buy NSAFL page
    │   ├── leaderboard/page.tsx       ← Top NSAFL holders ranked by balance (podium + rank hero + invite/donate grid)
    │   ├── donate/page.tsx            ← Standalone donation form (single source of truth)
    │   └── api/
    │       ├── auth/wallet/route.ts   ← Also returns favoriteTeam from users table
    │       ├── donations/route.ts     ← Top donors with donation_type/donation_target causes
    │       ├── user/team/route.ts     ← GET/POST user's favorite_team
    │       ├── stellar/balance/route.ts
    │       ├── stellar/transactions/route.ts
    │       ├── stats/funding/route.ts ← Includes teamDistribution counts
    │       ├── afl/bet/route.ts
    │       ├── leaderboard/route.ts   ← Leaderboard API
    │       ├── trap/route.ts          ← Honeypot for non-Telegram access attempts
    │       └── health/route.ts
    ├── components/
    │   ├── BottomNav.tsx              ← Fixed bottom nav (border-t style, NOT pill/rounded card)
    │   ├── DashboardView.tsx          ← Full dashboard (balance card + quick stats + homecoming + AFL pulse)
    │   ├── RewardsCard.tsx
    │   ├── TeamSelectScreen.tsx       ← 2-step: LeaguePicker (AFL/WAFL) → ClubPicker grid
    │   ├── OnboardingSlides.tsx       ← 3-slide first-time user intro
    │   ├── WalletGuard.tsx            ← Redirects to / if no wallet connected (wraps all sub-pages)
    │   ├── PageLoader.tsx             ← Flying football animation (edge-to-edge arc throw)
    │   ├── guards/TelegramGuard.tsx   ← Client-side guard with DEV_BYPASS + font loading
    │   └── _dashboard/
    │       ├── BalanceCard.tsx
    │       └── AflPulseSection.tsx
    ├── config/
    │   ├── tiers.ts                   ← 5 tiers: Pre-Tier (0), T1 (100), T2 (501), T3 (1001), T4 (2501+)
    │   └── afl.ts                     ← AFL_CLUBS (18) + WAFL_CLUBS (10) + ALL_CLUBS; AflClub has league field
    ├── hooks/
    │   └── useStore.ts                ← Zustand store (stellarAddress, nsaflBalance, xlmBalance, favoriteTeam, hasSeenOnboarding)
    ├── lib/
    │   ├── constants.ts               ← PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL, NAV_ITEMS
    │   ├── stellar.ts                 ← Horizon API helpers, isValidStellarAddress
    │   ├── telegram.ts                ← SDK helpers, initData validation, getTelegramInitData
    │   ├── supabase.ts                ← Browser client
    │   ├── supabase-server.ts         ← Server client (createServerSupabaseClient, createServiceClient)
    │   ├── api-response.ts            ← ok(), fail() helpers
    │   └── logger.ts
    └── supabase/migrations/           ← 001-009 applied ✅
```

> **NOTE:** There is no `src/` directory. All app code lives directly under `telegram-app/` (app/, components/, hooks/, lib/, config/).

---

## 🚨 Asset Naming — ABSOLUTE RULE

**NEVER hardcode asset names like `CRYPTOBANK`, `NYSEAU`, or any other token name anywhere in code, UI, comments, or strings.**

The ONLY correct way to reference the token:
```ts
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
// PRIMARY_CUSTOM_ASSET_CODE = process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'
// PRIMARY_CUSTOM_ASSET_LABEL = '$' + PRIMARY_CUSTOM_ASSET_CODE
```

- In UI text: always use `{PRIMARY_CUSTOM_ASSET_LABEL}` (e.g. `$NSAFL`)
- In API routes / env fallbacks: `process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'`
- NEVER use `?? 'CRYPTOBANK'` or `?? 'NYSEAU'` as fallbacks — those are dead projects
- Zustand store field: `tokenBalance` (NOT `nsaflBalance`, NOT `cryptobankBalance`)

Violation of this rule has broken features before (leaderboard 500 error, Top Holders showing wrong balance). Run `/nsafl-asset-check` skill before every PR to catch stale names.

---

## 🎨 Design System — CRITICAL

**ALWAYS read the HTML reference files in `html1 - nasfl-app/` before building any screen.**

### Key Design Tokens
```css
background: #0A0E1A     /* Deep Navy — NEVER use #08080f or any other dark */
primary:    #D4AF37     /* Brushed Gold — NEVER use #D4A017 or #F0C040 */
glass-card: rgba(255,255,255,0.03) + backdrop-blur(12px) + border rgba(255,255,255,0.1)
```

### Fonts (loaded via `<link>` in layout.tsx `<head>`)
- **Headings**: `Playfair Display` (serif)
- **Body**: `Inter` (sans-serif)
- **Icons**: `Material Symbols Outlined` — NOT lucide-react, NOT heroicons

### BottomNav Pattern (from HTML reference)
```html
<nav class="fixed bottom-0 w-full bg-[#0A0E1A]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-3 px-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
  <div class="flex justify-between items-center pb-5">
    <!-- 4 nav links + center button -->
    <div class="relative -top-6">
      <button class="w-14 h-14 bg-[#D4AF37] text-black rounded-full border-4 border-[#0A0E1A]">
        <span class="material-symbols-outlined text-3xl animate-pulse">sports_football</span>
      </button>
    </div>
  </div>
</nav>
```

### Nav Items (from `lib/constants.ts`)
| Route | Label | Icon |
|-------|-------|------|
| `/stats` | Stats | `query_stats` |
| `/clubs` | Clubs | `stadium` |
| `/` | Home | `sports_football` (animate-pulse, center, gold, border-4 border-[#0A0E1A]) |
| `/rewards` | Rewards | `redeem` |
| `/profile` | Profile | `person` |

---

## 🌐 Asset Configuration

```
PRIMARY_CUSTOM_ASSET_CODE   = NSAFL
PRIMARY_CUSTOM_ASSET_ISSUER = GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL
SHOWN_ASSETS                = XLM,NSAFL:GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL
```

**NEVER hardcode asset codes directly in UI.** Always use `PRIMARY_CUSTOM_ASSET_CODE` / `PRIMARY_CUSTOM_ASSET_LABEL` from `@/lib/constants`.

---

## 🗄️ Supabase Schema Notes

- `wallets` has NO `telegram_id` column — join path: `users(telegram_id) → wallets(user_id) → wallet_balances(wallet_id)`
- `users` table has `favorite_team` column (text, nullable) — added in migration 009
- `donations` table has `donation_type` (general/team/player) and `donation_target` columns
- Tier IDs use hyphens: `pre-tier`, `tier-1`, `tier-2`, `tier-3`, `tier-4`
- New tables (`funding_config`, `afl_bets`) — use `(supabase as any)` until types are regenerated
- Supabase project ID: `vrqlxguhfndrqiipisyi`
- All migrations 001–009 applied ✅

---

## 🔑 Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vrqlxguhfndrqiipisyi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
TELEGRAM_BOT_TOKEN=<NSAFL_bot token from BotFather>
NEXT_PUBLIC_BOT_USERNAME=NSAFL_bot
NEXT_PUBLIC_PRIMARY_ASSET_CODE=NSAFL
NEXT_PUBLIC_PRIMARY_ASSET_ISSUER=GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL
NEXT_PUBLIC_SHOWN_ASSETS=XLM,NSAFL:GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL
NEXT_PUBLIC_DEV_BYPASS=true          # local dev only — NOT in Vercel production
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS=GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL
NEXT_PUBLIC_XLM_TO_TOKEN_RATE=1
NEXT_PUBLIC_ADMIN_TELEGRAM_USERNAMES=americandreamer8
ADMIN_SECRET_TOKEN=<admin secret>
```

---

## 🔐 TelegramGuard Dev Bypass

```ts
// components/guards/TelegramGuard.tsx
const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
```

- Guard runs **client-side** (`'use client'`) using `useEffect` + `setTimeout(check, 0)` to wait for Telegram WebApp SDK to initialise
- CSS-only spinner overlay stays visible until guard resolves AND Material Symbols font is confirmed loaded
- Uses `document.fonts.load('24px "Material Symbols Outlined"', 'sports_football')` with 4s timeout fallback
- Loader fades out with 0.2s opacity transition before removal
- Returns `null` during check (no React elements with unloaded icons)
- In production, tree-shaking removes the bypass entirely

---

## ⚡ API Route Conventions

All `/api/*` routes:
1. Read `x-telegram-init-data` header (sent from `getTelegramInitData()` in `lib/telegram.ts`)
2. Validate via `validateTelegramInitData(initData, BOT_TOKEN)` — skipped in dev bypass mode
3. Return `{ success: true, data: T }` via `ok(data)` helper
4. Return `{ success: false, error: string, code: string }` via `fail(msg, code)` helper

---

## 📄 page.tsx Phase State Machine

`page.tsx` manages 6 phases: `'onboarding' | 'gate' | 'connecting' | 'celebration' | 'team-select' | 'dashboard'`

- Opens at `'onboarding'` if `!hasSeenOnboarding` (first-time users only)
- Opens at `'dashboard'` if `isConnected && favoriteTeam` (Zustand persist)
- Opens at `'team-select'` if `isConnected && !favoriteTeam` (enforces team pick)
- On connect: validates address → POST `/api/auth/wallet` → GET `/api/stellar/balance` → `'celebration'`
- Auth response includes `favoriteTeam` for returning users (restores from DB)
- Celebration → "Enter Dashboard" → goes to `'team-select'` if no team, else `'dashboard'`
- Team select renders `<TeamSelectScreen>` (2-step: league picker → club grid) → POSTs to `/api/user/team` → saves to Zustand → `'dashboard'`
- Dashboard renders `<DashboardView>` + `<BottomNav>`

### WalletGuard Pattern
All sub-pages (stats, clubs, rewards, buy, profile) are wrapped in `<WalletGuard>`.
If `isConnected` is false, user is redirected to `/` (the gate screen).

---

## 🧪 Verification Commands

```bash
cd telegram-app
npm run dev        # localhost:3000
npx tsc --noEmit   # must show 0 errors
npm run lint       # eslint
```

---

## 📋 Current Status

- **All 7 pages live:** Dashboard, Stats, Profile, Clubs, Rewards, Buy, Leaderboard
- **WAFL clubs added:** 10 WAFL teams with real logos (Wikimedia Commons) alongside 18 AFL clubs
- **Team selection flow:** 2-step (league picker → club grid); mandatory after wallet connect
- **Onboarding flow:** 3-slide `OnboardingSlides` shown on first visit (`hasSeenOnboarding` flag)
- **WalletGuard:** All sub-pages protected — no wallet = redirect to gate
- **Donations:** Top Supporters shows what each donor contributed to (team/player/general)
- **Rewards:** Auto-generated memo field based on donation type + Buy CTA
- **Profile:** Team badge, live Horizon transactions (flying football loader), logout in header
- **Stats:** Team Allegiance section showing fan distribution across clubs
- **Leaderboard:** Top NSAFL holders ranked by balance
- **AFL logos:** All 18 clubs have real logos from TheSportsDB CDN
- **WAFL logos:** All 10 teams use Wikimedia Commons URLs
- **Font loading:** FOUT fully solved — CSS loader stays until Material Symbols confirmed loaded
- **UI matches HTML reference files** — glassmorphism navy+gold design, BottomNav with border-t style
- **Empty states:** Added across app for no-data scenarios
- **Rate limiting:** Per-user keying on all user-action endpoints; transactions at 120/min
- **Transactions:** API returns all raw Horizon payments; client-side spam detection via SHOWN_ASSET_CONFIGS (code+issuer match); `hideSpam` defaults to `true`
- **Rewards page:** LOCKED — tier cards + `DonateCTA` (links to `/donate`); do not modify
- **Stats page:** LOCKED — offer sale progress card (DEX trade volume) + community stats; do not modify
- **Profile page:** LOCKED — do not modify without explicit instruction
- **Donate page:** `/donate` — standalone form; ONLY place with the donation form
- **Leaderboard:** Redesigned — podium, rank hero card, inline climb nudge, invite+donate 2-col grid
- **WAFL fixtures:** Added to Clubs page
- **Phase 5 (Vercel deploy)** is next

---

## ⚠️ LESSONS LEARNED — DO NOT REPEAT

### Project Structure
- **No `src/` directory.** Code lives directly in `telegram-app/app/`, `telegram-app/components/`, etc.
- Path aliases: `@/` maps to `telegram-app/` root (configured in tsconfig.json)

### Tailwind v4
- Use `@import "tailwindcss"` in globals.css — NOT `@tailwind base/components/utilities`
- Custom tokens go in `@theme { }` block — NOT in `tailwind.config.js` `extend`
- Google Fonts MUST be `<link>` tags in layout.tsx `<head>` — CSS `@import url()` gets dropped by Tailwind v4

### Material Symbols & Font Loading (FOUT Prevention)
- Always load via `<link>` in layout.tsx (NOT npm package)
- Define `.material-symbols-outlined` class in globals.css with font-family, display, etc.
- Fill variant: `style={{ fontVariationSettings: "'FILL' 1" }}`
- Use icon names with underscores: `sports_football`, `query_stats`, `account_balance_wallet`
- **FOUT fix:** Do NOT use `opacity: 0` on icons — creates invisible gaps worse than raw text
- Instead: keep CSS-only loader overlay visible until `document.fonts.load()` confirms font loaded
- `document.fonts.ready` can resolve prematurely if font request hasn't started — use `document.fonts.load()` with specific font family + 4s timeout fallback
- TelegramGuard returns `null` during check phase so no unloaded icon text is ever visible

### Zustand Store
- Address is stored as `stellarAddress` (NOT `address`)
- Always use `useWalletStore((s) => s.stellarAddress)` — never `s.address`
- Store name: `'homecoming-hub-wallet'` (localStorage key)
- Balance fields: `tokenBalance` (string, from Zustand) and `xlmBalance` — NEVER use `nsaflBalance` or `cryptobankBalance`
- `favoriteTeam: string | null` — persisted, cleared on disconnect
- `hasSeenOnboarding: boolean` — persisted; controls whether onboarding phase is shown
- Actions: `setFavoriteTeam(teamId)`, `setHasSeenOnboarding()`, `disconnect()` clears everything including favoriteTeam

### Supabase Types
- Each table in generated types MUST have `Relationships: []`
- Use `(supabase as any)` for `funding_config` and `afl_bets` tables until types are regenerated
- Server client in `supabase-server.ts` exports both `createServerSupabaseClient` and `createServiceClient`

### Design
- Background: `#0A0E1A` — NOT `#08080f` or any other dark shade
- Gold: `#D4AF37` — NOT `#D4A017` or `#F0C040`
- BottomNav: `border-t border-white/10` style (NOT pill/rounded card floating style)
- Center nav button: `border-4 border-[#0A0E1A]` + `animate-pulse` on icon
- Safe area padding: use `.pb-safe` class (defined in globals.css via `env(safe-area-inset-bottom)`)
- `min-height: max(884px, 100dvh)` on body for consistent Telegram viewport
- Reward stat tiles: icon (`text-xl`, filled, `tier.color`) + tiny all-caps label + bold `text-sm` value — always expanded; locked tiers use `opacity-40` NOT hidden
- XLM refund % in referral promos: always dynamic — `currentTier.rewards?.xlmRefundPct ?? 20` — NEVER hardcode
- Gold/Silver reward counts: number only, NO "oz" unit

### UI Duplication
- Before adding a promo/info card, check if that content already exists elsewhere on the page
- Profile referrals: ONE unified card — link + Copy/Share always visible, list or benefit tiles below; NO separate "Invite Friends" card AND "My Referrals" accordion
- Dashboard: no "Movement Momentum" section — holder/donation stats live on Stats page only
- Donation form lives ONLY in `/donate` — rewards page shows `DonateCTA` (preview + button), profile donate button links to `/donate`; do NOT duplicate the form

### Vercel Env Vars — Critical Rules
- `NEXT_PUBLIC_*` vars are **baked at build time** — changing them in Vercel requires a new deploy
- Server-side vars (`TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) are **runtime** — no redeploy needed, BUT Vercel dashboard shows "A new deployment is needed" — always redeploy after any change
- **NEVER use `echo "value" | vercel env add`** — `echo` adds a trailing newline that corrupts the value. Use `printf "value" | vercel env add` instead
- After changing env vars in Vercel dashboard, always run `vercel --prod` to redeploy
- `vercel env pull` downloads only the **development** environment, not production values
- To verify env var values: Vercel dashboard → Project → Settings → Environment Variables → click eye icon

### Telegram Bot Token & Mini App Auth
- `TELEGRAM_BOT_TOKEN` must match **exactly** the bot the Mini App is opened from in Telegram
- If 401 INVALID_AUTH: the token in Vercel doesn't match the bot signing the initData
- The initData HMAC is signed by the bot whose Mini App is being opened — wrong token = 401
- New bot setup checklist: BotFather → `/newapp` on the bot → set URL → then update `TELEGRAM_BOT_TOKEN` in Vercel
- `NEXT_PUBLIC_BOT_USERNAME` is used to build referral links — must match the actual bot username
- Referral links use `?startapp=ref_ID` format (NOT `?start=`) — only `startapp` populates `initDataUnsafe.start_param`

### Referral System
- Referral captured in `TelegramGuard` via `tg.initDataUnsafe.start_param` (NOT URL query params)
- Saved to DB at session open (before wallet connect) via `/api/auth/session`
- Format: `https://t.me/NSAFL_bot?startapp=ref_<telegramId>`
- DB column: `users.referred_by` (bigint, references `users.telegram_id`)
- **Centralised helpers in `lib/telegram.ts`:** `buildReferralLink(tgId, botUsername?)` and `shareReferralLink(link)` — NEVER inline the share URL or message text anywhere else
- Share message text lives in `REFERRAL_SHARE_TEXT` constant in `lib/telegram.ts` — change once there, applies everywhere
- Always use `liveTgId ?? telegramUserId` (Zustand fallback) when resolving tgId for referral links

### Stellar / XLM Balance
- **XLM raised in offer sale** = sum of `counter_amount` from Horizon trades endpoint: `/trades?base_asset_type=credit_alphanum12&base_asset_code=NSAFL&base_asset_issuer=ISSUER&counter_asset_type=native` — NOT issuer account XLM balance (that's just what's left, not total raised)
- Paginate trades up to 10 pages (200/page = 2000 trades) to get accurate cumulative total
- Native XLM MUST be matched by `b.isNative === true` — NOT by `b.asset === 'XLM'` (spam tokens exist named "XLM")
- `NEXT_PUBLIC_SHOWN_ASSETS` format: `XLM,NSAFL:ISSUER_ADDRESS` — never `XLM:native`
- `hasPrimaryAssetTrustline` checks by both code AND issuer — correct behavior
- Transaction API (`/api/stellar/transactions`) returns ALL raw Horizon payments — NO server-side filtering
- Client-side `isSpamTx(r)`: native = `r.asset_type === 'native'`, non-native must match BOTH `asset_code` AND `asset_issuer` against `SHOWN_ASSET_CONFIGS`
- `SHOWN_ASSET_CONFIGS` in `lib/constants.ts` has `{ code, issuer }` — use this for spam detection, NOT a plain code string list
- `hideSpam` defaults to `true` — "Show all" reveals everything, "Hide spam (N)" re-filters
- Auto-fetch on empty: use `useEffect` on `[loading, allTxns.length, hasMore, nextCursor]` — NOT a while loop (burns rate limit)

### PageLoader Timing
- `useMinLoader` enforces a **2000ms minimum** display time — any scroll or timing logic after navigation must account for this; 400ms `setTimeout` will fire before content renders
- For post-navigation scroll: poll with `setInterval` (200ms, 6s max) checking `document.getElementById(id)` — cancel on found or timeout
- Avoid `?scroll=section` query param + `useSearchParams` hacks; prefer dedicated pages for distinct form flows

### TelegramWindow Type
- `TelegramWindow` in `lib/telegram.ts` must include `openTelegramLink?: (url: string) => void` in WebApp — add when extending; call as `openTelegramLink?.(url)` (optional chaining)

### Next.js
- Use `next/script` with `strategy="beforeInteractive"` for `telegram-web-app.js`
- `next/image` — if used, configure `domains` in next.config.ts for external image sources
- App Router only — no Pages Router

### Rate Limiting
- Use per-user key (`team:{telegramId}`) not per-IP for user-action endpoints
- In dev all requests share the same IP and will hit IP-based limits very quickly
- `checkRateLimit(req, max, key?)` accepts an optional third key parameter — pass `telegramId` for user actions
- Resolve `telegramId` BEFORE calling `checkRateLimit` when possible — pass as key: `checkRateLimit(req, max, \`prefix:${telegramId}\`)`
- Transactions endpoint uses 120/min — profile page auto-fetches multiple pages on mount

### API Response Shape Gotcha
- Stats API nests `holderCount` inside `tokenStats.holderCount` — always map nested fields to top-level in fetch handlers
- Pattern: `holderCount: d.tokenStats?.holderCount ?? d.holderCount ?? 0`
- Always add `?.` optional chaining + `?? fallback` when accessing nested API data

### Team Selection (AFL + WAFL)
- Team selection is mandatory after wallet connect — enforced by phase machine
- `favoriteTeam` persisted in both Zustand (client) and Supabase `users.favorite_team` (server)
- Auth endpoint returns `favoriteTeam` so returning users skip team selection
- AFL club logos from TheSportsDB CDN (`r2.thesportsdb.com`) — free, no API key needed
- WAFL club logos from Wikimedia Commons (`upload.wikimedia.org/wikipedia/en/...`) — **NOT** sportix.cloud (returns AccessDenied)
- TheSportsDB has NO WAFL data — use Wikipedia REST API (`/api/rest_v1/page/summary/{Club_Name}`) for WAFL team info/thumbnails
- Logo size in config: stored as URLs, rendered at 52×52px in TeamSelectScreen
- `AflClub` interface has `league: 'AFL' | 'WAFL'` field
- `config/afl.ts` exports `AFL_CLUBS`, `WAFL_CLUBS` (10 teams), and `ALL_CLUBS = [...AFL_CLUBS, ...WAFL_CLUBS]`
- `next.config.ts` remotePatterns must include `upload.wikimedia.org` for WAFL logos
- `TeamSelectScreen` uses 2-step flow: `LeaguePicker` (AFL/WAFL tabs) → `ClubPicker` (club grid)
- Clubs page Fan Hub has AFL/WAFL tabs showing `{N} teams` count; tab switches call `window.scrollTo({ top: 0 })` to reset scroll

---

## 🚀 What's Next (Phase 5+)

### Immediate: Vercel Deploy
1. Run `/vercel:setup` skill to link project
2. Add all `.env.local` vars to Vercel dashboard
3. Set Telegram bot webhook to Vercel URL
4. Run `/vercel:deploy` skill

### External Data Sources
- **AFL club logos:** TheSportsDB free API — `r2.thesportsdb.com/images/media/team/badge/...`
- **Stellar transactions:** Fetched live from Horizon API (NOT stored in DB)
- **Token stats:** `holderCount` is nested inside `tokenStats.holderCount` in API response — always map it

### Improvements Backlog
- Real-time Supabase subscriptions for balance updates
- Push notifications via Telegram bot
- Clubs page — voting / funding mechanism
- Rewards page — actual claim flow (not just display)
- Stats page — live charts with Supabase Realtime
- TypeScript: regenerate Supabase types to remove `(supabase as any)` casts
- Add `Header.tsx`, `TierBadge.tsx`, `Toast.tsx` components
- Unit tests for `stellar.ts` validation and tier logic
