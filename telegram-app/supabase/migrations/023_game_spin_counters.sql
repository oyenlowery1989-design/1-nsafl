create table if not exists game_spin_counters (
  telegram_id bigint not null,
  source text not null,
  day date not null,
  count int not null default 0,
  primary key (telegram_id, source, day)
);

create or replace function consume_daily_spin(p_telegram_id bigint, p_source text, p_limit int)
returns boolean
language plpgsql
as $$
declare
  updated int;
begin
  insert into game_spin_counters (telegram_id, source, day, count)
  values (p_telegram_id, p_source, current_date, 0)
  on conflict (telegram_id, source, day) do nothing;

  update game_spin_counters
     set count = count + 1
   where telegram_id = p_telegram_id and source = p_source and day = current_date
     and count < p_limit;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;
