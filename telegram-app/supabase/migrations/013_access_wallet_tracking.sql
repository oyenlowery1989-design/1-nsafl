-- Migration 013: Enhanced access tracking + wallet connection history

-- Add Telegram identity fields to access_attempts
ALTER TABLE access_attempts
  ADD COLUMN IF NOT EXISTS telegram_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_first_name text;

-- Store phone number on users (collected via Telegram requestContact if user consents)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_phone text;

-- Add last_connected_at to wallets so we can see when each address was last used
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz;

-- Backfill last_connected_at with created_at for existing rows
UPDATE wallets SET last_connected_at = created_at WHERE last_connected_at IS NULL;
