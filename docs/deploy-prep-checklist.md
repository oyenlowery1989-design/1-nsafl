# Deploy Preparation Checklist

Step-by-step guide to swap all placeholder values for real production values before going live.

---

## 1. Environment Variables

Edit `telegram-app/.env.local` and update these values:

| Variable | Current (dev) | Action |
|---|---|---|
| `NEXT_PUBLIC_PRIMARY_ASSET_CODE` | `CRYPTOBANK` | Change to real token ticker |
| `NEXT_PUBLIC_PRIMARY_ASSET_ISSUER` | `GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z` | Change to real issuer address |
| `NEXT_PUBLIC_SHOWN_ASSETS` | `CRYPTOBANK,XLM` | Change to match real token ticker |
| `NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS` | (your XLM address) | Confirm this is the correct receiving wallet |
| `NEXT_PUBLIC_DEV_BYPASS` | `true` | **Set to `false`** for production |
| `ADMIN_SECRET_TOKEN` | (your secret) | Confirm this is set and strong |
| `TELEGRAM_BOT_TOKEN` | `8719214894:...` | Confirm this is the production bot token |

Also copy all these into Vercel → Project → Settings → Environment Variables. See Section 5.

---

## 2. Code Fixes (Required Before Deploy)

### 2a. Fix buy page hardcoded URLs

**File:** `telegram-app/app/buy/page.tsx` lines ~20–24

The LOBSTR and SCOPULY links have the asset code and issuer baked in as string literals. Replace with constants:

```ts
// BEFORE (hardcoded):
const LOBSTR_URL = `https://lobstr.co/trade/CRYPTOBANK:GAWZC.../XLM`
const SCOPULY_URL = `https://scopuly.com/trade/CRYPTOBANK-XLM-GAWZC...`

// AFTER (use env-driven constants):
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER } from '@/lib/constants'
const LOBSTR_URL = `https://lobstr.co/trade/${PRIMARY_CUSTOM_ASSET_CODE}:${PRIMARY_CUSTOM_ASSET_ISSUER}/XLM`
const SCOPULY_URL = `https://scopuly.com/trade/${PRIMARY_CUSTOM_ASSET_CODE}-XLM-${PRIMARY_CUSTOM_ASSET_ISSUER}`
```

### 2b. Fix hardcoded dashboard title

**File:** `telegram-app/app/page.tsx` line ~156

```ts
// BEFORE:
'NSAFL Dashboard'

