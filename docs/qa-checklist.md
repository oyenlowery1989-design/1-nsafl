# QA Checklist — The Homecoming Hub

Run this before every deployment. Mark all items ✅ before going live.

---

## TypeScript & Lint

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors or warnings

---

## Wallet Connect Flow

- [ ] Empty address → shows validation error
- [ ] Short address (< 56 chars) → shows validation error
- [ ] Valid address (G + 55 base32) → proceeds to connecting
- [ ] Network failure during connect → shows error, returns to gate
- [ ] Successful connect → shows celebration screen with balance
- [ ] "Enter Dashboard" from celebration → shows dashboard
- [ ] Returning user (Zustand persist) → goes straight to dashboard, no connect screen

---

## Dashboard

- [ ] Balance card shows NSAFL balance
- [ ] Balance card shows XLM balance
- [ ] All SHOWN_ASSETS appear (configured in env)
- [ ] AFL Pulse section renders
- [ ] Quick stats section renders

---

## Profile Page

- [ ] **Not connected**: shows "No Wallet Connected" state + "Connect Wallet" CTA
- [ ] **Not connected**: NO disconnect button visible
- [ ] **Connected**: wallet address shown (truncated)
- [ ] **Connected**: "Connected" green badge shown
- [ ] **Connected**: all SHOWN_ASSET balances shown in balance card
- [ ] Tap copy → address copied, check icon shown briefly
- [ ] Transactions load on mount
- [ ] Spam filter ON (default): hides tiny XLM and unknown assets
- [ ] Spam filter badge shows count of hidden transactions
- [ ] Spam filter OFF: shows all transactions at 50% opacity for spam items
- [ ] "Load more" appears when hasMore = true
- [ ] "Load more" loads next page of transactions
- [ ] Disconnect button: red styled
- [ ] Disconnect → clears Zustand store → redirects to `/`
- [ ] Back button → router.back() works

---

## Stats Page

- [ ] Funding chart renders
- [ ] Regional support bars render
- [ ] Top supporters list renders

---

## Clubs Page

- [ ] Renders without errors

---

## Rewards Page

- [ ] Renders without errors
- [ ] Tier cards display correctly

---

## Navigation

- [ ] All 5 nav tabs navigate correctly
- [ ] Active tab highlights in gold
- [ ] Center football button navigates to `/`
- [ ] Center button animate-pulse on icon
- [ ] pb-32 on all pages — content not hidden behind nav

---

## TelegramGuard

- [ ] Dev (`NEXT_PUBLIC_DEV_BYPASS=true`): app loads in browser
- [ ] Production: direct browser URL shows "Telegram Only" block screen
- [ ] Loading spinner shows briefly on cold load
- [ ] `NEXT_PUBLIC_DEV_BYPASS` is NOT set in Vercel environment

---

## Design System

- [ ] Background is exactly `#0A0E1A` (not black, not `#08080f`)
- [ ] Gold is exactly `#D4AF37`
- [ ] All cards use `.glass-card` class
- [ ] Headings use Playfair Display (serif)
- [ ] Body uses Inter (sans-serif)
- [ ] All icons are Material Symbols Outlined (not lucide-react)
- [ ] Bottom nav uses `border-t border-white/10` (not pill style)

---

## Performance

- [ ] All pages load within 2s on mobile
- [ ] No console errors in production
- [ ] No unhandled promise rejections
- [ ] Images (if any) have proper `alt` text

---

## Telegram-specific

- [ ] `Telegram.WebApp.ready()` called on mount
- [ ] `Telegram.WebApp.expand()` called on mount
- [ ] App fills full Telegram viewport height
- [ ] `env(safe-area-inset-bottom)` padding applied to bottom nav
