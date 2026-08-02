-- current_date used the DB session's timezone, not necessarily UTC.
-- Pin the daily boundary to UTC explicitly so it can't drift with session config.
create or replace function consume_daily_spin(p_telegram_id bigint, p_source text, p_limit int)
returns boolean
language plpgsql
as $$
declare
  updated int;
  today date := (now() at time zone 'utc')::date;
begin
  insert into game_spin_counters (telegram_id, source, day, count)
  values (p_telegram_id, p_source, today, 0)
  on conflict (telegram_id, source, day) do nothing;

  update game_spin_counters
     set count = count + 1
   where telegram_id = p_telegram_id and source = p_source and day = today
     and count < p_limit;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;
