# NSAFL Homecoming Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready Next.js 16 Telegram Mini App that lets users connect their Stellar wallet, view their $NSAFL balance, track AFL player homecomings, see AFL fixtures, claim tiered rewards, and view movement stats.

**Architecture:** Next.js 16 App Router with Tailwind v4, Zustand for client state, Supabase for persistence, and Stellar Horizon REST API for real-time balances. All routes are guarded by `TelegramGuard` — a server-side component that validates Telegram `initData` HMAC-SHA256. In dev, `NEXT_PUBLIC_DEV_BYPASS=true` skips validation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand + persist, Supabase (Postgres + Realtime), Stellar Horizon API, `@telegram-apps/sdk`, Material Symbols Outlined icons, Vercel deployment.

---

## Reference Files (READ BEFORE BUILDING ANY SCREEN)

HTML designs live at: `../` relative to `telegram-app/` (i.e., parent folder `html1 - nasfl-app/`):
- `Dashboard connect wallet.html` — disconnected wallet state
- `Connected.html` — wallet connected success
- `Dashboard.html` — main dashboard
- `Stats.html` — movement stats
- `Rewards.html` — tiered rewards market
- `Profile.html` — wallet profile + transactions

Design tokens:
```
background: #0A0E1A   (deep navy)
primary:    #D4AF37   (brushed gold)
glass-card: bg rgba(255,255,255,0.03) + backdrop-blur(12px) + border rgba(255,255,255,0.1)
font-body:  Inter
font-head:  Playfair Display (serif)
icons:      Material Symbols Outlined (Google Fonts link tag)
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `telegram-app/` (new directory)

**Step 1: Create the project**

```bash
cd "C:\Users\Windows\Downloads\html1 - nasfl-app"
npx create-next-app@latest telegram-app --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*"
```

Then move into the project:
```bash
cd telegram-app
```

**Step 2: Install dependencies**

```bash
npm install zustand @supabase/supabase-js @telegram-apps/sdk stellar-sdk
npm install --save-dev typescript @types/node @types/react @types/react-dom
```

**Step 3: Install Tailwind v4**

```bash
npm install tailwindcss@next @tailwindcss/postcss@next
```

Create `postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

**Step 4: Verify the project builds**

```bash
npm run build
```
Expected: Build succeeds (no TS errors).

**Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 16 project with dependencies"
```

---

## Task 2: Global CSS, Fonts & Design Tokens

**Files:**
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Write globals.css**

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #D4AF37;
  --color-background-dark: #0A0E1A;
  --color-glass-bg: rgba(255, 255, 255, 0.05);
  --color-glass-border: rgba(255, 255, 255, 0.1);
  --font-sans: 'Inter', sans-serif;
  --font-serif: 'Playfair Display', serif;
}

body {
  font-family: var(--font-sans);
  background-color: #0A0E1A;
  color: #E2E8F0;
  min-height: max(884px, 100dvh);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-serif);
}

.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
}
```

**Step 2: Write root layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Homecoming Hub',
  description: 'NSAFL AFL Movement',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <script
          src="https://telegram.org/js/telegram-web-app.js"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add global CSS with Tailwind v4 tokens and fonts"
```

---

## Task 3: Environment Variables & Constants

**Files:**
- Create: `.env.local`
- Create: `src/lib/constants.ts`

**Step 1: Create .env.local**

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://vrqlxguhfndrqiipisyi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key here>
SUPABASE_SERVICE_ROLE_KEY=<paste service role key here>
TELEGRAM_BOT_TOKEN=8719214894:AAG5mKLOtXi7mMo7Pk9vJrK1giU2sQHj3D4
NEXT_PUBLIC_PRIMARY_ASSET_CODE=NSAFL
NEXT_PUBLIC_PRIMARY_ASSET_ISSUER=GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z
NEXT_PUBLIC_SHOWN_ASSETS=NSAFL,XLM
NEXT_PUBLIC_DEV_BYPASS=true
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS=
```

**Step 2: Create constants.ts**

```ts
// src/lib/constants.ts
export const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'

export const PRIMARY_CUSTOM_ASSET_LABEL = `$${PRIMARY_CUSTOM_ASSET_CODE}`

export const PRIMARY_CUSTOM_ASSET_ISSUER =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const NAV_ITEMS = [
  { href: '/stats', label: 'Stats', icon: 'query_stats' },
  { href: '/clubs', label: 'Clubs', icon: 'stadium' },
  { href: '/', label: 'Home', icon: 'sports_football', isCenter: true },
  { href: '/rewards', label: 'Rewards', icon: 'redeem' },
  { href: '/profile', label: 'Profile', icon: 'person' },
] as const
```

**Step 3: Commit**

```bash
git add src/lib/constants.ts .env.local
git commit -m "feat: add constants and env config"
```

---

## Task 4: Supabase Clients

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/supabase-server.ts`

**Step 1: Browser client**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

**Step 2: Server client**

```ts
// src/lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js'

export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Step 3: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase-server.ts
git commit -m "feat: add Supabase browser and server clients"
```

---

## Task 5: Stellar Horizon Helpers

**Files:**
- Create: `src/lib/stellar.ts`

**Step 1: Write stellar.ts**

```ts
// src/lib/stellar.ts
import { HORIZON_URL, PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER } from './constants'

export interface StellarBalance {
  asset: string
  balance: string
  isNative: boolean
}

export async function fetchStellarBalances(address: string): Promise<StellarBalance[]> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`Stellar API error: ${res.status}`)
  const data = await res.json()

  return (data.balances as any[]).map((b: any) => ({
    asset: b.asset_type === 'native' ? 'XLM' : b.asset_code,
    balance: parseFloat(b.balance).toFixed(2),
    isNative: b.asset_type === 'native',
  }))
}

export async function fetchCustomAssetBalance(address: string): Promise<string> {
  const balances = await fetchStellarBalances(address)
  const asset = balances.find(
    (b) => b.asset === PRIMARY_CUSTOM_ASSET_CODE
  )
  return asset?.balance ?? '0.00'
}

