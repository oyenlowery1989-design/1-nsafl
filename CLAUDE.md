# CLAUDE.md — CRYPTOBANK Homecoming Hub (Telegram Mini App)

## 🎯 Project Overview

**"The Homecoming Hub"** is a Telegram Mini App for the CRYPTOBANK ($CRYPTOBANK Stellar token) ecosystem.
Users connect their Stellar blockchain wallet, view their $CRYPTOBANK token balance,
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
│   └── 2026-03-09-cryptobank-homecoming-hub.md
├── Dashboard connect wallet.html      ← HTML reference designs
├── Connected.html
├── Dashboard.html
├── Stats.html
├── Rewards.html
├── Profile.html
└── telegram-app/                      ← Next.js app root
    ├── app/
    │   ├── layout.tsx                 ← Root layout (TelegramGuard, Google Fonts via <link>, Telegram SDK)
    │   ├── page.tsx                   ← Phase state machine (gate→connecting→celebration→team-select→dashboard)
    │   ├── globals.css                ← Tailwind v4 @import, @theme tokens, .glass-card, animations
    │   ├── stats/page.tsx             ← Stats + Top Supporters (with donation causes) + Team Allegiance
    │   ├── profile/page.tsx           ← Profile + team badge + transactions (live from Horizon)
    │   ├── clubs/page.tsx
    │   ├── rewards/page.tsx           ← Tier display + donation form (auto-memo) + Buy CTA
    │   ├── buy/page.tsx               ← Buy CRYPTOBANK page
    │   └── api/
    │       ├── auth/wallet/route.ts   ← Also returns favoriteTeam from users table
    │       ├── donations/route.ts     ← Top donors with donation_type/donation_target causes
    │       ├── user/team/route.ts     ← GET/POST user's favorite_team
    │       ├── stellar/balance/route.ts
    │       ├── stellar/transactions/route.ts
    │       ├── stats/funding/route.ts ← Includes teamDistribution counts
    │       ├── afl/bet/route.ts
    │       ├── trap/route.ts          ← Honeypot for non-Telegram access attempts
    │       └── health/route.ts
    ├── components/
    │   ├── BottomNav.tsx              ← Fixed bottom nav (border-t style, NOT pill/rounded card)
    │   ├── DashboardView.tsx          ← Full dashboard (balance card + quick stats + homecoming + AFL pulse)
    │   ├── RewardsCard.tsx
    │   ├── TeamSelectScreen.tsx       ← Harry Potter–style team selection (3-col grid, club logos)
    │   ├── WalletGuard.tsx            ← Redirects to / if no wallet connected (wraps all sub-pages)
    │   ├── PageLoader.tsx             ← Flying football animation (edge-to-edge arc throw)
    │   ├── guards/TelegramGuard.tsx   ← Client-side guard with DEV_BYPASS + font loading
    │   └── _dashboard/
    │       ├── BalanceCard.tsx
    │       └── AflPulseSection.tsx
    ├── config/
    │   ├── tiers.ts                   ← 5 tiers: Pre-Tier (0), T1 (100), T2 (501), T3 (1001), T4 (2501+)
    │   └── afl.ts                     ← 18 AFL clubs with logos (TheSportsDB CDN), opening round, ladder
    ├── hooks/
    │   └── useStore.ts                ← Zustand store (stellarAddress, nsaflBalance, xlmBalance, favoriteTeam)
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
PRIMARY_CUSTOM_ASSET_CODE   = CRYPTOBANK
PRIMARY_CUSTOM_ASSET_ISSUER = GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z
SHOWN_ASSETS                = CRYPTOBANK,XLM
```

**NEVER hardcode "NSAFL" or "CRYPTOBANK" directly in UI.** Always use `PRIMARY_CUSTOM_ASSET_CODE` / `PRIMARY_CUSTOM_ASSET_LABEL` from `@/lib/constants`.

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
TELEGRAM_BOT_TOKEN=8719214894:AAG5mKLOtXi7mMo7Pk9vJrK1giU2sQHj3D4
NEXT_PUBLIC_PRIMARY_ASSET_CODE=CRYPTOBANK
NEXT_PUBLIC_PRIMARY_ASSET_ISSUER=GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z
NEXT_PUBLIC_SHOWN_ASSETS=CRYPTOBANK,XLM
NEXT_PUBLIC_DEV_BYPASS=true
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS=<xlm address>
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

`page.tsx` manages 5 phases: `'gate' | 'connecting' | 'celebration' | 'team-select' | 'dashboard'`

- Opens at `'dashboard'` if `isConnected && favoriteTeam` (Zustand persist)
- Opens at `'team-select'` if `isConnected && !favoriteTeam` (enforces team pick)
- On connect: validates address → POST `/api/auth/wallet` → GET `/api/stellar/balance` → `'celebration'`
- Auth response includes `favoriteTeam` for returning users (restores from DB)
- Celebration → "Enter Dashboard" → goes to `'team-select'` if no team, else `'dashboard'`
- Team select renders `<TeamSelectScreen>` → POSTs to `/api/user/team` → saves to Zustand → `'dashboard'`
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

- **All 6 pages live:** Dashboard, Stats, Profile, Clubs, Rewards, Buy
- **Team selection flow:** Mandatory after wallet connect (Harry Potter sorting hat style)
- **WalletGuard:** All sub-pages protected — no wallet = redirect to gate
- **Donations:** Top Supporters shows what each donor contributed to (team/player/general)
- **Rewards:** Auto-generated memo field based on donation type + Buy CTA
- **Profile:** Team badge, live Horizon transactions (flying football loader), logout in header
- **Stats:** Team Allegiance section showing fan distribution across clubs
- **AFL logos:** All 18 clubs have real logos from TheSportsDB CDN
- **Font loading:** FOUT fully solved — CSS loader stays until Material Symbols confirmed loaded
- **UI matches HTML reference files** — glassmorphism navy+gold design, BottomNav with border-t style
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
- Balance fields: `nsaflBalance` and `xlmBalance` (NOT `cryptobankBalance`)
- `favoriteTeam: string | null` — persisted, cleared on disconnect
- Actions: `setFavoriteTeam(teamId)`, `disconnect()` clears everything including favoriteTeam

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

### Next.js
- Use `next/script` with `strategy="beforeInteractive"` for `telegram-web-app.js`
- `next/image` — if used, configure `domains` in next.config.ts for external image sources
- App Router only — no Pages Router

### API Response Shape Gotcha
- Stats API nests `holderCount` inside `tokenStats.holderCount` — always map nested fields to top-level in fetch handlers
- Pattern: `holderCount: d.tokenStats?.holderCount ?? d.holderCount ?? 0`
- Always add `?.` optional chaining + `?? fallback` when accessing nested API data

### Team Selection (AFL)
- Team selection is mandatory after wallet connect — enforced by phase machine
- `favoriteTeam` persisted in both Zustand (client) and Supabase `users.favorite_team` (server)
- Auth endpoint returns `favoriteTeam` so returning users skip team selection
- AFL club logos from TheSportsDB CDN (`r2.thesportsdb.com`) — free, no API key needed
- Logo size in config: stored as URLs, rendered at 52×52px in TeamSelectScreen

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
