-- Add bonus_balls column to users table
-- Stores admin-granted bonus balls + Lucky Draw ball wins (server-side source of truth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balls integer NOT NULL DEFAULT 0;
