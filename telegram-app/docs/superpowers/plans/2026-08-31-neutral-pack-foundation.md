# Neutral Pack Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a domain-neutral build-time pack contract without changing current NSAFL behavior.

**Architecture:** `config/app.ts` composes enabled pack manifests into navigation and feature checks. A pack owns its identifier, navigation entries, and dependencies; the existing feature gates consume the composed pack state. Sports and Stellar extraction follow in separate plans after this contract is stable.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-domain-neutral-template-design.md`

## Global Constraints

- Keep configuration source-controlled and selected before deployment.
- Add no dependencies or runtime CMS/settings.
- Preserve current NSAFL routes, navigation, and enabled behavior.
- Disabled packs keep returning `FEATURE_DISABLED` before API side effects.
- Run `npx tsc --noEmit`, `npm run lint`, and `npm test` from `telegram-app/`.

---

### Task 1: Define the pack manifest contract

**Files:**
- Create: `packs/types.ts`
- Modify: `config/app.ts`
- Modify: `__tests__/app-config.test.ts`

**Interfaces:**
- `PackId = 'sports' | 'stellar-wallet' | 'rewards' | 'games' | 'quiz' | 'donations' | 'leaderboard'`.
- `PackManifest` has `id: PackId`, `enabled: boolean`, and optional `navigation` entries.
- `isPackEnabled(pack: PackId): boolean` and `getNavigationItems()` derive their results from manifests.

- [ ] **Step 1: Write the failing tests**

```ts
import { getNavigationItems, isPackEnabled } from '@/config/app'

it('keeps every current NSAFL pack enabled', () => {
  expect(isPackEnabled('sports')).toBe(true)
  expect(isPackEnabled('stellar-wallet')).toBe(true)
})

it('omits navigation supplied by a disabled pack', () => {
  expect(getNavigationItems({ sports: false }).some((item) => item.href === '/clubs')).toBe(false)
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- __tests__/app-config.test.ts`

Expected: FAIL because `isPackEnabled` and manifest-derived navigation do not exist.

- [ ] **Step 3: Add the minimal contract**

```ts
export type PackId = 'sports' | 'stellar-wallet' | 'rewards' | 'games' | 'quiz' | 'donations' | 'leaderboard'
export type PackManifest = { id: PackId; enabled: boolean; navigation?: readonly NavigationItem[] }
export const isPackEnabled = (pack: PackId) => APP_CONFIG.packs[pack].enabled
```

Move existing feature booleans into `APP_CONFIG.packs`; retain `isFeatureEnabled` as a compatibility alias until the sports/Stellar migration plans remove its callers.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- __tests__/app-config.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packs/types.ts config/app.ts __tests__/app-config.test.ts
git commit -m "refactor: add neutral pack manifest"
```

### Task 2: Make current feature gates consume the pack contract

**Files:**
- Modify: `components/FeatureRedirect.tsx`
- Modify: `lib/feature-gate.ts`
- Modify: `__tests__/feature-gate.test.ts`

**Interfaces:**
- `FeatureRedirect` accepts `pack: PackId`.
- `requirePack(pack: PackId)` returns `null` or the existing 404 JSON response.
- Keep `requireFeature` as a forwarding compatibility export during route migration.

- [ ] **Step 1: Write the failing test**

```ts
import { requirePack } from '@/lib/feature-gate'

it('allows an enabled pack to continue to its handler', () => {
  expect(requirePack('games')).toBeNull()
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- __tests__/feature-gate.test.ts`

Expected: FAIL because `requirePack` is not exported.

- [ ] **Step 3: Rename only the shared boundary**

```ts
export function requirePack(pack: PackId) {
  if (isPackEnabled(pack)) return null
  return NextResponse.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 })
}
export const requireFeature = requirePack
```

Use `isPackEnabled` in `FeatureRedirect`; do not touch individual page or route callers in this task.

- [ ] **Step 4: Run focused verification**

Run: `npm test -- __tests__/feature-gate.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/FeatureRedirect.tsx lib/feature-gate.ts __tests__/feature-gate.test.ts
git commit -m "refactor: gate routes by pack"
```

### Task 3: Document neutral-core boundaries

**Files:**
- Modify: `README.md`
- Modify: `config/branding.ts`

**Interfaces:**
- The clone checklist identifies core configuration versus a domain pack.
- `config/branding.ts` documents only brand/theme/copy ownership.

- [ ] **Step 1: Update clone instructions**

State that core configuration is domain-neutral, packs are chosen in `config/app.ts`, and sports/Stellar data remains temporary NSAFL pack data pending extraction.

- [ ] **Step 2: Run documentation and repository checks**

Run: `git diff --check && npm test && npx tsc --noEmit && npm run lint`

Expected: no diff errors, all tests passing, zero TypeScript/lint errors.

- [ ] **Step 3: Commit**

```bash
git add README.md config/branding.ts
git commit -m "docs: describe neutral pack foundation"
```
