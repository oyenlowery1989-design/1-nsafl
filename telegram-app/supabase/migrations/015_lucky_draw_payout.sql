alter table lucky_draw_wins
  add column if not exists payout_status  text not null default 'pending'
    check (payout_status in ('pending', 'paid', 'skipped')),
  add column if not exists payout_tx_hash text,
  add column if not exists payout_notes   text,
  add column if not exists payout_at      timestamptz,
  add column if not exists paid_by        text;

create index if not exists lucky_draw_wins_payout_status_idx
  on lucky_draw_wins(payout_status);
