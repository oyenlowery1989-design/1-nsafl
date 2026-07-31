-- Enforce one donation row per Stellar tx hash at the DB level.
-- The API already does a check-then-insert guard, which is racy under concurrent
-- submits of the same txHash; this unique index is the authoritative guard.
create unique index if not exists donations_stellar_tx_hash_key
  on donations (stellar_tx_hash)
  where stellar_tx_hash is not null;
