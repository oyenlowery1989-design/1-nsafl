# AGENTS.md — CRYPTOBANK Homecoming Hub

## All Agents

### Project Context
This is a Telegram Mini App (Next.js 16, React 19, TypeScript) for the CRYPTOBANK Stellar token ecosystem. App code lives in `telegram-app/` — there is NO `src/` directory.

### Path Alias
`@/` maps to `telegram-app/` root. Example: `@/lib/constants` = `telegram-app/lib/constants.ts`.

### Critical Rules
- **Background:** `#0A0E1A` — never use `#08080f` or any other dark
- **Gold:** `#D4AF37` — never use `#D4A017` or `#F0C040`
- **Tailwind v4:** Use `@import "tailwindcss"` — NOT `@tailwind base/components/utilities`
- **Icons:** Material Symbols Outlined via `<link>` — NOT lucide-react or heroicons
- **Fonts:** Playfair Display (headings), Inter (body) — loaded via `<link>` in layout.tsx
- **Asset names:** Use `PRIMARY_CUSTOM_ASSET_CODE` / `PRIMARY_CUSTOM_ASSET_LABEL` from `@/lib/constants` — NEVER hardcode token names
- **Zustand store field:** `stellarAddress` (NOT `address`)
- **Supabase:** Use `(supabase as any)` for `funding_config` and `afl_bets` tables
- **Glass card pattern:** `bg-white/[0.03] backdrop-blur-[12px] border border-white/10 rounded-2xl`

### HTML Reference Designs
Always check the HTML files in the project root (`Dashboard connect wallet.html`, `Connected.html`, `Dashboard.html`, `Stats.html`, `Rewards.html`, `Profile.html`) before building or modifying any screen.

### Verification
After any code change, run from `telegram-app/`:
```bash
npx tsc --noEmit   # must show 0 errors
npm run lint       # eslint
```
