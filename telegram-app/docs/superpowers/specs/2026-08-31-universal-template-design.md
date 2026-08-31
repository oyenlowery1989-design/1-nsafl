# Universal Telegram Template

## Goal

Turn the app into a reusable Telegram Mini App template. The core is Telegram-only; all wallet, sports, reward, game, quiz, donation, and leaderboard behavior is supplied by optional packs.

## Core boundary

The core owns Telegram identity/session validation, a neutral shell, profile basics, notifications, error handling, build-time identity/theme, and the extension points that compose enabled packs.

Core must not contain domain copy, token/chain assumptions, clubs, tiers, reward rules, games, wallet state, or domain admin workflows. An empty-core build must render a neutral home and profile without a domain route, navigation item, API, or admin link.

## Identity and theme

`config/branding.ts` becomes identity-only: app name, short name, domain, bot username, metadata, logo paths, color tokens, fonts, and neutral copy. Pack-owned copy includes onboarding, referral, campaign, wallet, reward, and sport terminology.

The shell consumes these tokens for metadata, loader, navigation defaults, and icons. Packs may add their own visual assets without changing the core design system.

## Pack contract

Every pack exports one manifest with its ID, public navigation, optional home contribution, optional center action, routes, API guards, admin contribution, copy, state factory, and data adapter. `config/app.ts` selects enabled manifests and composes those exports; it does not define a pack's domain content.

Disabled packs contribute no navigation or admin links. Their pages redirect through the shared feature boundary, and every API handler returns `FEATURE_DISABLED` before rate limits, parsing, network work, or database work.

## State and data

Core state contains Telegram identity and neutral preferences only. Packs own their domain state: Stellar wallet/balances, team selection, tiers, rewards, games, quizzes, donations, and leaderboards.

The physical Supabase schema remains compatible during extraction. First move route and UI callers behind pack-owned repositories; only then split generated types and migrations by pack. This avoids a large unsafe schema migration while core still calls domain tables.

## Migration sequence

1. Create the neutral shell and identity/theme contract. Move the football loader, hard-coded game action, Stellar home selection, and domain onboarding/copy into packs.
2. Expand manifests and add composition/empty-core tests. Move public route, API, and admin registration into manifests.
3. Extract remaining domain UI, guards, state, and core routes to their respective packs without changing existing NSAFL URLs.
4. Introduce pack repositories and move existing Supabase callers to them. Split schema/types only after no core caller depends on a domain table.

## Compatibility

Current NSAFL URLs, enabled-pack behavior, database schema, Telegram authorization, and asset configuration remain unchanged throughout the migration. No CMS, runtime settings, or new dependency is introduced.

## Verification

Each migration slice starts with a failing test. The suite covers empty-core rendering, pack navigation and center-action composition, disabled page/API/admin behavior, and unchanged enabled NSAFL behavior. `npx tsc --noEmit`, `npm run lint`, and `npm test` remain release gates.
