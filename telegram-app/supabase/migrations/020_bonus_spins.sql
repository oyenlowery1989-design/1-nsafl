-- Add bonus_spins column to users table
-- Admin-granted additional daily Lucky Draw spins
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_spins integer NOT NULL DEFAULT 0;
