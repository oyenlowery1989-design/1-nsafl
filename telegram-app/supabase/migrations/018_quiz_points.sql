alter table users
  add column if not exists quiz_points integer not null default 0;

alter table lucky_draw_wins
  add column if not exists prize_source text not null default 'lucky_draw';
