


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."consume_daily_spin"("p_telegram_id" bigint, "p_source" "text", "p_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  updated int;
begin
  insert into game_spin_counters (telegram_id, source, day, count)
  values (p_telegram_id, p_source, current_date, 0)
  on conflict (telegram_id, source, day) do nothing;

  update game_spin_counters
     set count = count + 1
   where telegram_id = p_telegram_id and source = p_source and day = current_date
     and count < p_limit;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;


ALTER FUNCTION "public"."consume_daily_spin"("p_telegram_id" bigint, "p_source" "text", "p_limit" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."access_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "referrer" "text",
    "tg_start_param" "text",
    "tg_sdk_present" boolean,
    "tg_sdk_fake" boolean,
    "screen" "text",
    "timezone" "text",
    "language" "text",
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "devtools_opened" boolean DEFAULT false,
    "telegram_id" bigint,
    "telegram_username" "text",
    "telegram_first_name" "text",
    "geo_location" "text"
);


ALTER TABLE "public"."access_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."afl_bets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_id" bigint NOT NULL,
    "match_id" "text" NOT NULL,
    "picked_winner" "text" NOT NULL,
    "tier_id" "text" NOT NULL,
    "is_correct" boolean,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."afl_bets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_ips" (
    "id" bigint NOT NULL,
    "ip" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."blocked_ips" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."blocked_ips_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."blocked_ips_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."blocked_ips_id_seq" OWNED BY "public"."blocked_ips"."id";



CREATE TABLE IF NOT EXISTS "public"."blocked_telegram_ids" (
    "telegram_id" bigint NOT NULL,
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text"
);


ALTER TABLE "public"."blocked_telegram_ids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."donations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid",
    "amount" numeric NOT NULL,
    "asset_code" "text" DEFAULT 'CRYPTOBANK'::"text" NOT NULL,
    "donation_type" "text" NOT NULL,
    "donation_target" "text",
    "stellar_tx_hash" "text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "donations_donation_type_check" CHECK (("donation_type" = ANY (ARRAY['general'::"text", 'team'::"text", 'player'::"text"])))
);


ALTER TABLE "public"."donations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funding_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_xlm" numeric DEFAULT 100000 NOT NULL,
    "milestones" "jsonb" DEFAULT '[{"pct": 25, "label": "Early Bird", "description": "First quarter of funding reached"}, {"pct": 50, "label": "Halfway", "description": "Halfway to the homecoming goal"}, {"pct": 75, "label": "Final Push", "description": "Community is almost there"}, {"pct": 100, "label": "Sold Out", "description": "The homecoming is fully funded"}]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."funding_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid",
    "telegram_id" bigint,
    "kicks" integer DEFAULT 0 NOT NULL,
    "balls_spawned" integer DEFAULT 0 NOT NULL,
    "duration_seconds" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."game_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."game_aggregate" AS
 SELECT "count"(*) AS "total_sessions",
    COALESCE("sum"("kicks"), (0)::bigint) AS "total_kicks",
    COALESCE("sum"("balls_spawned"), (0)::bigint) AS "total_balls",
    COALESCE("max"("kicks"), 0) AS "high_score",
    "count"(DISTINCT "telegram_id") AS "unique_players"
   FROM "public"."game_sessions";


ALTER VIEW "public"."game_aggregate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_id" bigint NOT NULL,
    "telegram_username" "text",
    "telegram_first_name" "text",
    "telegram_photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "opt_in_telegram_notifications" boolean DEFAULT false NOT NULL,
    "favorite_team" "text",
    "display_preference" "text" DEFAULT 'address'::"text" NOT NULL,
    "telegram_phone" "text",
    "is_blocked" boolean DEFAULT false NOT NULL,
    "referred_by" bigint,
    "quiz_points" integer DEFAULT 0 NOT NULL,
    "bonus_balls" integer DEFAULT 0 NOT NULL,
    "bonus_spins" integer DEFAULT 0 NOT NULL,
    "favorite_wafl_team" "text",
    "read_broadcast_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "users_display_preference_check" CHECK (("display_preference" = ANY (ARRAY['address'::"text", 'name'::"text", 'username'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Telegram users who have accessed the app';



CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stellar_address" "text" NOT NULL,
    "label" "text" DEFAULT 'Legacy Wallet'::"text",
    "is_primary" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_connected_at" timestamp with time zone
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


COMMENT ON TABLE "public"."wallets" IS 'Stellar wallets connected by users';



CREATE OR REPLACE VIEW "public"."game_leaderboard" AS
 SELECT "gs"."telegram_id",
    "u"."telegram_username",
    "u"."telegram_first_name",
    "u"."display_preference",
    "w"."stellar_address",
    "sum"("gs"."kicks") AS "kicks",
    "sum"("gs"."balls_spawned") AS "balls_spawned",
    "sum"("gs"."duration_seconds") AS "duration_seconds"
   FROM (("public"."game_sessions" "gs"
     LEFT JOIN "public"."users" "u" ON (("u"."telegram_id" = "gs"."telegram_id")))
     LEFT JOIN "public"."wallets" "w" ON (("w"."user_id" = "u"."id")))
  WHERE ("gs"."telegram_id" IS NOT NULL)
  GROUP BY "gs"."telegram_id", "u"."telegram_username", "u"."telegram_first_name", "u"."display_preference", "w"."stellar_address"
  ORDER BY ("sum"("gs"."kicks")) DESC
 LIMIT 10;


ALTER VIEW "public"."game_leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_spin_counters" (
    "telegram_id" bigint NOT NULL,
    "source" "text" NOT NULL,
    "day" "date" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."game_spin_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lucky_draw_wins" (
    "id" bigint NOT NULL,
    "telegram_id" bigint NOT NULL,
    "prize" "text" NOT NULL,
    "amount" integer,
    "win_code" "text" NOT NULL,
    "wallet_address" "text",
    "claimed" boolean DEFAULT false NOT NULL,
    "claimed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payout_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payout_tx_hash" "text",
    "payout_notes" "text",
    "payout_at" timestamp with time zone,
    "paid_by" "text",
    "prize_source" "text" DEFAULT 'lucky_draw'::"text" NOT NULL,
    CONSTRAINT "lucky_draw_wins_payout_status_check" CHECK (("payout_status" = ANY (ARRAY['pending'::"text", 'paying'::"text", 'paid'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."lucky_draw_wins" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lucky_draw_wins_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lucky_draw_wins_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lucky_draw_wins_id_seq" OWNED BY "public"."lucky_draw_wins"."id";



CREATE TABLE IF NOT EXISTS "public"."movement_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "total_funding" numeric(20,7) DEFAULT 0,
    "target_funding" numeric(20,7) DEFAULT 3000000,
    "monthly_data" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."movement_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_id" bigint,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid",
    "xlm_amount" numeric NOT NULL,
    "token_amount" numeric NOT NULL,
    "stellar_tx_hash" "text",
    "purchase_type" "text" NOT NULL,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "purchases_purchase_type_check" CHECK (("purchase_type" = ANY (ARRAY['direct'::"text", 'lobstr'::"text", 'scopuly'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question" "text" NOT NULL,
    "option_a" "text" NOT NULL,
    "option_b" "text" NOT NULL,
    "option_c" "text" NOT NULL,
    "option_d" "text" NOT NULL,
    "correct_option" "text" NOT NULL,
    "explanation" "text",
    "category" "text" DEFAULT 'afl'::"text" NOT NULL,
    "difficulty" "text" DEFAULT 'medium'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quiz_questions_category_check" CHECK (("category" = ANY (ARRAY['afl'::"text", 'wafl'::"text", 'general'::"text"]))),
    CONSTRAINT "quiz_questions_correct_option_check" CHECK (("correct_option" = ANY (ARRAY['a'::"text", 'b'::"text", 'c'::"text", 'd'::"text"]))),
    CONSTRAINT "quiz_questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"])))
);


ALTER TABLE "public"."quiz_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_id" bigint NOT NULL,
    "mode" "text" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "total_questions" integer NOT NULL,
    "is_perfect" boolean DEFAULT false NOT NULL,
    "points_earned" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "question_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "answers_given" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:30:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quiz_sessions_mode_check" CHECK (("mode" = ANY (ARRAY['quick'::"text", 'standard'::"text", 'champion'::"text"]))),
    CONSTRAINT "quiz_sessions_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."quiz_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regional_support" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_name" "text" NOT NULL,
    "percentage" numeric(5,2) DEFAULT 0,
    "color" "text" NOT NULL,
    "display_order" integer DEFAULT 0
);


ALTER TABLE "public"."regional_support" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telegram_id" bigint NOT NULL,
    "requested_team" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "team_change_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."team_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "min_balance" numeric(20,7) NOT NULL,
    "max_balance" numeric(20,7),
    "color" "text" NOT NULL,
    "icon" "text",
    "perks" "jsonb" DEFAULT '[]'::"jsonb",
    "display_order" integer DEFAULT 0
);


ALTER TABLE "public"."tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."top_supporters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "hub_name" "text",
    "amount" numeric(20,7) DEFAULT 0,
    "rank" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."top_supporters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trustline_submissions" (
    "id" bigint NOT NULL,
    "ip" "text",
    "xdr" "text",
    "horizon_result" "jsonb",
    "success" boolean,
    "tx_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'trustline'::"text" NOT NULL,
    "public_key" "text",
    "error_message" "text"
);


ALTER TABLE "public"."trustline_submissions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trustline_submissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trustline_submissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trustline_submissions_id_seq" OWNED BY "public"."trustline_submissions"."id";



CREATE TABLE IF NOT EXISTS "public"."wallet_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "nsafl_balance" numeric(20,7) DEFAULT 0,
    "xlm_balance" numeric(20,7) DEFAULT 0,
    "balance_week_ago" numeric(20,7) DEFAULT 0,
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."wallet_balances" REPLICA IDENTITY FULL;


ALTER TABLE "public"."wallet_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."wallet_balances" IS 'Cached balance data from Stellar Horizon';



ALTER TABLE ONLY "public"."blocked_ips" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."blocked_ips_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lucky_draw_wins" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lucky_draw_wins_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trustline_submissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trustline_submissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."access_attempts"
    ADD CONSTRAINT "access_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afl_bets"
    ADD CONSTRAINT "afl_bets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afl_bets"
    ADD CONSTRAINT "afl_bets_telegram_id_match_id_key" UNIQUE ("telegram_id", "match_id");



ALTER TABLE ONLY "public"."blocked_ips"
    ADD CONSTRAINT "blocked_ips_ip_key" UNIQUE ("ip");



ALTER TABLE ONLY "public"."blocked_ips"
    ADD CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_telegram_ids"
    ADD CONSTRAINT "blocked_telegram_ids_pkey" PRIMARY KEY ("telegram_id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funding_config"
    ADD CONSTRAINT "funding_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_sessions"
    ADD CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_spin_counters"
    ADD CONSTRAINT "game_spin_counters_pkey" PRIMARY KEY ("telegram_id", "source", "day");



ALTER TABLE ONLY "public"."lucky_draw_wins"
    ADD CONSTRAINT "lucky_draw_wins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lucky_draw_wins"
    ADD CONSTRAINT "lucky_draw_wins_win_code_key" UNIQUE ("win_code");



ALTER TABLE ONLY "public"."movement_stats"
    ADD CONSTRAINT "movement_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regional_support"
    ADD CONSTRAINT "regional_support_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_change_requests"
    ADD CONSTRAINT "team_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."top_supporters"
    ADD CONSTRAINT "top_supporters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trustline_submissions"
    ADD CONSTRAINT "trustline_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_telegram_id_key" UNIQUE ("telegram_id");



ALTER TABLE ONLY "public"."wallet_balances"
    ADD CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_balances"
    ADD CONSTRAINT "wallet_balances_wallet_id_key" UNIQUE ("wallet_id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_stellar_address_key" UNIQUE ("user_id", "stellar_address");



CREATE INDEX "blocked_ips_ip_idx" ON "public"."blocked_ips" USING "btree" ("ip");



CREATE UNIQUE INDEX "donations_stellar_tx_hash_key" ON "public"."donations" USING "btree" ("stellar_tx_hash") WHERE ("stellar_tx_hash" IS NOT NULL);



CREATE INDEX "game_sessions_created_at_idx" ON "public"."game_sessions" USING "btree" ("created_at" DESC);



CREATE INDEX "game_sessions_kicks_idx" ON "public"."game_sessions" USING "btree" ("kicks" DESC);



CREATE INDEX "game_sessions_telegram_id_idx" ON "public"."game_sessions" USING "btree" ("telegram_id");



CREATE INDEX "idx_afl_bets_match_id" ON "public"."afl_bets" USING "btree" ("match_id");



CREATE INDEX "idx_afl_bets_tier_id" ON "public"."afl_bets" USING "btree" ("tier_id");



CREATE INDEX "idx_donations_verified" ON "public"."donations" USING "btree" ("verified");



CREATE INDEX "idx_donations_wallet_id" ON "public"."donations" USING "btree" ("wallet_id");



CREATE INDEX "idx_purchases_wallet_id" ON "public"."purchases" USING "btree" ("wallet_id");



CREATE INDEX "idx_users_referred_by" ON "public"."users" USING "btree" ("referred_by");



CREATE INDEX "idx_users_telegram_id" ON "public"."users" USING "btree" ("telegram_id");



CREATE UNIQUE INDEX "idx_wallet_balances_wallet_id" ON "public"."wallet_balances" USING "btree" ("wallet_id");



CREATE INDEX "idx_wallets_stellar" ON "public"."wallets" USING "btree" ("stellar_address");



CREATE UNIQUE INDEX "idx_wallets_user_primary" ON "public"."wallets" USING "btree" ("user_id") WHERE ("is_primary" = true);



CREATE INDEX "lucky_draw_wins_payout_status_idx" ON "public"."lucky_draw_wins" USING "btree" ("payout_status");



CREATE INDEX "lucky_draw_wins_telegram_id_idx" ON "public"."lucky_draw_wins" USING "btree" ("telegram_id");



CREATE INDEX "lucky_draw_wins_win_code_idx" ON "public"."lucky_draw_wins" USING "btree" ("win_code");



CREATE INDEX "quiz_sessions_mode_date_idx" ON "public"."quiz_sessions" USING "btree" ("telegram_id", "mode", "created_at");



CREATE INDEX "quiz_sessions_telegram_id_idx" ON "public"."quiz_sessions" USING "btree" ("telegram_id");



CREATE INDEX "team_change_requests_telegram_id_status_idx" ON "public"."team_change_requests" USING "btree" ("telegram_id", "status");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_sessions"
    ADD CONSTRAINT "game_sessions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_telegram_id_fkey" FOREIGN KEY ("telegram_id") REFERENCES "public"."users"("telegram_id");



ALTER TABLE ONLY "public"."team_change_requests"
    ADD CONSTRAINT "team_change_requests_telegram_id_fkey" FOREIGN KEY ("telegram_id") REFERENCES "public"."users"("telegram_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_balances"
    ADD CONSTRAINT "wallet_balances_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Public read movement_stats" ON "public"."movement_stats" FOR SELECT USING (true);



CREATE POLICY "Public read regional_support" ON "public"."regional_support" FOR SELECT USING (true);



CREATE POLICY "Public read tiers" ON "public"."tiers" FOR SELECT USING (true);



CREATE POLICY "Public read top_supporters" ON "public"."top_supporters" FOR SELECT USING (true);



CREATE POLICY "Service role manages balances" ON "public"."wallet_balances" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages users" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages wallets" ON "public"."wallets" USING (true) WITH CHECK (true);



ALTER TABLE "public"."access_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."afl_bets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_ips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_telegram_ids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."donations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funding_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lucky_draw_wins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movement_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read afl_bets" ON "public"."afl_bets" FOR SELECT USING (true);



CREATE POLICY "public read funding_config" ON "public"."funding_config" FOR SELECT USING (true);



ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regional_support" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."top_supporters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trustline_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users insert own bets" ON "public"."afl_bets" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."wallet_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_daily_spin"("p_telegram_id" bigint, "p_source" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_daily_spin"("p_telegram_id" bigint, "p_source" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_daily_spin"("p_telegram_id" bigint, "p_source" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."access_attempts" TO "anon";
GRANT ALL ON TABLE "public"."access_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."access_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."afl_bets" TO "anon";
GRANT ALL ON TABLE "public"."afl_bets" TO "authenticated";
GRANT ALL ON TABLE "public"."afl_bets" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_ips" TO "anon";
GRANT ALL ON TABLE "public"."blocked_ips" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_ips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."blocked_ips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."blocked_ips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."blocked_ips_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_telegram_ids" TO "anon";
GRANT ALL ON TABLE "public"."blocked_telegram_ids" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_telegram_ids" TO "service_role";



GRANT ALL ON TABLE "public"."donations" TO "anon";
GRANT ALL ON TABLE "public"."donations" TO "authenticated";
GRANT ALL ON TABLE "public"."donations" TO "service_role";



GRANT ALL ON TABLE "public"."funding_config" TO "anon";
GRANT ALL ON TABLE "public"."funding_config" TO "authenticated";
GRANT ALL ON TABLE "public"."funding_config" TO "service_role";



GRANT ALL ON TABLE "public"."game_sessions" TO "anon";
GRANT ALL ON TABLE "public"."game_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."game_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."game_aggregate" TO "anon";
GRANT ALL ON TABLE "public"."game_aggregate" TO "authenticated";
GRANT ALL ON TABLE "public"."game_aggregate" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."game_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."game_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."game_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."game_spin_counters" TO "anon";
GRANT ALL ON TABLE "public"."game_spin_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."game_spin_counters" TO "service_role";



GRANT ALL ON TABLE "public"."lucky_draw_wins" TO "anon";
GRANT ALL ON TABLE "public"."lucky_draw_wins" TO "authenticated";
GRANT ALL ON TABLE "public"."lucky_draw_wins" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lucky_draw_wins_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lucky_draw_wins_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lucky_draw_wins_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."movement_stats" TO "anon";
GRANT ALL ON TABLE "public"."movement_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."movement_stats" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_questions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_questions" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_sessions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."regional_support" TO "anon";
GRANT ALL ON TABLE "public"."regional_support" TO "authenticated";
GRANT ALL ON TABLE "public"."regional_support" TO "service_role";



GRANT ALL ON TABLE "public"."team_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."team_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."team_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."tiers" TO "anon";
GRANT ALL ON TABLE "public"."tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."tiers" TO "service_role";



GRANT ALL ON TABLE "public"."top_supporters" TO "anon";
GRANT ALL ON TABLE "public"."top_supporters" TO "authenticated";
GRANT ALL ON TABLE "public"."top_supporters" TO "service_role";



GRANT ALL ON TABLE "public"."trustline_submissions" TO "anon";
GRANT ALL ON TABLE "public"."trustline_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."trustline_submissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trustline_submissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trustline_submissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trustline_submissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_balances" TO "anon";
GRANT ALL ON TABLE "public"."wallet_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_balances" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