export async function fetchXlmBalance(address: string): Promise<string> {
  const balances = await fetchStellarBalances(address)
  const xlm = balances.find((b) => b.isNative)
  return xlm?.balance ?? '0.00'
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address)
}
```

**Step 2: Commit**

```bash
git add src/lib/stellar.ts
git commit -m "feat: add Stellar Horizon balance helpers"
```

---

## Task 6: Telegram Auth Helpers

**Files:**
- Create: `src/lib/telegram.ts`

**Step 1: Write telegram.ts**

```ts
// src/lib/telegram.ts
import crypto from 'crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export function validateTelegramInitData(
  initData: string,
  botToken: string
): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    params.delete('hash')
    const sorted = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sorted)
      .digest('hex')

    if (expectedHash !== hash) return null

    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(userStr) as TelegramUser
  } catch {
    return null
  }
}

export function isTelegramEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).Telegram?.WebApp?.initData
}

export function getTelegramInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as any).Telegram?.WebApp?.initData ?? ''
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null
  const user = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  return user ?? null
}
```

**Step 2: Commit**

```bash
git add src/lib/telegram.ts
git commit -m "feat: add Telegram initData validation helper"
```

---

## Task 7: API Response Helpers

**Files:**
- Create: `src/lib/api-response.ts`

**Step 1: Write api-response.ts**

```ts
// src/lib/api-response.ts
import { NextResponse } from 'next/server'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function fail(error: string, code: string, status = 400) {
  return NextResponse.json({ success: false, error, code }, { status })
}
```

**Step 2: Commit**

```bash
git add src/lib/api-response.ts
git commit -m "feat: add API response helpers"
```

---

## Task 8: Tier Config

**Files:**
- Create: `src/config/tiers.ts`

**Step 1: Write tiers.ts**

```ts
// src/config/tiers.ts
export interface Tier {
  id: string
  label: string
  minBalance: number
  color: string
  icon: string
}

export const TIERS: Tier[] = [
  { id: 'pre-tier', label: 'Pre-Tier', minBalance: 0, color: '#6B7280', icon: 'star_border' },
  { id: 'tier-1', label: 'Foundation', minBalance: 100, color: '#F97316', icon: 'shield' },
  { id: 'tier-2', label: 'Elite', minBalance: 501, color: '#A78BFA', icon: 'verified' },
  { id: 'tier-3', label: 'Gold Legacy', minBalance: 1001, color: '#D4AF37', icon: 'star' },
  { id: 'tier-4', label: 'Platinum', minBalance: 2501, color: '#E2E8F0', icon: 'workspace_premium' },
]

export function getTierForBalance(balance: number): Tier {
  const reversed = [...TIERS].reverse()
  return reversed.find((t) => balance >= t.minBalance) ?? TIERS[0]
}
```

**Step 2: Commit**

```bash
git add src/config/tiers.ts
git commit -m "feat: add tier configuration"
```

---

## Task 9: AFL Config & Fixtures

**Files:**
- Create: `src/config/afl.ts`

**Step 1: Write afl.ts with clubs and Round 1 fixtures**

```ts
// src/config/afl.ts
export interface AflClub {
  id: string
  name: string
  shortName: string
  color: string
}

export interface AflFixture {
  id: string
  round: number
  date: string
  venue: string
  country: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: 'UPCOMING' | 'FULL TIME' | 'LIVE'
  winner: string | null
  matchReportUrl: string
}

export const AFL_CLUBS: AflClub[] = [
  { id: 'adelaide', name: 'Adelaide Crows', shortName: 'ADL', color: '#002B5C' },
  { id: 'brisbane', name: 'Brisbane Lions', shortName: 'BRL', color: '#A30046' },
  { id: 'carlton', name: 'Carlton', shortName: 'CAR', color: '#0E3C96' },
  { id: 'collingwood', name: 'Collingwood', shortName: 'COL', color: '#000000' },
  { id: 'essendon', name: 'Essendon', shortName: 'ESS', color: '#CC2031' },
  { id: 'fremantle', name: 'Fremantle', shortName: 'FRE', color: '#2A1A54' },
  { id: 'geelong', name: 'Geelong Cats', shortName: 'GEE', color: '#1C3F94' },
  { id: 'gold-coast', name: 'Gold Coast SUNS', shortName: 'GCS', color: '#E5232B' },
  { id: 'gws', name: 'GWS GIANTS', shortName: 'GWS', color: '#F47920' },
  { id: 'hawthorn', name: 'Hawthorn', shortName: 'HAW', color: '#4D2004' },
  { id: 'melbourne', name: 'Melbourne', shortName: 'MEL', color: '#CC2031' },
  { id: 'north-melbourne', name: 'North Melbourne', shortName: 'NTH', color: '#003CA6' },
  { id: 'port-adelaide', name: 'Port Adelaide', shortName: 'PAP', color: '#008AAB' },
  { id: 'richmond', name: 'Richmond', shortName: 'RIC', color: '#FED102' },
  { id: 'st-kilda', name: 'St Kilda', shortName: 'STK', color: '#ED0F05' },
  { id: 'sydney', name: 'Sydney Swans', shortName: 'SYD', color: '#E2001A' },
  { id: 'west-coast', name: 'West Coast Eagles', shortName: 'WCE', color: '#003087' },
  { id: 'western-bulldogs', name: 'Western Bulldogs', shortName: 'WBD', color: '#0057A5' },
]

