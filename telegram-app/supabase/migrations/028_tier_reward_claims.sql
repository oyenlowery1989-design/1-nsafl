-- One claim per user per UTC calendar month for the current tier's
-- gold/silver/copper perks. claim_month is always the UTC month start —
-- pinned explicitly so it can't drift with session timezone config
-- (see 026_consume_daily_spin_utc.sql for the same convention).
create table "public"."tier_reward_claims" (
  "id" bigint generated always as identity primary key,
  "telegram_id" bigint not null references "public"."users"("telegram_id"),
  "tier_id" text not null,
  "claim_month" date not null,
  "gold_amount" numeric(20,7) not null default 0,
  "silver_amount" numeric(20,7) not null default 0,
  "copper_amount" numeric(20,7) not null default 0,
  "payout_status" text not null default 'pending',
  "payout_tx_hash" text,
  "payout_notes" text,
  "physical_gold_notified" boolean not null default false,
  "created_at" timestamptz not null default now(),
  unique ("telegram_id", "claim_month")
);

create index "tier_reward_claims_telegram_id_idx" on "public"."tier_reward_claims" ("telegram_id");
