-- tier_reward_claims was created in 028 without RLS enabled. All access to
-- this table goes through service-role API routes (never direct client
-- queries), so enabling RLS with no policies is correct and sufficient —
-- it blocks the anon/authenticated roles entirely while the service-role
-- key bypasses RLS automatically. Matches wallets/wallet_balances.
alter table "public"."tier_reward_claims" enable row level security;
