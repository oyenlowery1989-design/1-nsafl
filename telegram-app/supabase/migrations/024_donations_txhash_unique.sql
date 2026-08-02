-- Enforce one donation row per Stellar tx hash at the DB level.
-- The API already does a check-then-insert guard, which is racy under concurrent
-- submits of the same txHash; this unique index is the authoritative guard.

-- Dedup existing rows first so the unique index below can't fail on legacy duplicates.
-- Keeps the oldest row (lowest id) per hash.
delete from donations a
using donations b
where a.stellar_tx_hash is not null
  and a.stellar_tx_hash = b.stellar_tx_hash
  and a.id > b.id;

create unique index if not exists donations_stellar_tx_hash_key
  on donations (stellar_tx_hash)
  where stellar_tx_hash is not null;
