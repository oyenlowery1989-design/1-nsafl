# Telegram Mini App Template

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Clone checklist

1. Set the Telegram, Supabase, Stellar, admin, and reward values in `.env.local`.
2. Update identity and copy in `config/branding.ts`.
3. Choose enabled modules and bottom navigation in `config/app.ts`.
4. Replace tier thresholds and rewards in `config/tiers.ts`; replace sports/team data in `config/afl.ts` when sports is enabled.
5. Adjust game rewards in `lib/rewardAssets.ts` when games are enabled.
6. Replace images, icons, and other public assets in `public/`.
7. Run `npx tsc --noEmit`, `npm run lint`, and `npm test` before deployment.

`NEXT_PUBLIC_*` values are baked into the client build, so deploy again after changing them.

## Optional modules

Set any feature in `config/app.ts` to `false`:

- `sports` hides sports pages and team selection.
- `games` hides the game page and its long-press home control.
- `quiz`, `rewards`, and `donations` disable their respective flows.
- `leaderboard` hides the holder-ranking page and endpoint.

Disabled pages redirect to `/`. Their API routes respond with `404` and `{ success: false, code: 'FEATURE_DISABLED' }` before authentication, database, or Stellar work.
