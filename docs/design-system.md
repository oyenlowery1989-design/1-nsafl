# Design System — CRYPTOBANK Homecoming Hub

> Single source of truth for all UI decisions. Match this EXACTLY before adding any creative touches.
> Extracted directly from the official HTML reference files in the project root.

---

## Color Tokens

```css
/* Core Backgrounds */
--bg-primary:       #0A0E1A;             /* Deep Navy — body, page background */
--bg-overlay:       rgba(10,14,26,0.80); /* Sticky header backdrop */
--bg-overlay-nav:   rgba(10,14,26,0.90); /* Bottom nav backdrop */

/* Glass Cards */
--glass-bg:         rgba(255,255,255,0.03);
--glass-border:     rgba(255,255,255,0.10);
--glass-shadow:     0 4px 30px rgba(0,0,0,0.1);
--glass-blur:       blur(12px);

/* Gold */
--primary:          #D4AF37;             /* Brushed Gold — ONLY this value */
--primary-glow:     0 0 20px rgba(212,175,55,0.8);
--primary-dim:      rgba(212,175,55,0.20);

/* Text */
--text-base:        #E2E8F0;             /* Body text */
--text-muted:       #9CA3AF;             /* gray-400 */
--text-dimmed:      #6B7280;             /* gray-500 */

/* Status */
--green:            #22C55E;             /* Connected, success */
--orange:           #F97316;             /* In Talks badge */
--blue:             #3B82F6;             /* Target badge */
--red:              #EF4444;             /* Error, disconnect */
```

### DO NOT USE
| Wrong | Correct |
|-------|---------|
| `#08080f`, `#12121a` | `#0A0E1A` |
| `#D4A017`, `#F0C040` | `#D4AF37` |
| Sora, DM Sans | Playfair Display (headings), Inter (body) |
| lucide-react | Material Symbols Outlined |

---

## Typography

