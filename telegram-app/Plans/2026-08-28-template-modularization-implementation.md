# Modular Telegram App Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Telegram Mini App rebrandable and composable through typed, source-controlled configuration while retaining its existing core flows.

**Architecture:** Add one typed app configuration that composes brand identity, theme, optional modules, and navigation. Move primary wrapped-asset/prize definitions to shared configuration, then use the feature flags at UI and API boundaries. Preserve current NSAFL behavior by making all existing modules enabled in the default configuration.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zustand, Vitest.

**Spec:** `telegram-app/Plans/2026-08-28-template-modularization-design.md`

## Global Constraints

- Work only inside `telegram-app/`.
- Preserve Telegram, Stellar, Supabase, profile, notifications, and admin foundations.
- Use `PRIMARY_CUSTOM_ASSET_CODE` / `PRIMARY_CUSTOM_ASSET_LABEL`; never add a hardcoded token name.
- Preserve the NSAFL default app behavior and existing URLs when the corresponding module is enabled.
- Disabled optional pages redirect to `/`; disabled server endpoints return a consistent `FEATURE_DISABLED` response before database or Stellar work.
- Do not add dependencies.
- Run `npx tsc --noEmit`, `npm run lint`, and `npm test` from `telegram-app/` after every completed task.

---

### Task 1: Define typed application and feature configuration

**Files:**
- Create: `telegram-app/config/app.ts`
- Modify: `telegram-app/config/branding.ts`
- Modify: `telegram-app/lib/constants.ts`
- Create: `telegram-app/__tests__/app-config.test.ts`

**Interfaces:**
- Produces `APP_CONFIG`, containing `brand`, `features`, and `navigation`.
- Produces `AppFeature = 'sports' | 'games' | 'quiz' | 'rewards' | 'donations' | 'leaderboard'`.
- Produces `isFeatureEnabled(feature: AppFeature): boolean` and `getNavigationItems(features?)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { APP_CONFIG, getNavigationItems, isFeatureEnabled } from '@/config/app'

describe('template configuration', () => {
  it('keeps every NSAFL module enabled by default', () => {
    expect(isFeatureEnabled('sports')).toBe(true)
    expect(isFeatureEnabled('games')).toBe(true)
    expect(isFeatureEnabled('rewards')).toBe(true)
  })

  it('only returns navigation entries for enabled features', () => {
    const items = getNavigationItems({ ...APP_CONFIG.features, sports: false })
    expect(items.some((item) => item.href === '/clubs')).toBe(false)
    expect(items.some((item) => item.href === '/')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/app-config.test.ts`

Expected: FAIL because `@/config/app` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type AppFeature = 'sports' | 'games' | 'quiz' | 'rewards' | 'donations' | 'leaderboard'

export const APP_CONFIG = {
  brand: BRANDING,
  features: { sports: true, games: true, quiz: true, rewards: true, donations: true, leaderboard: true },
  navigation: [
    { href: '/stats', label: 'Stats', icon: 'query_stats', feature: 'sports' },
    { href: '/clubs', label: 'Clubs', icon: 'stadium', feature: 'sports' },
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/rewards', label: 'Rewards', icon: 'redeem', feature: 'rewards' },
    { href: '/profile', label: 'Profile', icon: 'person' },
  ],
} as const

export function isFeatureEnabled(feature: AppFeature) { return APP_CONFIG.features[feature] }
export function getNavigationItems(features = APP_CONFIG.features) { return APP_CONFIG.navigation.filter((item) => !item.feature || features[item.feature]) }
```

Move the existing `NAV_ITEMS` consumer to the configuration helper; retain `BRANDING` as the source of brand copy and replace its per-clone comment with the actual configuration file list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/app-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add config/app.ts config/branding.ts lib/constants.ts __tests__/app-config.test.ts
git commit -m "refactor: add template feature config"
```

### Task 2: Make assets and game prizes brand-derived

