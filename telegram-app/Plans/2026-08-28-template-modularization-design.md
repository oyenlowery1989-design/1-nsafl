# Modular Telegram App Template Design

## Goal

Make this Telegram Mini App reusable across brands without rebuilding the shared Telegram, Stellar wallet, profile, notification, and admin foundations.

## Scope

The template is configured in source control before deployment. It does not add a CMS or allow runtime editing of security, wallet, or module settings.

## Architecture

`config/app.ts` becomes the composition point for a clone. It exposes typed brand, theme, feature, navigation, and module configuration.

Core features are always available:

- Telegram authentication and bot integration
- Stellar wallet connection, trustlines, balances, and transactions
- Profile, notifications, errors, and admin authentication

Optional modules are independently enabled:

- Sports: teams, players, fixtures, partner club, sports donations and statistics
- Games: lucky draw, slot machine, scratch card, quiz, and one shared prize definition
- Rewards: holder tiers, reward assets, and tier claims

Disabled modules are absent from navigation and route requests redirect to `/`. Their server routes reject the request without performing work.

## Brand and Theme

Brand configuration owns app name, short name, bot/domain defaults, public asset paths, color values, fonts, generic copy, and metadata inputs. Global CSS consumes CSS custom properties for the background and primary colors, preserving the existing semantic Tailwind utilities (`bg-primary`, `text-primary`, and `bg-background-dark`).

Every clone replaces the public brand assets, `.env.local`, and configuration files. No NSAFL product name, bot username, domain, or wrapped primary asset code remains in generic UI or game logic.

## Data and Compatibility

Existing routes and database schema remain intact. Sports-specific database fields (`favorite_team`, `favorite_wafl_team`) are ignored when sports is disabled; no destructive migration is required. Existing route URLs are preserved to avoid broken links, but disabled pages redirect safely to the dashboard.

## Verification

Vitest tests cover configuration-derived wrapped asset names, module enablement, and nav filtering. TypeScript, lint, and the full existing test suite remain required gates.