### Font Loading (layout.tsx `<head>`)
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
```

### Type Scale
| Role | Classes |
|------|---------|
| App title | `text-2xl font-bold text-white tracking-tight font-serif` |
| Section header | `text-xl font-bold text-white font-serif` |
| Balance amount | `text-4xl font-bold text-white` (Inter) |
| Token symbol | `text-xl font-semibold text-[#D4AF37]` |
| Player name | `text-base font-bold text-white` |
| Body / description | `text-sm text-gray-400` |
| Tiny caps / label | `text-xs uppercase tracking-wide text-gray-400` |
| Badge | `text-[10px] font-semibold uppercase` |
| Mono address | `text-xs font-mono text-gray-300` |
| Nav label | `text-[10px] font-medium tracking-wide uppercase` |

---

## Core CSS Classes (globals.css)

```css
/* Glass card — use on EVERY card */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

/* Safe area — always on bottom nav */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
}

/* Hide scrollbar */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Material Symbols */
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  display: inline-block;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
}
```

---

## App Shell Patterns

### Sticky Header
```tsx
<header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
        <span className="material-symbols-outlined text-[#D4AF37]">sports_football</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">The Homecoming Hub</h1>
        <p className="text-sm text-[#D4AF37] font-medium">Main Dashboard</p>
      </div>
    </div>
    {/* Optional right action */}
    <button className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
      <span className="material-symbols-outlined text-white">notifications</span>
    </button>
  </div>
</header>
```

### Back-button Header (inner pages)
```tsx
<header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
  <div className="flex items-center space-x-4">
    <button onClick={() => router.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
      <span className="material-symbols-outlined text-white">arrow_back</span>
    </button>
    <div>
      <h1 className="text-2xl font-bold text-white tracking-tight">Page Title</h1>
      <p className="text-sm text-[#D4AF37] font-medium">Subtitle</p>
    </div>
  </div>
</header>
```

### Main Content
```tsx
<main className="px-6 py-6 space-y-6 pb-32">
  {/* pb-32 always — clears fixed bottom nav */}
</main>
```

### Bottom Navigation (EXACT pattern)
```tsx
<nav className="fixed bottom-0 w-full bg-[#0A0E1A]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-3 px-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
  <div className="flex justify-between items-center pb-5">
    {/* Left items */}
    <NavItem href="/stats" icon="query_stats" label="Stats" />
    <NavItem href="/clubs" icon="stadium" label="Clubs" />

    {/* Center FAB — lifted -top-6 */}
    <div className="relative -top-6">
      <button className="w-14 h-14 bg-[#D4AF37] text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.8)] border-4 border-[#0A0E1A] active:scale-95 transition">
        <span className="material-symbols-outlined text-3xl animate-pulse">sports_football</span>
      </button>
    </div>

    {/* Right items */}
    <NavItem href="/rewards" icon="redeem" label="Rewards" />
    <NavItem href="/profile" icon="person" label="Profile" />
  </div>
</nav>
```

---

## Component Patterns

### Glass Card (standard)
```tsx
<div className="glass-card rounded-2xl p-6">
  {/* content */}
</div>
```

### Glass Card with Ambient Glow
```tsx
<div className="glass-card rounded-2xl p-6 relative overflow-hidden">
  <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#D4AF37]/20 rounded-full blur-3xl" />
  <div className="relative z-10">
    {/* content */}
  </div>
</div>
```

### Address Pill (connected)
```tsx
<div className="flex items-center space-x-2 bg-black/30 rounded-full px-3 py-1 border border-white/10 w-fit">
  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
  <span className="text-xs text-gray-300 font-mono">GC7V...4K2P</span>
</div>
```

### Status Badge — In Talks
```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase">
  In Talks
</span>
```

### Status Badge — Target
```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
  Target
</span>
```

### Status Badge — Connected
```tsx
<span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30 uppercase">
  <span className="material-symbols-outlined text-[11px] mr-1">circle</span>
  Connected
</span>
```

### Player Card
```tsx
<div className="glass-card p-4 rounded-xl flex items-center justify-between border-l-4 border-l-orange-500">
  <div className="flex items-center space-x-4">
    <div className="relative">
      <div className="w-14 h-14 rounded-full border-2 border-[#D4AF37]/50 bg-white/5 flex items-center justify-center">
        <span className="material-symbols-outlined text-gray-400 text-2xl">person</span>
      </div>
      {/* Status dot */}
      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 border-2 border-[#0A0E1A] flex items-center justify-center">
        <span className="material-symbols-outlined text-white text-[10px]">sync</span>
      </div>
    </div>
    <div>
      <h3 className="font-bold text-white text-base">Player Name</h3>
      <p className="text-xs text-gray-400">Position • Club</p>
      <div className="flex items-center mt-1 space-x-2">
        {/* badge */}
        <span className="text-[10px] text-gray-500">Est: 25k $CRYPTOBANK</span>
      </div>
    </div>
  </div>
  <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
    <span className="material-symbols-outlined text-[#D4AF37] text-sm">chevron_right</span>
  </button>
</div>
```

### Quick Stats Card
```tsx
<div className="glass-card rounded-xl p-4 flex flex-col items-center text-center">
  <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-3">
    <span className="text-blue-400 font-bold text-sm">WCE</span>
  </div>
  <p className="text-2xl font-bold text-white mb-1">42</p>
  <p className="text-xs text-gray-400 uppercase tracking-wide">Active Targets</p>
</div>
```

### Action Button (primary)
```tsx
<button className="w-full bg-[#D4AF37] text-black font-semibold py-4 rounded-xl text-base hover:bg-[#D4AF37]/90 shadow-[0_0_15px_rgba(212,175,55,0.3)] flex items-center justify-center space-x-2 transition">
  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
  <span>Button Label</span>
</button>
```

### Action Button (ghost/secondary)
```tsx
<button className="w-full glass-card border border-white/10 rounded-xl py-4 flex items-center justify-center space-x-2 hover:bg-white/5 transition">
  <span className="material-symbols-outlined text-gray-400 text-sm">settings</span>
  <span className="text-sm font-semibold text-white">Button Label</span>
</button>
```

### Action Button (danger)
```tsx
<button className="w-full glass-card border border-red-500/20 rounded-xl py-4 flex items-center justify-center space-x-2 hover:bg-red-500/5 transition">
  <span className="material-symbols-outlined text-red-400 text-sm">link_off</span>
  <span className="text-sm font-semibold text-red-400">Disconnect Wallet</span>
</button>
```

---

## Icon Reference

Always use Material Symbols Outlined. Never use lucide-react.

| Purpose | Icon name |
|---------|-----------|
| Center nav / app logo | `sports_football` |
| Stats nav | `query_stats` |
| Clubs nav | `stadium` |
| Rewards nav | `redeem` |
| Profile nav | `person` |
| Wallet | `account_balance_wallet` |
| Copy | `content_copy` |
| Back | `arrow_back` |
| Settings | `settings` |
| Notifications | `notifications` |
| Disconnect | `link_off` |
| Incoming tx | `south_west` |
| Outgoing tx | `north_east` |
| Player sync status | `sync` |
| Trophy / reward | `emoji_events` |
| Token | `token` |
| Currency exchange | `currency_exchange` |
| Filter | `filter_alt` / `filter_alt_off` |
| Lock (Telegram guard) | `lock` |
| Connected badge | `circle` |
| Check | `check` |
| Premium | `workspace_premium` |
| Forward arrow | `arrow_forward` |
| Expand | `expand_more` |
| Refresh | `refresh` |
| Receipt | `receipt_long` |

### Filled icon
```tsx
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
  sports_football
</span>
```

---

## Spacing & Layout Rules

| Rule | Value |
|------|-------|
| Page horizontal padding | `px-6` |
| Page top padding (below header) | `py-6` |
| Bottom padding (above nav) | `pb-32` |
| Card border radius | `rounded-2xl` (standard), `rounded-xl` (compact) |
| Card padding | `p-6` (standard), `p-4` (compact) |
| Section gap | `space-y-6` |
| Body min-height | `min-height: max(884px, 100dvh)` |
