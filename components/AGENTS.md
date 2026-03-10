# AGENTS.md — Components

## All Agents

### Design System
- Background: `#0A0E1A` | Gold: `#D4AF37`
- Glass card: `bg-white/[0.03] backdrop-blur-[12px] border border-white/10 rounded-2xl`
- Headings: `font-['Playfair_Display']` | Body: `font-['Inter']`
- Icons: `<span className="material-symbols-outlined">icon_name</span>`
- Filled icon variant: `style={{ fontVariationSettings: "'FILL' 1" }}`

### BottomNav
Fixed bottom nav with `border-t border-white/10` — NOT pill/rounded card floating style. Center button is gold (`bg-[#D4AF37]`) with `border-4 border-[#0A0E1A]` and `animate-pulse` on the icon. Nav items from `NAV_ITEMS` in `@/lib/constants`.

### Component Conventions
- All components are client components (`'use client'`) unless purely presentational
- Use Zustand store via `useWalletStore((s) => s.fieldName)` from `@/hooks/useStore`
- Asset display: use `PRIMARY_CUSTOM_ASSET_LABEL` from `@/lib/constants`
- Tier config from `@/config/tiers` — 5 tiers: pre-tier (0), tier-1 (100), tier-2 (501), tier-3 (1001), tier-4 (2501+)

### Before Building/Modifying
Check the HTML reference files in the project root for the target design. Match the design exactly.