// AFTER:
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
`${PRIMARY_CUSTOM_ASSET_LABEL} Dashboard`
```

### 2c. Remove duplicate constant definitions

**File:** `telegram-app/app/api/stats/funding/route.ts`

This file defines `ASSET_CODE`, `ASSET_ISSUER`, `HORIZON_URL` locally. Replace with imports:

```ts
// REMOVE these local definitions, then:
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER, HORIZON_URL } from '@/lib/constants'
```

### 2d. Rename `nsaflBalance` in Zustand store (optional but recommended)

**File:** `telegram-app/hooks/useStore.ts`

The field `nsaflBalance` is a legacy name from the old token. If you want a clean rename:
- Rename `nsaflBalance` → `tokenBalance` (or keep as-is — it works either way, just ugly)
- If renamed: update every reference (`app/page.tsx`, `components/DashboardView.tsx`, `components/_dashboard/BalanceCard.tsx`, any other component that reads `nsaflBalance`)
- The Zustand `persist` key is `'homecoming-hub-wallet'` — if you rename the field, existing users will lose their cached balance (they'll just re-fetch on next open, no data loss)

### 2e. Review XLM → token exchange rate

**File:** `telegram-app/app/api/buy/direct/route.ts` line ~14

```ts
const XLM_TO_CRYPTOBANK_RATE = 100  // hardcoded
```

Update this to the real rate, or replace with a live Horizon price fetch if you want it dynamic.

---

## 3. Tiers — Update with Real Values

**File:** `telegram-app/config/tiers.ts`

The current tiers are placeholders (Pre-Tier 0–99, T1 100+, up to T12 400001+). Update each tier's `minBalance` and `maxBalance` with your real tokenomics. All other code reads from this file — no other changes needed.

```ts
export const TIERS: Tier[] = [
  { id: 'pre-tier', label: 'Pre-Tier', minBalance: 0,      maxBalance: 99,     ... },
  { id: 'tier-1',   label: 'Tier 1',   minBalance: 100,    maxBalance: 500,    ... },
  // ... update these numbers
]
```

---

## 4. Verify Everything Uses Variables (Audit Results)

The codebase audit found the following status:

| Item | Status | File |
|---|---|---|
| Asset code in UI | ✅ Via `PRIMARY_CUSTOM_ASSET_CODE` from `lib/constants.ts` | All components |
| Asset issuer in UI | ✅ Via `PRIMARY_CUSTOM_ASSET_ISSUER` | All components |
| Horizon URL | ✅ Via `NEXT_PUBLIC_HORIZON_URL` env var | `lib/constants.ts` |
| Supabase URL/keys | ✅ Via env vars | `lib/supabase.ts`, `lib/supabase-server.ts` |
| Bot token | ✅ Via `TELEGRAM_BOT_TOKEN` env var | `app/api/auth/session/route.ts` |
| Admin secret | ✅ Via `ADMIN_SECRET_TOKEN` env var | `app/api/admin/route.ts` |
| Direct buy XLM address | ✅ Via `NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS` env var | `app/buy/page.tsx` |
| Buy page DEX URLs | ❌ Hardcoded strings | `app/buy/page.tsx` — fix in 2a |
| Dashboard title | ❌ Hardcoded 'NSAFL Dashboard' | `app/page.tsx` — fix in 2b |
| Funding route constants | ❌ Locally redefined | `app/api/stats/funding/route.ts` — fix in 2c |
| Zustand field name | ⚠️ Legacy `nsaflBalance` name | `hooks/useStore.ts` — optional, fix in 2d |
| Buy rate | ⚠️ Hardcoded `100` | `app/api/buy/direct/route.ts` — fix in 2e |
| Tiers | ⚠️ Placeholder values | `config/tiers.ts` — update in step 3 |

---

## 5. Vercel Environment Variables

In Vercel dashboard → your project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
ADMIN_SECRET_TOKEN
NEXT_PUBLIC_PRIMARY_ASSET_CODE
NEXT_PUBLIC_PRIMARY_ASSET_ISSUER
NEXT_PUBLIC_SHOWN_ASSETS
NEXT_PUBLIC_DEV_BYPASS          ← set to false
NEXT_PUBLIC_HORIZON_URL         ← https://horizon.stellar.org
NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS
IPINFO_TOKEN                    ← optional, increases geo lookup limit from 50k/mo
```

Set all variables for **Production** environment (and optionally Preview).

---

## 6. Telegram Bot Webhook

After deploy, point your bot to the Vercel URL:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-vercel-domain>/api/telegram
```

Also update the Mini App URL in BotFather:
1. `/mybots` → your bot → Bot Settings → Menu Button → Edit the URL → set to your Vercel domain

---

## 7. Post-Deploy Verification

After going live, confirm:

- [ ] App opens inside Telegram (not browser)
- [ ] Block screen shows for direct browser access
- [ ] Connect wallet flow works end-to-end
- [ ] Balance displays correct token name and amount
- [ ] Admin page loads at `/admin?token=<ADMIN_SECRET_TOKEN>`
- [ ] Geo location resolves for new access attempts
- [ ] Block and delete user actions work
- [ ] `NEXT_PUBLIC_DEV_BYPASS` is `false` (check: direct browser access should show block screen)
- [ ] No TypeScript errors: `cd telegram-app && npx tsc --noEmit`

---

## Order of Operations

1. Make code fixes (2a, 2b, 2c — required; 2d, 2e — recommended)
2. Update tiers (step 3)
3. Update `.env.local` with real values
4. Run `npx tsc --noEmit` — must show 0 errors
5. Run `npm run build` locally to verify build passes
6. Sync env vars to Vercel (step 5)
7. Deploy: run `/vercel:deploy` or `vercel --prod`
8. Set Telegram webhook (step 6)
9. Run post-deploy verification (step 7)