export const ROUND_1_FIXTURES: AflFixture[] = [
  {
    id: 'r1-1', round: 1,
    date: 'Thursday March 5', venue: 'SCG, Sydney', country: 'Gadigal',
    homeTeam: 'Sydney Swans', awayTeam: 'Carlton',
    homeScore: 132, awayScore: 69,
    status: 'FULL TIME', winner: 'Sydney Swans won by 63',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-2', round: 1,
    date: 'Friday March 6', venue: 'People First Stadium, Gold Coast', country: 'Yugambeh',
    homeTeam: 'Gold Coast SUNS', awayTeam: 'Geelong Cats',
    homeScore: 125, awayScore: 69,
    status: 'FULL TIME', winner: 'Gold Coast SUNS won by 56',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-3', round: 1,
    date: 'Saturday March 7', venue: 'ENGIE Stadium, Sydney', country: 'Wangal',
    homeTeam: 'GWS GIANTS', awayTeam: 'Hawthorn',
    homeScore: 122, awayScore: 95,
    status: 'FULL TIME', winner: 'GWS GIANTS won by 27',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-4', round: 1,
    date: 'Saturday March 7', venue: 'Gabba, Brisbane', country: 'Yuggera - Toorabul',
    homeTeam: 'Brisbane Lions', awayTeam: 'Western Bulldogs',
    homeScore: 106, awayScore: 111,
    status: 'FULL TIME', winner: 'Western Bulldogs won by 5',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
  {
    id: 'r1-5', round: 1,
    date: 'Sunday March 8', venue: 'MCG, Melbourne', country: 'Wurundjeri',
    homeTeam: 'St Kilda', awayTeam: 'Collingwood',
    homeScore: 66, awayScore: 78,
    status: 'FULL TIME', winner: 'Collingwood won by 12',
    matchReportUrl: 'https://www.afl.com.au/fixture?Competition=1&Season=85&Round=1344',
  },
]
```

**Step 2: Commit**

```bash
git add src/config/afl.ts
git commit -m "feat: add AFL clubs and Round 1 fixture data"
```

---

## Task 10: Zustand Store

**Files:**
- Create: `src/hooks/useStore.ts`

**Step 1: Write useStore.ts**

```ts
// src/hooks/useStore.ts
'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WalletStore {
  stellarAddress: string | null
  nsaflBalance: string
  xlmBalance: string
  isConnected: boolean
  telegramUserId: number | null

  setWallet: (address: string) => void
  setBalances: (nsafl: string, xlm: string) => void
  setTelegramUserId: (id: number) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      stellarAddress: null,
      nsaflBalance: '0.00',
      xlmBalance: '0.00',
      isConnected: false,
      telegramUserId: null,

      setWallet: (address) =>
        set({ stellarAddress: address, isConnected: true }),

      setBalances: (nsafl, xlm) =>
        set({ nsaflBalance: nsafl, xlmBalance: xlm }),

      setTelegramUserId: (id) => set({ telegramUserId: id }),

      disconnect: () =>
        set({
          stellarAddress: null,
          nsaflBalance: '0.00',
          xlmBalance: '0.00',
          isConnected: false,
        }),
    }),
    { name: 'homecoming-hub-wallet' }
  )
)
```

**Step 2: Commit**

```bash
git add src/hooks/useStore.ts
git commit -m "feat: add Zustand wallet store with persist"
```

---

## Task 11: TelegramGuard Component

**Files:**
- Create: `src/components/guards/TelegramGuard.tsx`

**Step 1: Write TelegramGuard.tsx**

```tsx
// src/components/guards/TelegramGuard.tsx
'use client'
import { useEffect, useState } from 'react'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export default function TelegramGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (isDev) {
      setAllowed(true)
      return
    }
    const tg = (window as any).Telegram?.WebApp
    if (tg && tg.initData) {
      tg.ready()
      tg.expand()
      setAllowed(true)
    } else {
      setAllowed(false)
    }
  }, [])

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0E1A]">
        <span
          className="material-symbols-outlined text-[#D4AF37] animate-spin text-5xl"
          style={{ animationDuration: '2s' }}
        >
          sports_football
        </span>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0E1A] px-8 text-center space-y-4">
        <span className="material-symbols-outlined text-[#D4AF37] text-6xl">
          lock
        </span>
        <h1 className="text-2xl font-bold text-white">Telegram Only</h1>
        <p className="text-gray-400 text-sm">
          This app must be opened inside Telegram.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
```

**Step 2: Update layout.tsx to use TelegramGuard**

```tsx
// src/app/layout.tsx — update body to wrap with TelegramGuard
import TelegramGuard from '@/components/guards/TelegramGuard'

// ...inside body:
<body className="antialiased">
  <TelegramGuard>
    {children}
  </TelegramGuard>
