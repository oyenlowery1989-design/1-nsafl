create table if not exists quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users(telegram_id),
  mode text not null check (mode in ('quick','standard','champion')),
  score integer not null default 0,
  correct_count integer not null default 0,
  total_questions integer not null,
  is_perfect boolean not null default false,
  points_earned integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  question_ids uuid[] not null default '{}',
  answers_given jsonb not null default '{}',
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists quiz_sessions_telegram_id_idx on quiz_sessions(telegram_id);
create index if not exists quiz_sessions_mode_date_idx on quiz_sessions(telegram_id, mode, created_at);