**Files:**
- Modify: `telegram-app/lib/rewardAssets.ts`
- Modify: `telegram-app/lib/gamePool.ts`
- Modify: `telegram-app/components/SlotMachine.tsx`
- Modify: `telegram-app/components/ScratchCard.tsx`
- Modify: `telegram-app/app/game/page.tsx`
- Modify: `telegram-app/app/api/quiz/complete/route.ts`
- Modify: `telegram-app/__tests__/rewardAssets.test.ts`
- Modify: `telegram-app/__tests__/gamePrizeAlignment.test.ts`

**Interfaces:**
- Produces `WRAPPED_PRIMARY_ASSET_CODE = \`w${PRIMARY_CUSTOM_ASSET_CODE}\``.
- Produces one shared prize definition for Lucky Draw, Slot Machine, Scratch Card, and quiz token prizes.
- Existing `prizeToAsset(prizeLabel)` continues to resolve stored prize labels.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest'
import { WRAPPED_PRIMARY_ASSET_CODE, REWARD_ASSETS } from '@/lib/rewardAssets'

it('derives the wrapped primary reward asset from the primary asset code', () => {
  expect(WRAPPED_PRIMARY_ASSET_CODE).toBe(`w${process.env.NEXT_PUBLIC_PRIMARY_ASSET_CODE ?? 'NSAFL'}`)
  expect(REWARD_ASSETS.some((asset) => asset.code === WRAPPED_PRIMARY_ASSET_CODE)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/rewardAssets.test.ts`

Expected: FAIL because `WRAPPED_PRIMARY_ASSET_CODE` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Export the wrapped primary code and build the wrapped-primary `RewardAsset` from it. Replace `isWNSAFL`, `wNSAFL`, and fixed wrapped-primary labels in the listed UI/game files with generic `isPrimaryAsset` metadata and values derived from the shared definition. Keep fixed non-primary reward assets (for example `wXLM`) configured in `REWARD_ASSETS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/rewardAssets.test.ts __tests__/gamePrizeAlignment.test.ts`

Expected: PASS with no `wNSAFL` literal remaining outside tests or the default primary asset fallback.

- [ ] **Step 5: Commit**

```bash
git add lib/rewardAssets.ts lib/gamePool.ts components/SlotMachine.tsx components/ScratchCard.tsx app/game/page.tsx app/api/quiz/complete/route.ts __tests__/rewardAssets.test.ts __tests__/gamePrizeAlignment.test.ts
git commit -m "refactor: derive primary game rewards"
```

### Task 3: Apply the configured visual theme

**Files:**
- Modify: `telegram-app/app/layout.tsx`
- Modify: `telegram-app/app/globals.css`
- Create: `telegram-app/__tests__/theme-config.test.ts`

**Interfaces:**
- `RootLayout` sets `--brand-primary` and `--brand-background` from `BRANDING.colors` on `<body>`.
- CSS maps `--color-primary` and `--color-background-dark` to those variables.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('uses brand CSS variables for the semantic Tailwind colors', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')
  expect(css).toContain('--color-primary: var(--brand-primary)')
  expect(css).toContain('--color-background-dark: var(--brand-background)')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/theme-config.test.ts`

Expected: FAIL because `globals.css` still contains fixed gold and navy values.

- [ ] **Step 3: Write the minimal implementation**

Set the two CSS variables in `RootLayout` and change the Tailwind theme/body background declarations in `globals.css` to use them. Update the loader’s border color to derive from the configured primary color instead of a fixed gold RGBA value. Do not change existing component class names or add a theme library.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/theme-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css __tests__/theme-config.test.ts
git commit -m "refactor: apply configurable theme colors"
```

### Task 4: Gate optional UI modules and navigation

**Files:**
- Modify: `telegram-app/components/BottomNav.tsx`
- Modify: `telegram-app/app/page.tsx`
- Modify: `telegram-app/app/clubs/page.tsx`
- Modify: `telegram-app/app/donate/page.tsx`
- Modify: `telegram-app/app/stats/page.tsx`
- Modify: `telegram-app/app/game/page.tsx`
- Modify: `telegram-app/app/rewards/page.tsx`
- Modify: `telegram-app/components/TeamSelectScreen.tsx`
- Create: `telegram-app/components/FeatureRedirect.tsx`

**Interfaces:**
- `FeatureRedirect({ feature, children })` renders `children` only when `isFeatureEnabled(feature)` is true; otherwise redirects to `/`.
- `BottomNav` consumes `getNavigationItems()` rather than a fixed list.

- [ ] **Step 1: Write the minimal implementation**

Use the tested `getNavigationItems()` helper from Task 1 in `BottomNav`. Wrap sports-only pages and the game/rewards pages with `FeatureRedirect`; gate team selection in the home flow with `features.sports`. Keep profile, wallet, notifications, and admin UI available.

- [ ] **Step 2: Run focused verification**

Run: `npm test -- __tests__/app-config.test.ts && npx tsc --noEmit`

Expected: PASS; navigation filtering remains tested and UI module boundaries type-check.

- [ ] **Step 3: Commit**

```bash
git add components/BottomNav.tsx components/FeatureRedirect.tsx app/page.tsx app/clubs/page.tsx app/donate/page.tsx app/stats/page.tsx app/game/page.tsx app/rewards/page.tsx components/TeamSelectScreen.tsx
git commit -m "feat: gate optional app modules"
```

### Task 5: Gate optional server routes before side effects

**Files:**
- Create: `telegram-app/lib/feature-gate.ts`
- Modify: `telegram-app/app/api/game/route.ts`
- Modify: `telegram-app/app/api/game/scratch/route.ts`
- Modify: `telegram-app/app/api/game/slot/route.ts`
- Modify: `telegram-app/app/api/game/win/route.ts`
- Modify: `telegram-app/app/api/game/wins/route.ts`
- Modify: `telegram-app/app/api/game/notify-trustlines/route.ts`
- Modify: `telegram-app/app/api/quiz/session/route.ts`
- Modify: `telegram-app/app/api/quiz/status/route.ts`
- Modify: `telegram-app/app/api/quiz/answer/route.ts`
- Modify: `telegram-app/app/api/quiz/complete/route.ts`
- Modify: `telegram-app/app/api/rewards/claim/route.ts`
- Modify: `telegram-app/app/api/donations/route.ts`
- Modify: `telegram-app/app/api/user/team/route.ts`
- Modify: `telegram-app/app/api/stats/funding/route.ts`
- Create: `telegram-app/__tests__/feature-gate.test.ts`

**Interfaces:**
- `requireFeature(feature: AppFeature): NextResponse | null` returns `null` when enabled and a 404 JSON response `{ success: false, code: 'FEATURE_DISABLED' }` when disabled.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest'
import { requireFeature } from '@/lib/feature-gate'

it('returns no response for an enabled feature', () => {
  expect(requireFeature('games')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/feature-gate.test.ts`

Expected: FAIL because `@/lib/feature-gate` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Implement the helper using `isFeatureEnabled`. Insert it as the first statement in every listed handler, mapping `game/*` to `games`, quiz handlers to `quiz`, reward claims to `rewards`, donations/funding stats to `donations`, and team APIs to `sports`. For multi-method files, apply the guard to each exported handler.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/feature-gate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/feature-gate.ts app/api/game app/api/quiz app/api/rewards/claim/route.ts app/api/donations/route.ts app/api/user/team/route.ts app/api/stats/funding/route.ts __tests__/feature-gate.test.ts
git commit -m "feat: protect disabled module routes"
```

### Task 6: Document cloning and validate the complete template

**Files:**
- Modify: `telegram-app/README.md`
- Modify: `telegram-app/.env.example`
- Modify: `telegram-app/config/branding.ts`

- [ ] **Step 1: Update the clone documentation**

Document a clone checklist: copy `.env.example`, set Telegram/Supabase/Stellar secrets, edit `config/branding.ts`, `config/app.ts`, `config/tiers.ts`, module data, and replace `public/` assets. Document how to disable each optional module and that disabled server routes return `FEATURE_DISABLED`. Remove stale create-next-app content from the README.

- [ ] **Step 2: Run complete verification**

Run:

```bash
npx tsc --noEmit
npm run lint
npm test
```

Expected: TypeScript has zero errors; lint has no errors; all Vitest tests pass.

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example config/branding.ts
git commit -m "docs: add template cloning guide"
```
