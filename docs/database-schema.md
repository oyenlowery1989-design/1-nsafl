# Database Schema — Supabase

> Supabase project ID: `vrqlxguhfndrqiipisyi`
> All migrations 001–008 applied ✅

---

## Table Relationships

```
users (telegram_id)
  └── wallets (user_id)          [one primary wallet per user]
        └── wallet_balances (wallet_id)  [cached Stellar balances, Realtime enabled]

tiers                            [read-only seed data, 5 tiers]
movement_stats                   [global funding totals + monthly data]
regional_support                 [percentage breakdown by region]
top_supporters                   [leaderboard]
funding_config                   [configurable funding targets — use (supabase as any)]
afl_bets                         [AFL match predictions — use (supabase as any)]
```

---

## Tables

### `users`
```sql
id              uuid PRIMARY KEY default gen_random_uuid()
telegram_id     bigint UNIQUE NOT NULL
telegram_username    text
telegram_first_name  text
telegram_photo_url   text
created_at      timestamptz default now()
updated_at      timestamptz default now()
```
> Index: `idx_users_telegram_id` on `telegram_id`

### `wallets`
```sql
id              uuid PRIMARY KEY
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
stellar_address text NOT NULL
label           text default 'Legacy Wallet'
is_primary      boolean default true
created_at      timestamptz
```
> Unique index: `(user_id)` WHERE `is_primary = true`
> **No `telegram_id` column** — always join through `users`

### `wallet_balances`
```sql
id              uuid PRIMARY KEY
wallet_id       uuid REFERENCES wallets(id) ON DELETE CASCADE
nsafl_balance   numeric(20,7) default 0
xlm_balance     numeric(20,7) default 0
balance_week_ago numeric(20,7) default 0
last_synced_at  timestamptz
updated_at      timestamptz
```
> `REPLICA IDENTITY FULL` — Supabase Realtime enabled on this table

### `tiers`
```sql
id              uuid PRIMARY KEY
name            text
min_balance     numeric(20,7)
max_balance     numeric(20,7)   -- NULL for top tier
color           text
icon            text
perks           jsonb default '[]'
display_order   int
```

Tier IDs use **hyphens** in app config: `pre-tier`, `tier-1`, `tier-2`, `tier-3`, `tier-4`

| Tier | Name | Min Balance |
|------|------|-------------|
| Pre-Tier | Rookie | 0 |
| Tier 1 | Bronze | 100 |
| Tier 2 | Silver | 501 |
| Tier 3 | Gold | 1,001 |
| Tier 4 | Platinum | 2,501+ |

### `movement_stats`
```sql
id              uuid PRIMARY KEY
total_funding   numeric(20,7)
target_funding  numeric(20,7)
monthly_data    jsonb   -- [{ month, amount }, ...]
updated_at      timestamptz
```

### `regional_support`
```sql
id              uuid PRIMARY KEY
region_name     text
percentage      numeric(5,2)
color           text
display_order   int
```

### `top_supporters`
```sql
id              uuid PRIMARY KEY
username        text
hub_name        text
amount          numeric(20,7)
rank            int
updated_at      timestamptz
```

---

## Row Level Security

- `users`, `wallets`, `wallet_balances` — Service role only (API routes use `createServiceClient()`)
- `tiers`, `movement_stats`, `regional_support`, `top_supporters` — Public SELECT allowed
- `funding_config`, `afl_bets` — Service role only

---

## TypeScript Notes

- Use `(supabase as any)` for `funding_config` and `afl_bets` tables (not yet in generated types)
- All tables in generated types need `Relationships: []`
- Re-generate types: `npx supabase gen types typescript --project-id vrqlxguhfndrqiipisyi > types/database.ts`

---

## Common Queries

### Upsert user + wallet on connect
```ts
// 1. Upsert user
const { data: user } = await supabase
  .from('users')
  .upsert({ telegram_id, telegram_username }, { onConflict: 'telegram_id' })
  .select('id').single()

// 2. Upsert wallet
const { data: wallet } = await supabase
  .from('wallets')
  .upsert({ user_id: user.id, stellar_address, is_primary: true }, { onConflict: 'user_id' })
  .select('id').single()

// 3. Upsert cached balance
await supabase
  .from('wallet_balances')
  .upsert({ wallet_id: wallet.id, nsafl_balance, xlm_balance, last_synced_at: new Date().toISOString() },
    { onConflict: 'wallet_id' })
```

### Realtime balance subscription
```ts
const channel = supabase
  .channel('balance-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'wallet_balances',
    filter: `wallet_id=eq.${walletId}`,
  }, (payload) => {
    setNsaflBalance(payload.new.nsafl_balance)
    setXlmBalance(payload.new.xlm_balance)
  })
  .subscribe()

return () => supabase.removeChannel(channel)
```
