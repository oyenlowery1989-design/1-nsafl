-- Per-user tracking of read broadcast notifications (telegram_id is null on broadcast rows)
alter table users add column if not exists read_broadcast_ids jsonb not null default '[]';
