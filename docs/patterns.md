# Code Patterns & Conventions

> Quick reference for recurring code patterns in this project.

---

## API Routes

All routes follow this exact structure:

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'
  const initData = req.headers.get('x-telegram-init-data') ?? ''

  // Skip auth in dev
  if (!isDev && !validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN!)) {
    return fail('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    const data = await doSomething()
    return ok(data)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error', 'ERROR_CODE', 500)
  }
}
```

### Response shape
```ts
// Success
{ success: true, data: T }

// Failure
{ success: false, error: string, code: string }
```

### Client-side fetch with initData header
```ts
import { getTelegramInitData } from '@/lib/telegram'

const res = await fetch('/api/some/route', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-init-data': getTelegramInitData(),
  },
  body: JSON.stringify(payload),
})
const json = await res.json()
if (!json.success) throw new Error(json.error)
```

---

## Zustand Store

```ts
import { useWalletStore } from '@/hooks/useStore'

// Reading state (selector — always use this pattern)
const stellarAddress = useWalletStore((s) => s.stellarAddress)
const { nsaflBalance, xlmBalance, isConnected } = useWalletStore()

// Actions
const { setWallet, setBalances, disconnect } = useWalletStore()

// Important field names
stellarAddress  // NOT "address"
nsaflBalance    // NOT "cryptobankBalance"
xlmBalance
isConnected
telegramUserId
```

Store persists to localStorage under key `'homecoming-hub-wallet'`.

---

## Stellar Horizon

```ts
import { fetchAllShownBalances, isValidStellarAddress } from '@/lib/stellar'
import { SHOWN_ASSET_CONFIGS } from '@/lib/constants'

// Validate address before any API call
if (!isValidStellarAddress(addr)) { /* error */ }

// Fetch all shown asset balances in one call
const balances = await fetchAllShownBalances(address)
// returns: { 'XLM': '10.00', 'CRYPTOBANK': '500.00', ... }

// Asset configs from env
SHOWN_ASSET_CONFIGS  // [{ code, issuer, label }]
// XLM has issuer: null; custom assets have issuer string
```

### Transactions with pagination
```ts
// First page
const res = await fetch(`/api/stellar/transactions?address=${addr}&limit=15`)
const { records, nextCursor, hasMore } = (await res.json()).data

// Next page
const res2 = await fetch(`/api/stellar/transactions?address=${addr}&limit=15&cursor=${nextCursor}`)
```

---

## Asset Config Format

`.env.local`:
```
# Format: XLM (native) or CODE:ISSUER (custom)
NEXT_PUBLIC_SHOWN_ASSETS=XLM,CRYPTOBANK:GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z,TOKEN2:ISSUER2
```

---

## Supabase Server Client

```ts
import { createServiceClient } from '@/lib/supabase-server'

// In API routes — bypasses RLS
const supabase = createServiceClient()

// For new tables without types:
await (supabase as any).from('funding_config').select('*')
await (supabase as any).from('afl_bets').insert({ ... })
```

---

## TelegramGuard Dev Bypass

```ts
// Pattern used everywhere:
const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

if (isDev) {
  // skip auth check / return mock data
}
```

**Never set `NEXT_PUBLIC_DEV_BYPASS=true` in production.**

---

## Tailwind v4 Custom Values

```css
/* globals.css — NOT tailwind.config.js */
@theme {
  --color-primary: #D4AF37;
  --color-background-dark: #0A0E1A;
  --font-sans: 'Inter', sans-serif;
  --font-serif: 'Playfair Display', serif;
}
```

Use in JSX:
```tsx
className="text-primary"          // --color-primary
className="bg-background-dark"    // --color-background-dark
className="font-serif"            // Playfair Display
```

---

## Loading / Empty States

### Spinning football loader
```tsx
<div className="flex items-center justify-center p-8">
  <span
    className="material-symbols-outlined text-[#D4AF37] text-3xl"
    style={{ animation: 'spin 2s linear infinite' }}
  >
    sports_football
  </span>
</div>
```

### Empty state
```tsx
<div className="glass-card p-6 rounded-xl text-center space-y-2">
  <span className="material-symbols-outlined text-gray-500 text-3xl">receipt_long</span>
  <p className="text-gray-400 text-sm">No items found</p>
</div>
```

---

## Navigation

```ts
import { useRouter } from 'next/navigation'
const router = useRouter()

router.push('/profile')  // navigate to page
router.back()            // go back (NOT history.back())
```

---

## Phase Status

| Phase | Status |
|-------|--------|
| 1 — Foundation & Telegram Guard | ✅ Done |
| 2 — Wallet Connection + Supabase | ✅ Done |
| 3 — Core Screens (5 pages) | ✅ Done |
| 4 — Live Data & Realtime | 🔲 Partial (balance API done, Realtime subscription pending) |
| 5 — Polish & Deploy | 🔲 Next |

### Phase 4 remaining work
- Supabase Realtime subscription on `wallet_balances` table (subscribe in `DashboardView` or `useRealtimeBalance` hook)
- Edge Function to cron-sync Stellar → DB every 5 min
- Weekly balance change calculation (+X this week display)

### Phase 5 remaining work
- Vercel deployment
- Telegram bot webhook
- Loading skeletons on data-fetched sections
- Error boundaries for network failures
- Final QA on real device
