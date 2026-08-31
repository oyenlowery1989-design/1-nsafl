# Universal Template Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Telegram-only core reusable while preserving current NSAFL behavior as enabled packs.

**Architecture:** Core owns identity, neutral shell, notifications, errors, theme tokens, and manifest composition. Packs own domain UI, pages, APIs, admin modules, state, and repositories. Existing Supabase tables remain until core has no domain callers.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-universal-template-design.md`

## Global Constraints

- Preserve NSAFL URLs, authorization, enabled behavior, and schema.
- Add no dependency, CMS, or runtime configuration.
- Disabled pages redirect; disabled APIs return `FEATURE_DISABLED` before side effects.
- After each slice run `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm test`.

---

### Task 1: Compose complete pack manifests

**Files:** `packs/types.ts`, `config/app.ts`, `packs/*/manifest.ts`, `__tests__/app-config.test.ts`.

- [ ] **Step 1: Write failing composition tests**

```ts
it('returns only neutral navigation with every pack disabled', () => {
  expect(getNavigationItems(disabledPacks)).toEqual(neutralNavigation)
})
it('uses a pack-provided center action', () => {
  expect(getCenterAction({ ...disabledPacks, games: true })?.href).toBe('/game')
})
```

- [ ] **Step 2: Run `npm test -- __tests__/app-config.test.ts`**

Expected: fail because empty-core composition and center actions do not exist.

- [ ] **Step 3: Add the minimal contract**

```ts
export type PackManifest = Readonly<{
  id: PackId
  navigation?: readonly NavigationItem[]
  centerAction?: NavigationItem
  admin?: readonly NavigationItem[]
}>
```

- [ ] **Step 4: Verify focused tests and commit**

```bash
git add packs config/app.ts __tests__/app-config.test.ts
git commit -m "refactor: compose complete pack manifests"
```

### Task 2: Deliver a neutral shell

**Files:** `config/branding.ts`, `app/{layout,page}.tsx`, `components/{BottomNav,PageLoader}.tsx`, `app/globals.css`, pack home/copy modules, `__tests__/neutral-core.test.ts`.

- [ ] **Step 1: Write a failing empty-core test**

```ts
it('selects no pack home with every pack disabled', () => {
  expect(getHomeContribution(disabledPacks)).toBeNull()
})
```

- [ ] **Step 2: Run `npm test -- __tests__/neutral-core.test.ts`**

Expected: fail because root selects the Stellar home and shared shell is domain-specific.

- [ ] **Step 3: Implement neutral shell behavior**

Keep branding to identity/theme tokens. Move football/game actions, Stellar home, onboarding, referral, and campaign copy into manifests.

- [ ] **Step 4: Verify focused tests and commit**

```bash
git add config app components packs __tests__/neutral-core.test.ts
git commit -m "refactor: add neutral app shell"
```

### Task 3: Extract and guard public/API/admin boundaries

**Files:** domain files under `app/`, `app/api/`, and `app/admin/`; matching `packs/*/{pages,api,admin}` modules; guard tests.

- [ ] **Step 1: Write failing route and API tests**

```ts
it.each(['/clubs', '/stats', '/buy', '/trustlines'])('redirects disabled route %s', (href) => {
  renderPackPage(href, disabledPacks)
  expect(mockReplace).toHaveBeenCalledWith('/')
})
it('returns FEATURE_DISABLED before wallet API work', async () => {
  const response = await walletHandler(request)
  expect(response.status).toBe(404)
})
```

- [ ] **Step 2: Run focused tests**

Expected: fail for unguarded pages and `trustlines/record`, `verify-wallet-key`, and `wallet-live`.

- [ ] **Step 3: Move contributions to packs**

Preserve URLs as thin re-exports. Call `requirePack(pack)` before rate limiting, parsing, network, or database access. Compose admin links from manifests.

- [ ] **Step 4: Verify each pack boundary and commit**

```bash
git add app app/api app/admin components packs __tests__
git commit -m "refactor: isolate <pack> boundaries"
```

### Task 4: Split state and data access

**Files:** `hooks/useStore.ts`, shared domain components/libs, `packs/*/repository.ts`, API/admin callers, repository tests, `README.md`.

- [ ] **Step 1: Write failing state and repository tests**

```ts
it('keeps core identity state free of wallet and team fields', () => {
  expect(createIdentityStore().getState()).not.toHaveProperty('stellarAddress')
})
it('loads a wallet through the Stellar repository', async () => {
  await expect(stellarRepository.findPrimaryWallet(userId)).resolves.toEqual(expectedWallet)
})
```

- [ ] **Step 2: Run focused tests**

Expected: fail because shared state and core callers still own domain data.

- [ ] **Step 3: Extract one pack at a time**

Order: stellar-wallet, sports, rewards/games, donations, quiz, leaderboard. Keep tables/types until there are no core domain callers; schema splitting is a later migration.

- [ ] **Step 4: Run final verification and commit**

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test
git diff --check
git add hooks components packs app lib README.md __tests__
git commit -m "refactor: complete universal template boundaries"
```
