# AGENTS.md — API Routes

## All Agents

### API Route Pattern
Every route handler in this directory MUST:

1. Read `x-telegram-init-data` header from the request
2. Validate via `validateTelegramInitData(initData, BOT_TOKEN)` — skipped when `NEXT_PUBLIC_DEV_BYPASS=true`
3. Return success: `ok(data)` from `@/lib/api-response`
4. Return error: `fail(message, code)` from `@/lib/api-response`

### Response Shape
```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string, code: string }
```

### Imports
```ts
import { ok, fail } from '@/lib/api-response'
import { validateTelegramInitData, extractTelegramUser } from '@/lib/telegram'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server'
```

### Supabase
- Use `createServerSupabaseClient()` for user-scoped queries
- Use `createServiceClient()` for admin/service-role queries
- `wallets` table has NO `telegram_id` column — join via `users(telegram_id) -> wallets(user_id)`
- All tables are fully typed in `lib/database.types.ts` — no `(supabase as any)` casts needed

### Stellar
- Horizon helpers in `@/lib/stellar`
- Asset code/issuer from `@/lib/constants`
