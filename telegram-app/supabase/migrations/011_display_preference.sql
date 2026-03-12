-- Add display_preference to users table
-- Controls how a user appears in public leaderboards and stats
-- 'address' = show truncated stellar address (default, private)
-- 'name'    = show Telegram first name
-- 'username'= show Telegram @username (only if set)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_preference text NOT NULL DEFAULT 'address'
    CHECK (display_preference IN ('address', 'name', 'username'));

-- Recreate game_leaderboard view to include display_preference + stellar_address
DROP VIEW IF EXISTS game_leaderboard;
CREATE VIEW game_leaderboard AS
SELECT
  gs.telegram_id,
  u.telegram_username,
  u.telegram_first_name,
  u.display_preference,
  w.stellar_address,
  SUM(gs.kicks)           AS kicks,
  SUM(gs.balls_spawned)   AS balls_spawned,
  SUM(gs.duration_seconds)AS duration_seconds
FROM game_sessions gs
LEFT JOIN users u ON u.telegram_id = gs.telegram_id
LEFT JOIN wallets w ON w.user_id = u.id
GROUP BY gs.telegram_id, u.telegram_username, u.telegram_first_name, u.display_preference, w.stellar_address
ORDER BY kicks DESC
LIMIT 10;
