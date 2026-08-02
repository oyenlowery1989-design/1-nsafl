-- Seed 3 welcome spins for existing Tier 0 users who haven't played yet.
-- Tier 0 = no wallet_balances row with nsafl_balance >= 100.
-- "Haven't played" = no rows in lucky_draw_wins for their telegram_id.

UPDATE users u
SET bonus_spins = 3
WHERE u.bonus_spins = 0
  AND NOT EXISTS (
    SELECT 1 FROM lucky_draw_wins w WHERE w.telegram_id = u.telegram_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM wallets wl
    JOIN wallet_balances wb ON wb.wallet_id = wl.id
    WHERE wl.user_id = u.id
      AND wl.is_primary = true
      AND wb.nsafl_balance >= 100
  );
