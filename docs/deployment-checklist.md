# Deployment Checklist — Vercel + Telegram

## Pre-deploy checks

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero ESLint errors
- [ ] `npm run dev` — app starts, all pages load
- [ ] All 5 nav tabs route correctly
- [ ] Wallet connect flow works end-to-end (dev bypass)
- [ ] Profile page: not-connected state shows CTA (no disconnect button)
- [ ] Profile page: spam filter toggles correctly
- [ ] Balance API returns all SHOWN_ASSETS

---

## Environment Variables to set in Vercel

Copy from `.env.local` — these ALL need to be in Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
NEXT_PUBLIC_PRIMARY_ASSET_CODE
NEXT_PUBLIC_PRIMARY_ASSET_ISSUER
NEXT_PUBLIC_SHOWN_ASSETS
NEXT_PUBLIC_HORIZON_URL
NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS
```

**DO NOT set `NEXT_PUBLIC_DEV_BYPASS` in production Vercel env.**

---

## Deploy Steps

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project (first time only)
cd telegram-app
vercel link

# 3. Deploy
vercel --prod
```

Or use the `/vercel:deploy` skill from Claude Code.

---

## Post-deploy Steps

### 1. Set Telegram Bot Webhook
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/webhook
```

### 2. Configure Telegram Mini App
In @BotFather:
```
/newapp  (or /editapp if existing)
→ Web App URL: https://your-app.vercel.app
→ Title: The Homecoming Hub
```

### 3. Test on real device
- Open Telegram on phone
- Open the bot
- Tap the Mini App button
- Verify: app loads, TelegramGuard passes, wallet connect works

---

## Production Verification

- [ ] App loads in Telegram Mini App (not just browser)
- [ ] Telegram Guard: direct browser URL shows "Telegram Only" block screen
- [ ] Wallet connect saves to Supabase
- [ ] Balance fetches from Stellar Horizon
- [ ] All 5 pages render without console errors
- [ ] Bottom nav active state works
- [ ] Profile: back button works (router.back())
- [ ] No `NEXT_PUBLIC_DEV_BYPASS` leaking into production

---

## Rollback

```bash
vercel rollback
```
