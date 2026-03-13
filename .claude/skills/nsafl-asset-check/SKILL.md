---
name: nsafl-asset-check
description: "Scan the NSAFL codebase for stale asset name hardcoding (CRYPTOBANK, NYSEAU, cryptobank, nyseau) and enforce the PRIMARY_CUSTOM_ASSET_CODE variable pattern. Run before every PR or after adding new features that display token names."
---

# NSAFL Asset Name Enforcement Check

This is a **rigid** skill. Follow every step exactly.

## Why This Matters

Hardcoding old asset names (`CRYPTOBANK`, `NYSEAU`) has caused production bugs before:
- Leaderboard returned 500 errors because `fetchHorizonHolders()` used a module-level constant that resolved to `'NYSEAU'` instead of reading `process.env` at runtime.
- Top Holders showed wrong balances (516 instead of live data) for the same reason.

## Step 1 — Scan for Forbidden Strings

Use Grep to search the entire `telegram-app/` directory for these patterns in `.ts` and `.tsx` files:

```
Patterns to find (case-insensitive):
- CRYPTOBANK
- NYSEAU
- nyseau
- cryptobank
- CryptoBank
```

Search paths: `telegram-app/app/`, `telegram-app/components/`, `telegram-app/lib/`, `telegram-app/config/`, `telegram-app/hooks/`

File types: `*.ts`, `*.tsx`

## Step 2 — Evaluate Each Match

For each match found, determine if it is:

**A) A hardcoded string used in UI, API logic, or env fallback** → MUST FIX
- Examples: `?? 'CRYPTOBANK'`, `asset_code === 'NYSEAU'`, `<span>CRYPTOBANK</span>`

**B) A comment explaining what NOT to do** → OK to leave (e.g. `// NOT cryptobankBalance`)

**C) Inside a doc file (`.md`)** → Not your concern here; skip

## Step 3 — Apply the Correct Pattern

**In UI components (`.tsx`):**
```tsx
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
// Use: {PRIMARY_CUSTOM_ASSET_LABEL}  →  renders as "$NSAFL"
```

**In API routes / server code (`.ts`):**
```ts
const assetCode = process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'
// Read INSIDE the function body, NOT at module level
```

**Zustand store balance field:**
```ts
// CORRECT:
const tokenBalance = useWalletStore((s) => s.tokenBalance)
// WRONG: nsaflBalance, cryptobankBalance, balance
```

## Step 4 — Report Results

Output a table:

| File | Line | Found | Severity | Fix Applied |
|------|------|-------|----------|-------------|
| ... | ... | ... | HIGH/OK | ... |

If zero HIGH severity issues found: ✅ Asset naming is clean.
If any HIGH severity issues found: List exact fixes made or needed.

## Step 5 — Check `lib/constants.ts`

Verify `PRIMARY_CUSTOM_ASSET_CODE` is defined as:
```ts
export const PRIMARY_CUSTOM_ASSET_CODE =
  process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'
```
The fallback MUST be `'NSAFL'` — not any other name.
