# Domain-Neutral Telegram App Template

## Goal

Make the app reusable across unrelated domains before deployment. Sports, Stellar tokens, rewards, games, banking, investing, and mining are optional packs—not assumptions in the shared app.

## Neutral core

The core provides the Telegram shell, layout and navigation, authentication/session handling, profile, notifications, admin access, error handling, and build-time branding/theme. It contains no domain copy, token names, sports data, or reward rules.

## Pack contract

Each pack is self-contained and exports its build-time configuration, routes, navigation entries, copy, static data, and API guards. `config/app.ts` composes the enabled pack IDs, brand, theme, and navigation. A disabled pack contributes neither visible navigation nor usable routes; its API handlers return `FEATURE_DISABLED` before side effects.

Initial packs are `sports`, `stellar-wallet`, `rewards`, and `games`. Future packs such as `banking`, `investing`, and `mining` use the same contract.

## Data and migration

Configuration remains source-controlled and is chosen before deployment. No CMS, runtime settings, or database migration is required for the first extraction. Existing NSAFL URLs and schema remain compatible while the current sports and Stellar code moves behind their packs. Core pages then lose sports and token-specific copy.

## Verification

Tests cover an empty neutral-core configuration and pack-specific navigation/route behavior. TypeScript, lint, and the full Vitest suite remain release gates.
