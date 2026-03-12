create table if not exists lucky_draw_wins (
  id            bigserial primary key,
  telegram_id   bigint not null,
  prize         text not null,
  amount        integer,
  win_code      text not null unique,
  wallet_address text,
  claimed       boolean not null default false,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists lucky_draw_wins_telegram_id_idx on lucky_draw_wins(telegram_id);
create index if not exists lucky_draw_wins_win_code_idx on lucky_draw_wins(win_code);