</body>
```

**Step 3: Commit**

```bash
git add src/components/guards/TelegramGuard.tsx src/app/layout.tsx
git commit -m "feat: add TelegramGuard with dev bypass"
```

---

## Task 12: BottomNav Component

**Files:**
- Create: `src/components/BottomNav.tsx`

**Step 1: Write BottomNav.tsx**

```tsx
// src/components/BottomNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/constants'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 w-full bg-[#0A0E1A]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-3 px-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center pb-5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          if (item.isCenter) {
            return (
              <div key={item.href} className="relative -top-6">
                <Link href={item.href}>
                  <button className="w-14 h-14 bg-[#D4AF37] text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.8)] border-4 border-[#0A0E1A] transition transform active:scale-95">
                    <span className="material-symbols-outlined text-3xl animate-pulse">
                      sports_football
                    </span>
                  </button>
                </Link>
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center space-y-1 transition ${
                isActive ? 'text-[#D4AF37]' : 'text-gray-500 hover:text-[#D4AF37]'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-[10px] font-medium tracking-wide uppercase">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: add BottomNav with active state"
```

---

## Task 13: API Routes

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/stellar/balance/route.ts`
- Create: `src/app/api/stellar/transactions/route.ts`
- Create: `src/app/api/auth/wallet/route.ts`
- Create: `src/app/api/stats/funding/route.ts`

**Step 1: Health check**

```ts
// src/app/api/health/route.ts
import { ok } from '@/lib/api-response'
export async function GET() {
  return ok({ status: 'ok', timestamp: new Date().toISOString() })
}
```

**Step 2: Balance route**

```ts
// src/app/api/stellar/balance/route.ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { fetchCustomAssetBalance, fetchXlmBalance, isValidStellarAddress } from '@/lib/stellar'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return fail('Missing address', 'MISSING_ADDRESS')
  if (!isValidStellarAddress(address)) return fail('Invalid Stellar address', 'INVALID_ADDRESS')
  try {
    const [nsafl, xlm] = await Promise.all([
      fetchCustomAssetBalance(address),
      fetchXlmBalance(address),
    ])
    return ok({ nsafl, xlm, address })
  } catch (e: any) {
    return fail(e.message, 'STELLAR_ERROR', 500)
  }
}
```

**Step 3: Transactions route**

```ts
// src/app/api/stellar/transactions/route.ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { HORIZON_URL } from '@/lib/constants'
import { isValidStellarAddress } from '@/lib/stellar'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address || !isValidStellarAddress(address))
    return fail('Invalid address', 'INVALID_ADDRESS')

  try {
    const res = await fetch(
      `${HORIZON_URL}/accounts/${address}/payments?order=desc&limit=10`
    )
    const data = await res.json()
    return ok({ records: data._embedded?.records ?? [] })
  } catch (e: any) {
    return fail(e.message, 'STELLAR_ERROR', 500)
  }
}
```

**Step 4: Wallet auth route (save to Supabase)**

```ts
// src/app/api/auth/wallet/route.ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData } from '@/lib/telegram'
import { isValidStellarAddress } from '@/lib/stellar'

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  let telegramId: number
  if (isDev) {
    telegramId = 999999999 // dev user
  } else {
    const user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)
    if (!user) return fail('Invalid Telegram auth', 'INVALID_AUTH', 401)
    telegramId = user.id
  }

  const body = await req.json()
  const { stellarAddress } = body
  if (!stellarAddress || !isValidStellarAddress(stellarAddress))
    return fail('Invalid Stellar address', 'INVALID_ADDRESS')

  const supabase = createServiceClient()

  // Upsert user
  const { data: user } = await (supabase as any)
    .from('users')
    .upsert({ telegram_id: telegramId }, { onConflict: 'telegram_id' })
    .select('id')
    .single()

  if (!user) return fail('Failed to upsert user', 'DB_ERROR', 500)

  // Upsert wallet
  await (supabase as any)
    .from('wallets')
    .upsert(
      { user_id: user.id, stellar_address: stellarAddress },
      { onConflict: 'user_id' }
    )

  return ok({ telegramId, stellarAddress })
}
```

**Step 5: Stats funding route**

```ts
// src/app/api/stats/funding/route.ts
import { ok } from '@/lib/api-response'

export async function GET() {
  // Static data until Supabase funding_config is populated
  return ok({
    totalFunding: '2.4M',
    weeklyChange: '+12.5%',
    chartData: [30, 45, 60, 75, 100],
    target: '3M',
    regional: [
      { name: 'Swan Districts', pct: 45, color: 'bg-blue-500' },
      { name: 'South Fremantle', pct: 30, color: 'bg-red-500' },
      { name: 'Other Regions', pct: 25, color: 'bg-gray-500' },
    ],
    topSupporters: [
      { rank: 1, name: 'CryptoKing99', hub: 'Swan Districts Hub', amount: '150k' },
      { rank: 2, name: 'WAFL_Fanatic', hub: 'South Fremantle Hub', amount: '120k' },
      { rank: 3, name: 'FootyLegend', hub: 'East Perth Hub', amount: '95k' },
    ],
  })
}
```

**Step 6: Commit**

```bash
git add src/app/api/
git commit -m "feat: add API routes (health, balance, transactions, auth, stats)"
```

---

## Task 14: Home Page (Wallet Gate + Connect + Dashboard)

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/DashboardView.tsx`
- Create: `src/components/_dashboard/BalanceCard.tsx`

**Step 1: Write BalanceCard.tsx**

Matches `Dashboard connect wallet.html` (disconnected) and `Connected.html` + `Dashboard.html` (connected).

```tsx
// src/components/_dashboard/BalanceCard.tsx
'use client'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface Props {
  balance: string
  address: string
}

export default function BalanceCard({ balance, address }: Props) {
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`
  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-[#D4AF37]/30 shadow-[0_8px_32px_rgba(212,175,55,0.15)]">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl" />
      <div className="relative z-10">
        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
          Legacy Wallet
        </p>
        <div className="flex items-center space-x-2 bg-black/30 rounded-full px-3 py-1 border border-white/10 w-fit mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-300 font-mono">{short}</span>
        </div>
        <h2 className="text-4xl font-bold text-white mb-1">
          {balance}{' '}
          <span className="text-2xl text-[#D4AF37] font-sans font-semibold">
            {PRIMARY_CUSTOM_ASSET_LABEL}
          </span>
        </h2>
      </div>
    </div>
  )
}
```

**Step 2: Write DashboardView.tsx**

Matches `Dashboard.html` — quick stats grid + featured homecoming players section.

```tsx
// src/components/DashboardView.tsx
'use client'
import BalanceCard from './_dashboard/BalanceCard'
import BottomNav from './BottomNav'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface Props {
  address: string
  balance: string
}

const FEATURED_PLAYERS = [
  {
    name: 'J. Smith', position: 'Midfielder', club: 'Swan Districts',
    status: 'Signed', statusColor: 'green', borderColor: 'border-l-green-500',
    est: '25k', avatar: null,
  },
  {
    name: 'T. Kelly', position: 'Forward', club: 'South Fremantle',
    status: 'In Talks', statusColor: 'orange', borderColor: 'border-l-orange-500',
    est: '18k', avatar: null,
  },
]

export default function DashboardView({ address, balance }: Props) {
  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D4AF37]">sports_football</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">The Homecoming Hub</h1>
              <p className="text-xs text-[#D4AF37] font-medium">NSAFL Dashboard</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-white/10 transition relative">
            <span className="material-symbols-outlined text-white">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0A0E1A]" />
          </button>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8 pb-32">
        <BalanceCard balance={balance} address={address} />

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Quick Stats</h3>
            <button className="text-sm text-[#D4AF37] hover:text-white transition">View All</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center mb-3">
                <span className="text-blue-400 font-bold text-lg">WCE</span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">42</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Active Targets</p>
            </div>
            <div className="glass-card rounded-xl p-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center mb-3">
                <span className="text-purple-400 font-bold text-lg">FRE</span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">28</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide">In Negotiations</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Featured Homecoming</h3>
          </div>
          <div className="space-y-4">
            {FEATURED_PLAYERS.map((p) => (
              <div
                key={p.name}
                className={`glass-card p-4 rounded-xl flex items-center justify-between border-l-4 ${p.borderColor}`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-[#D4AF37]/50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#D4AF37]">person</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    <p className="text-xs text-gray-400">{p.position} • {p.club}</p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-${p.statusColor}-500/10 text-${p.statusColor}-400 border border-${p.statusColor}-500/20 uppercase`}>
                        {p.status}
                      </span>
                      <span className="text-[10px] text-gray-500">Est: {p.est} {PRIMARY_CUSTOM_ASSET_LABEL}</span>
                    </div>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition">
                  <span className="material-symbols-outlined text-[#D4AF37] text-sm">chevron_right</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
```

**Step 3: Write page.tsx (home — wallet gate)**

This page handles three states: (1) no wallet connected, (2) just connected (celebration), (3) connected & on dashboard.

```tsx
// src/app/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useWalletStore } from '@/hooks/useStore'
import DashboardView from '@/components/DashboardView'
import BottomNav from '@/components/BottomNav'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { isValidStellarAddress } from '@/lib/stellar'
import { getTelegramInitData } from '@/lib/telegram'

type Phase = 'gate' | 'connecting' | 'celebration' | 'dashboard'

export default function HomePage() {
  const { stellarAddress, nsaflBalance, isConnected, setWallet, setBalances } = useWalletStore()
  const [phase, setPhase] = useState<Phase>(isConnected ? 'dashboard' : 'gate')
  const [inputAddress, setInputAddress] = useState('')
  const [error, setError] = useState('')
  const [celebrationBalance, setCelebrationBalance] = useState('0.00')

  async function handleConnect() {
    const addr = inputAddress.trim()
    if (!isValidStellarAddress(addr)) {
      setError('Invalid Stellar address (must start with G and be 56 chars)')
      return
    }
    setError('')
    setPhase('connecting')
    try {
      // Save to Supabase
      await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTelegramInitData(),
        },
        body: JSON.stringify({ stellarAddress: addr }),
      })
      // Fetch balance
      const res = await fetch(`/api/stellar/balance?address=${addr}`)
      const json = await res.json()
      if (json.success) {
        setWallet(addr)
        setBalances(json.data.nsafl, json.data.xlm)
        setCelebrationBalance(json.data.nsafl)
      }
      setPhase('celebration')
    } catch {
      setError('Connection failed. Please try again.')
      setPhase('gate')
    }
  }

  if (phase === 'dashboard' || (phase === 'celebration' && isConnected)) {
    if (phase === 'celebration') {
      // Show celebration for 3s then go to dashboard
      setTimeout(() => setPhase('dashboard'), 3000)
      return <CelebrationScreen address={stellarAddress!} balance={celebrationBalance} onEnter={() => setPhase('dashboard')} />
    }
    return <DashboardView address={stellarAddress!} balance={nsaflBalance} />
  }

  if (phase === 'celebration') {
    return <CelebrationScreen address={inputAddress} balance={celebrationBalance} onEnter={() => setPhase('dashboard')} />
  }

  // Gate / connect screen
  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37]">sports_football</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">The Homecoming Hub</h1>
            <p className="text-xs text-[#D4AF37] font-medium">NSAFL Dashboard</p>
          </div>
        </div>
      </header>
      <main className="px-6 py-6 space-y-8 pb-32">
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-[#D4AF37]/30">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="w-full flex justify-between items-start mb-6">
              <p className="text-sm text-gray-400 font-medium tracking-wide uppercase">Legacy Wallet</p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                <span className="material-symbols-outlined text-[12px] mr-1">link_off</span>
                Disconnected
              </span>
            </div>
            <div className="mb-6 text-center">
              <span className="material-symbols-outlined text-6xl text-[#D4AF37]/50 mb-4 block">account_balance_wallet</span>
              <p className="text-sm text-gray-300 max-w-xs mx-auto">Connect your Stellar wallet to view your {PRIMARY_CUSTOM_ASSET_LABEL} balance.</p>
            </div>
            <input
              type="text"
              placeholder="G... (your Stellar address)"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 font-mono mb-3 focus:outline-none focus:border-[#D4AF37]/50"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              onClick={handleConnect}
              disabled={phase === 'connecting'}
              className="w-full bg-[#D4AF37] text-black font-semibold py-4 rounded-xl text-base transition hover:bg-[#D4AF37]/90 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px] mr-2">account_balance_wallet</span>
              {phase === 'connecting' ? 'Connecting...' : 'Connect Stellar Wallet'}
            </button>
          </div>
        </div>

        {/* Blurred preview sections */}
        <div className="opacity-60 pointer-events-none space-y-3">
          <h3 className="text-lg font-bold text-white">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <span className="material-symbols-outlined text-blue-400">stadium</span>
              </div>
              <p className="text-2xl font-bold text-white">-</p>
              <p className="text-xs text-gray-400">Clubs Supported</p>
            </div>
            <div className="glass-card rounded-xl p-5 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                <span className="material-symbols-outlined text-green-400">groups</span>
              </div>
              <p className="text-2xl font-bold text-white">-</p>
              <p className="text-xs text-gray-400">Players Funded</p>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}

function CelebrationScreen({
  address, balance, onEnter,
}: { address: string; balance: string; onEnter: () => void }) {
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`
  return (
    <main className="px-6 py-10 pb-32 flex flex-col items-center justify-center min-h-[100dvh] space-y-10">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-[#D4AF37]/30 rounded-full blur-3xl" />
        <div className="absolute inset-4 bg-[#D4AF37]/20 rounded-full blur-xl animate-pulse" />
        <div className="w-32 h-32 rounded-full border border-[#D4AF37]/50 bg-[#0A0E1A]/80 backdrop-blur-md flex items-center justify-center relative z-10 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
          <span className="material-symbols-outlined text-[72px] text-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,1)]">sports_football</span>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-[#0A0E1A] flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.6)]">
            <span className="material-symbols-outlined text-white text-[20px]">check</span>
          </div>
        </div>
      </div>
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-bold text-[#D4AF37] tracking-tight drop-shadow-md">Wallet Connected</h2>
        <p className="text-gray-400 text-sm max-w-[250px] mx-auto leading-relaxed">Your secure link to the Homecoming Hub has been established.</p>
      </div>
      <div className="w-full glass-card rounded-2xl p-6 border border-[#D4AF37]/40 bg-gradient-to-br from-white/10 to-transparent shadow-[0_8px_32px_rgba(212,175,55,0.2)]">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center px-3 py-1 mb-4 rounded-full text-[11px] font-semibold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 uppercase tracking-widest">
            <span className="material-symbols-outlined text-[14px] mr-1.5">workspace_premium</span>
            Legacy Wallet
          </span>
          <h3 className="text-4xl font-bold text-white mb-6">
            {balance} <span className="text-xl text-[#D4AF37]">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
          </h3>
          <div className="flex items-center space-x-3 bg-[#0A0E1A]/70 px-4 py-2.5 rounded-xl border border-white/10 w-full justify-center">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Stellar</span>
            <div className="w-px h-4 bg-white/20" />
            <span className="text-sm text-gray-200 font-mono">{short}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onEnter}
        className="w-full bg-[#D4AF37] text-[#0A0E1A] font-bold py-4 rounded-xl text-base hover:bg-[#D4AF37]/90 shadow-[0_0_20px_rgba(212,175,55,0.4)] uppercase tracking-wide flex items-center justify-center"
      >
        Enter Dashboard <span className="material-symbols-outlined ml-2 text-[20px]">arrow_forward</span>
      </button>
    </main>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/DashboardView.tsx src/components/_dashboard/BalanceCard.tsx
git commit -m "feat: add home page with wallet gate, celebration, and dashboard"
```

---

## Task 15: Stats Page

**Files:**
- Create: `src/app/stats/page.tsx`

**Step 1: Write stats/page.tsx**

Matches `Stats.html` exactly — funding chart, regional support bars, top supporters leaderboard.

```tsx
// src/app/stats/page.tsx
'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface StatsData {
  totalFunding: string
  weeklyChange: string
  chartData: number[]
  target: string
  regional: { name: string; pct: number; color: string }[]
  topSupporters: { rank: number; name: string; hub: string; amount: string }[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May']

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null)

  useEffect(() => {
    fetch('/api/stats/funding')
      .then((r) => r.json())
      .then((j) => j.success && setData(j.data))
  }, [])

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button onClick={() => history.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Movement Stats</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Global Homecoming Progress</p>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6 pb-32">
        {/* Funding card + bar chart */}
        {data && (
          <div className="glass-card p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Total Funding</h2>
                <div className="text-3xl font-bold text-white mt-1">
                  {data.totalFunding} <span className="text-[#D4AF37] text-xl">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-green-400 bg-green-500/10 px-2 py-1 rounded text-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                <span>{data.weeklyChange}</span>
              </div>
            </div>
            {/* Bar chart */}
            <div className="mt-4 flex items-end justify-between h-32 space-x-2">
              {data.chartData.map((pct, i) => (
                <div
                  key={i}
                  className={`w-1/6 rounded-t-sm relative group ${i === data.chartData.length - 1 ? 'bg-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]' : i === data.chartData.length - 2 ? 'bg-[#D4AF37]/60' : 'bg-white/10'}`}
                  style={{ height: `${pct}%` }}
                >
                  <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs ${i === data.chartData.length - 1 ? 'text-[#D4AF37] font-bold opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'} transition`}>
                    {MONTH_LABELS[i]}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 uppercase">
              <span>5 Months Trend</span>
              <span>Target: {data.target}</span>
            </div>
          </div>
        )}

        {/* Regional support */}
        {data && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Regional Support</h2>
            <div className="glass-card p-4 rounded-xl space-y-4">
              {data.regional.map((r) => (
                <div key={r.name} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${r.color}`} />
                      <span className="text-gray-300">{r.name}</span>
                    </div>
                    <span className="font-bold text-white">{r.pct}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className={`${r.color} h-2 rounded-full`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top supporters */}
        {data && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Top Supporters</h2>
              <a className="text-xs text-[#D4AF37] hover:underline" href="#">View All</a>
            </div>
            <div className="space-y-2">
              {data.topSupporters.map((s) => (
                <div key={s.rank} className="glass-card p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${s.rank === 1 ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30' : s.rank === 2 ? 'bg-white/10 text-gray-300 border-white/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                      {s.rank}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                      <p className="text-[10px] text-gray-400">{s.hub}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${s.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>{s.amount}</div>
                    <div className="text-[10px] text-gray-500">{PRIMARY_CUSTOM_ASSET_LABEL}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/stats/page.tsx
git commit -m "feat: add stats page with funding chart and leaderboard"
```

---

## Task 16: Rewards Page

**Files:**
- Create: `src/app/rewards/page.tsx`
- Create: `src/components/RewardsCard.tsx`

**Step 1: Write RewardsCard.tsx**

```tsx
// src/components/RewardsCard.tsx
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface Props {
  name: string
  description: string
  cost: string
  image?: string
  available: boolean
}

export default function RewardsCard({ name, description, cost, image, available }: Props) {
  return (
    <div className="glass-card rounded-xl p-4 flex gap-4">
      {image ? (
        <img src={image} alt={name} className="w-20 h-20 rounded-lg object-cover border border-[#D4AF37]/30" />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-white/5 border border-gray-500/30 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-gray-400">stadium</span>
        </div>
      )}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-white text-sm leading-tight">{name}</h4>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-sm font-semibold ${available ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
            {cost} {PRIMARY_CUSTOM_ASSET_LABEL}
          </span>
          <button
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              available
                ? 'bg-[#D4AF37] text-black hover:bg-yellow-400'
                : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
            }`}
          >
            Claim
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Write rewards/page.tsx**

Matches `Rewards.html` — tier progress bar + Legendary / Elite / Foundation sections.

```tsx
// src/app/rewards/page.tsx
'use client'
import BottomNav from '@/components/BottomNav'
import RewardsCard from '@/components/RewardsCard'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

const REWARDS = {
  legendary: [
    { name: 'Optus Stadium VIP Box', description: 'Exclusive 10-person suite for the Derby', cost: '500k', available: true },
    { name: 'Signed West Coast Eagles Guernsey', description: 'Authentic 2024 team signed kit', cost: '150k', available: true },
  ],
  elite: [
    { name: 'Premium Match Tickets', description: '2x Level 1 seating for selected games', cost: '50k', available: false },
  ],
  foundation: [
    { name: 'Fan Merchandise Pack', description: 'Cap, scarf, and exclusive pin', cost: '10k', available: false },
  ],
}

export default function RewardsPage() {
  const { nsaflBalance } = useWalletStore()
  const balance = parseFloat(nsaflBalance)
  const tier = getTierForBalance(balance)
  const nextTier = tier.id === 'tier-4' ? null : { label: 'Platinum', target: 2501 }

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button onClick={() => history.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Rewards Market</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Tiered Legacy</p>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8 pb-32">
        {/* Tier card */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-8xl text-[#D4AF37]">workspace_premium</span>
          </div>
          <div className="relative z-10">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Current Tier</p>
            <h2 className="text-2xl font-bold text-[#D4AF37] mb-4">{tier.label}</h2>
            {nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-300">{balance.toFixed(0)} {PRIMARY_CUSTOM_ASSET_LABEL}</span>
                  <span className="text-gray-400">Next: {nextTier.label}</span>
                </div>
                <div className="w-full bg-[#0A0E1A] rounded-full h-2.5 border border-white/10">
                  <div
                    className="bg-[#D4AF37] h-2.5 rounded-full"
                    style={{ width: `${Math.min(100, (balance / nextTier.target) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 text-right">
                  {nextTier.target} {PRIMARY_CUSTOM_ASSET_LABEL} to unlock {nextTier.label} tier rewards
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Legendary */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-[#D4AF37]">star</span>
            <h3 className="text-xl font-bold text-white">Legendary</h3>
          </div>
          <div className="space-y-4">
            {REWARDS.legendary.map((r) => <RewardsCard key={r.name} {...r} />)}
          </div>
        </section>

        {/* Elite */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-gray-300">verified</span>
            <h3 className="text-xl font-bold text-white">Elite</h3>
          </div>
          <div className="space-y-4">
            {REWARDS.elite.map((r) => <RewardsCard key={r.name} {...r} />)}
          </div>
        </section>

        {/* Foundation */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-orange-400">shield</span>
            <h3 className="text-xl font-bold text-white">Foundation</h3>
          </div>
          <div className="space-y-4">
            {REWARDS.foundation.map((r) => <RewardsCard key={r.name} {...r} />)}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/rewards/page.tsx src/components/RewardsCard.tsx
git commit -m "feat: add rewards page with tier progress and market"
```

---

## Task 17: Profile Page

**Files:**
- Create: `src/app/profile/page.tsx`

**Step 1: Write profile/page.tsx**

Matches `Profile.html` — wallet balance, address with copy, transaction history.

```tsx
// src/app/profile/page.tsx
'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { useWalletStore } from '@/hooks/useStore'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { getTelegramInitData } from '@/lib/telegram'

interface Transaction {
  type: string
  label: string
  amount: string
  date: string
  color: string
  icon: string
}

export default function ProfilePage() {
  const { stellarAddress, nsaflBalance, disconnect } = useWalletStore()
  const [copied, setCopied] = useState(false)
  const [txns, setTxns] = useState<Transaction[]>([])

  useEffect(() => {
    if (!stellarAddress) return
    fetch(`/api/stellar/transactions?address=${stellarAddress}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.records.length > 0) {
          // Map raw Horizon records to display format
          const mapped = j.data.records.slice(0, 5).map((r: any) => ({
            type: r.type,
            label: r.type === 'payment' ? (r.to === stellarAddress ? 'Deposit' : 'Send') : r.type,
            amount: `${r.amount ?? '?'} ${r.asset_code ?? 'XLM'}`,
            date: new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
            color: r.to === stellarAddress ? 'text-green-400' : 'text-white',
            icon: r.to === stellarAddress ? 'south_west' : 'north_east',
          }))
          setTxns(mapped)
        }
      })
  }, [stellarAddress])

  function copyAddress() {
    if (!stellarAddress) return
    navigator.clipboard.writeText(stellarAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const short = stellarAddress ? `${stellarAddress.slice(0, 4)}...${stellarAddress.slice(-4)}` : 'Not connected'

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button onClick={() => history.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Wallet Profile</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Stellar Network</p>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6 pb-32">
        <div className="glass-card p-6 rounded-2xl flex flex-col items-center space-y-4 border-t-2 border-t-[#D4AF37]/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D4AF37]/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center border border-[#D4AF37]/30 z-10">
            <span className="material-symbols-outlined text-3xl text-[#D4AF37]">account_balance_wallet</span>
          </div>
          <div className="text-center z-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {nsaflBalance} <span className="text-xl text-[#D4AF37]">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1">Available Balance</p>
          </div>
          {stellarAddress && (
            <div className="flex items-center space-x-2 bg-black/30 px-4 py-2 rounded-lg border border-white/5 z-10">
              <span className="text-xs font-mono text-gray-300">{short}</span>
              <button onClick={copyAddress} className="text-gray-400 hover:text-[#D4AF37] transition">
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Transaction History</h3>
            <button className="text-xs text-[#D4AF37] font-medium hover:underline">View All</button>
          </div>

          {txns.length === 0 ? (
            <div className="glass-card p-4 rounded-xl text-center text-gray-400 text-sm">
              No transactions found
            </div>
          ) : (
            txns.map((tx, i) => (
              <div key={i} className="glass-card p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${tx.color === 'text-green-400' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <span className={`material-symbols-outlined text-sm ${tx.color}`}>{tx.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{tx.label}</h4>
                    <p className="text-[10px] text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.color}`}>{tx.amount}</p>
                  <p className="text-[10px] text-gray-500 font-mono">Completed</p>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={disconnect}
          className="w-full glass-card border border-white/10 rounded-xl py-4 flex items-center justify-center space-x-2 hover:bg-white/5 transition text-white"
        >
          <span className="material-symbols-outlined text-gray-400 text-sm">link_off</span>
          <span className="text-sm font-semibold">Disconnect Wallet</span>
        </button>
      </main>
      <BottomNav />
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: add profile page with wallet balance and transaction history"
```

---

## Task 18: Clubs Page (AFL Fixtures)

**Files:**
- Create: `src/app/clubs/page.tsx`

**Step 1: Write clubs/page.tsx**

Displays Round 1 AFL fixtures grouped by date, with scores, winner, venue, and country.

```tsx
// src/app/clubs/page.tsx
'use client'
import BottomNav from '@/components/BottomNav'
import { ROUND_1_FIXTURES } from '@/config/afl'

// Group fixtures by date
function groupByDate(fixtures: typeof ROUND_1_FIXTURES) {
  return fixtures.reduce((acc, f) => {
    if (!acc[f.date]) acc[f.date] = []
    acc[f.date].push(f)
    return acc
  }, {} as Record<string, typeof ROUND_1_FIXTURES>)
}

function ScoreBox({ score, isWinner }: { score: number | null; isWinner: boolean }) {
  return (
    <span className={`text-3xl font-bold ${isWinner ? 'text-white' : 'text-gray-500'}`}>
      {score ?? '-'}
    </span>
  )
}

export default function ClubsPage() {
  const grouped = groupByDate(ROUND_1_FIXTURES)

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37]">stadium</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AFL Fixtures</h1>
            <p className="text-xs text-[#D4AF37] font-medium">Round 1 — 2025</p>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8 pb-32">
        {Object.entries(grouped).map(([date, fixtures]) => (
          <section key={date}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">{date}</h2>
            <div className="space-y-3">
              {fixtures.map((f) => {
                const homeWins = (f.homeScore ?? 0) > (f.awayScore ?? 0)
                const awayWins = (f.awayScore ?? 0) > (f.homeScore ?? 0)
                return (
                  <div key={f.id} className="glass-card rounded-xl p-4 space-y-3">
                    {/* Status badge */}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                        {f.status}
                      </span>
                      <span className="text-[10px] text-gray-500">{f.venue}</span>
                    </div>

                    {/* Score row */}
                    <div className="flex items-center justify-between">
                      {/* Home team */}
                      <div className="flex-1 text-left">
                        <p className={`font-bold text-sm leading-tight ${homeWins ? 'text-white' : 'text-gray-400'}`}>
                          {f.homeTeam}
                        </p>
                      </div>
                      {/* Scores */}
                      <div className="flex items-center space-x-4 mx-4">
                        <ScoreBox score={f.homeScore} isWinner={homeWins} />
                        <span className="text-gray-600 text-sm font-mono">vs</span>
                        <ScoreBox score={f.awayScore} isWinner={awayWins} />
                      </div>
                      {/* Away team */}
                      <div className="flex-1 text-right">
                        <p className={`font-bold text-sm leading-tight ${awayWins ? 'text-white' : 'text-gray-400'}`}>
                          {f.awayTeam}
                        </p>
                      </div>
                    </div>

                    {/* Winner + venue */}
                    {f.winner && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <p className="text-xs text-[#D4AF37] font-medium">{f.winner}</p>
                        <p className="text-[10px] text-gray-500">{f.country}</p>
                      </div>
                    )}

                    {/* Match report link */}
                    <a
                      href={f.matchReportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-xs text-[#D4AF37] hover:underline"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      <span>Match Report</span>
                    </a>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>
      <BottomNav />
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/clubs/page.tsx
git commit -m "feat: add clubs page with AFL Round 1 fixtures"
```

---

## Task 19: TypeScript Check & Final Cleanup

**Files:** All source files

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any errors — common issues:
- `'use client'` missing on components that use hooks
- Missing return types
- `(supabase as any)` for untyped tables

**Step 2: Add .gitignore**

```
.env.local
node_modules/
.next/
```

**Step 3: Final commit**

```bash
git add .
git commit -m "fix: TypeScript cleanup and .gitignore"
```

---

## Task 20: Deploy to Vercel

**Files:** None — deploy action

**Step 1: Set up Vercel project**

```bash
npx vercel link
```

**Step 2: Add environment variables in Vercel dashboard**

Add all values from `.env.local` except `NEXT_PUBLIC_DEV_BYPASS` (leave as `false` in prod).

**Step 3: Deploy**

```bash
npx vercel --prod
```

**Step 4: Test in Telegram**

1. Set your bot's Mini App URL to the Vercel domain in BotFather
2. Open the app inside Telegram
3. Verify `TelegramGuard` allows access
4. Connect a test Stellar address
5. Verify balance loads from Horizon API

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Scaffold Next.js 16 + deps |
| 2 | Tailwind v4 globals.css + layout |
| 3 | Env vars + constants |
| 4 | Supabase clients |
| 5 | Stellar Horizon helpers |
| 6 | Telegram auth helpers |
| 7 | API response helpers |
| 8 | Tier config |
| 9 | AFL clubs + Round 1 fixtures |
| 10 | Zustand wallet store |
| 11 | TelegramGuard component |
| 12 | BottomNav component |
| 13 | API routes (5 routes) |
| 14 | Home page (gate + celebration + dashboard) |
| 15 | Stats page |
| 16 | Rewards page |
| 17 | Profile page |
| 18 | Clubs/fixtures page |
| 19 | TypeScript check + cleanup |
| 20 | Vercel deploy |
