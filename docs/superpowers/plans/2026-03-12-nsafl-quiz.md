# NSAFL Quiz Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AFL/WAFL trivia quiz game to the `/game` hub with server-validated answers, 3 game modes, points rewards, and a perfect-round prize draw.

**Architecture:** Quiz lives entirely within the existing `/game` route by extending `GameView` type to `'hub' | 'playing' | 'lucky' | 'quiz-pick' | 'quiz'`. DB session row locks the question set and tracks answers server-side to prevent cheating. Points stored in new `users.quiz_points` column.

**Tech Stack:** Next.js 16 App Router, Supabase (service client), TypeScript, Tailwind v4, `ok()`/`fail()` API helpers, `verifyAdminToken` for admin routes, `getTelegramInitData()` for player routes.

---

## Chunk 0: Prerequisites

### Task 0: Install nanoid + add parseTelegramUser helper

**Files:**
- Modify: `telegram-app/lib/telegram.ts`

- [ ] Install nanoid: `cd telegram-app && npm install nanoid`

- [ ] Add `parseTelegramUser` to `lib/telegram.ts` (check it doesn't already exist first):

```ts
export function parseTelegramUser(initData: string): { id: number; first_name?: string; username?: string } | null {
  try {
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(decodeURIComponent(userStr))
  } catch {
    return null
  }
}
```

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `git add -A && git commit -m "chore: add parseTelegramUser helper + nanoid"`

---

## Chunk 1: Database Migrations

### Task 1: Migration 016 — quiz_questions table + seed data

**Files:**
- Create: `telegram-app/supabase/migrations/016_quiz_questions.sql`

- [ ] Create the file with table DDL + 30 seed questions:

```sql
-- 016_quiz_questions.sql
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  explanation text,
  category text not null default 'afl' check (category in ('afl','wafl','general')),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed: 30 AFL/WAFL questions
insert into quiz_questions (question, option_a, option_b, option_c, option_d, correct_option, explanation, category, difficulty) values
-- Easy AFL
('How many players are on the field per team in AFL?', '16', '18', '20', '22', 'b', 'Each AFL team fields 18 players.', 'afl', 'easy'),
('What shape is an AFL football?', 'Round', 'Oval', 'Square', 'Hexagonal', 'b', 'AFL uses an oval-shaped ball.', 'afl', 'easy'),
('How many points is a goal worth in AFL?', '4', '6', '3', '5', 'b', 'A goal scores 6 points.', 'afl', 'easy'),
('How many points is a behind worth in AFL?', '1', '2', '3', '4', 'a', 'A behind scores 1 point.', 'afl', 'easy'),
('Which team is known as "The Magpies"?', 'Richmond', 'Collingwood', 'Carlton', 'Essendon', 'b', 'Collingwood are nicknamed The Magpies.', 'afl', 'easy'),
('Which team is known as "The Bombers"?', 'Hawthorn', 'West Coast', 'Essendon', 'Fremantle', 'c', 'Essendon are nicknamed The Bombers.', 'afl', 'easy'),
('In what year was the AFL (then VFL) founded?', '1877', '1897', '1920', '1960', 'a', 'The VFL was founded in 1877.', 'afl', 'easy'),
-- Medium AFL
('Which club has won the most AFL/VFL premierships?', 'Collingwood', 'Carlton', 'Essendon', 'Hawthorn', 'b', 'Carlton has won 16 VFL/AFL premierships.', 'afl', 'medium'),
('What is the name of the AFL Grand Final venue?', 'Optus Stadium', 'MCG', 'Adelaide Oval', 'Gabba', 'b', 'The AFL Grand Final is traditionally held at the MCG.', 'afl', 'medium'),
('How long is each quarter in AFL?', '15 minutes', '20 minutes', 'Time-on applies, typically ~25–30 minutes', '12 minutes', 'c', 'Quarters are 20 minutes plus time-on.', 'afl', 'medium'),
('What is the "Brownlow Medal" awarded for?', 'Best and fairest player', 'Leading goalkicker', 'Best young player', 'Grand Final MVP', 'a', 'The Brownlow Medal goes to the fairest and best player as voted by umpires.', 'afl', 'medium'),
('Which AFL club is nicknamed "The Hawks"?', 'West Coast', 'GWS Giants', 'Hawthorn', 'Gold Coast', 'c', 'Hawthorn are nicknamed The Hawks.', 'afl', 'medium'),
('What year did the Brisbane Lions last win a premiership?', '2002', '2003', '2009', '2011', 'b', 'Brisbane Lions won back-to-back-to-back from 2001–2003, with 2003 being their last.', 'afl', 'medium'),
('What is the "Coleman Medal" awarded for?', 'Best ruckman', 'Leading goalkicker', 'Best first-year player', 'Best defender', 'b', 'The Coleman Medal goes to the AFL season''s leading goalkicker.', 'afl', 'medium'),
('Which team plays home games at Optus Stadium?', 'Fremantle only', 'West Coast only', 'Both Fremantle and West Coast', 'GWS Giants', 'c', 'Both Fremantle Dockers and West Coast Eagles share Optus Stadium.', 'afl', 'medium'),
('What does "HTB" stand for in AFL?', 'Hit The Ball', 'Holding The Ball', 'High To Back', 'Hand To Body', 'b', 'HTB is the "Holding The Ball" free kick rule.', 'afl', 'medium'),
('Which player won the most Brownlow Medals?', 'Gary Ablett Jnr', 'Bob Skilton', 'Dick Reynolds', 'All equal on 3', 'd', 'Bob Skilton, Dick Reynolds, and Haydn Bunton each won 3 Brownlows.', 'afl', 'medium'),
-- Hard AFL
('What is the record for most goals in an AFL/VFL game by one player?', '16', '17', '18', '20', 'c', 'Fred Fanning kicked 18 goals for Melbourne against St Kilda in 1947 — the all-time VFL/AFL record.', 'afl', 'hard'),
('Which year did the South Melbourne Football Club relocate to become the Sydney Swans?', '1980', '1981', '1982', '1983', 'c', 'South Melbourne relocated to Sydney in 1982.', 'afl', 'hard'),
('What is the name of the trophy awarded to the AFL premiership winner?', 'The Cup', 'Premiership Cup', 'The Norm Smith Medal', 'The Flag', 'b', 'The winner receives the AFL Premiership Cup.', 'afl', 'hard'),
('Which AFL ground has the largest capacity?', 'MCG', 'Optus Stadium', 'Adelaide Oval', 'Marvel Stadium', 'a', 'The MCG has a capacity of approximately 100,024.', 'afl', 'hard'),
('In AFL, how many players can be on the interchange bench?', '3', '4', '5', '6', 'b', 'Teams can have 4 players on the interchange bench.', 'afl', 'hard'),
-- WAFL
('Which team is the most successful in WAFL history by premierships?', 'East Fremantle', 'Subiaco', 'Claremont', 'South Fremantle', 'a', 'East Fremantle has won the most WAFL premierships.', 'wafl', 'medium'),
('What does WAFL stand for?', 'Western Australian Football League', 'West Australian Football League', 'Western AFL', 'WA Football League', 'b', 'WAFL stands for West Australian Football League.', 'wafl', 'easy'),
('Which WAFL club is nicknamed "The Lions"?', 'Subiaco', 'East Fremantle', 'Swan Districts', 'Perth', 'a', 'Subiaco are nicknamed The Lions.', 'wafl', 'easy'),
('At which ground do the WAFL Grand Finals traditionally take place?', 'Optus Stadium', 'Domain Stadium', 'Fremantle Oval', 'Medibank Stadium', 'a', 'WAFL Grand Finals are held at Optus Stadium.', 'wafl', 'medium'),
('Which WAFL club is based in the northern suburbs of Perth?', 'Swan Districts', 'Peel Thunder', 'Subiaco', 'Claremont', 'a', 'Swan Districts are based in the northern suburbs of Perth.', 'wafl', 'medium'),
('How many clubs currently compete in the WAFL?', '8', '9', '10', '12', 'c', 'There are 10 clubs in the WAFL.', 'wafl', 'easy'),
-- General
('What is the Heisman Trophy equivalent in Australian Rules Football called?', 'Brownlow Medal', 'Norm Smith Medal', 'Coleman Medal', 'AFLPA MVP', 'a', 'The Brownlow Medal is the most prestigious individual award in AFL.', 'general', 'medium'),
('Which country hosted the first official international AFL game?', 'USA', 'Ireland', 'UK', 'Canada', 'b', 'The first international AFL game was played in Ireland (Compromise Rules).', 'general', 'hard');
```

- [ ] Apply via Supabase MCP:
  - Run `mcp__claude_ai_Supabase__apply_migration` with project `vrqlxguhfndrqiipisyi` and the SQL above
- [ ] Verify table exists: `select count(*) from quiz_questions;` — expect 30

---

### Task 2: Migration 017 — quiz_sessions table

**Files:**
- Create: `telegram-app/supabase/migrations/017_quiz_sessions.sql`

- [ ] Create file:

```sql
-- 017_quiz_sessions.sql
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
```

- [ ] Apply via Supabase MCP
- [ ] Verify: `select count(*) from quiz_sessions;` — expect 0

---

### Task 3: Migration 018 — quiz_points on users + prize_source on lucky_draw_wins

**Files:**
- Create: `telegram-app/supabase/migrations/018_quiz_points.sql`

- [ ] Create file:

```sql
-- 018_quiz_points.sql
alter table users
  add column if not exists quiz_points integer not null default 0;

alter table lucky_draw_wins
  add column if not exists prize_source text not null default 'lucky_draw';
```

- [ ] Apply via Supabase MCP
- [ ] Verify: `select quiz_points from users limit 1;` — should work without error

---

## Chunk 2: API Routes

### Task 4: GET /api/quiz/session — start a session

**Files:**
- Create: `telegram-app/app/api/quiz/session/route.ts`

- [ ] Create the file:

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'

const MODE_Q: Record<string, number> = { quick: 5, standard: 10, champion: 20 }
const DAILY_LIMIT = 3
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  let telegramId: number

  if (DEV_BYPASS && !initData) {
    telegramId = 0
  } else {
    const valid = validateTelegramInitData(initData, BOT_TOKEN)
    if (!valid) return fail('Unauthorized', 'UNAUTHORIZED', 401)
    const user = parseTelegramUser(initData)
    if (!user) return fail('No user', 'NO_USER', 400)
    telegramId = user.id
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? 'quick'
  if (!MODE_Q[mode]) return fail('Invalid mode', 'INVALID_MODE', 400)
  const numQ = MODE_Q[mode]

  const supabase = createServiceClient()

  // Daily limit check
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await (supabase as any)
    .from('quiz_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('mode', mode)
    .neq('status', 'abandoned')
    .gte('created_at', today.toISOString())

  const used = count ?? 0
  if (used >= DAILY_LIMIT) {
    return fail(`Daily limit reached (${DAILY_LIMIT} plays per mode per day)`, 'DAILY_LIMIT', 429)
  }

  // Pick random active questions
  const { data: allQ } = await (supabase as any)
    .from('quiz_questions')
    .select('id, question, option_a, option_b, option_c, option_d, category, difficulty')
    .eq('active', true)

  if (!allQ || allQ.length < numQ) {
    return fail('Not enough questions available', 'INSUFFICIENT_QUESTIONS', 503)
  }

  // Fisher-Yates shuffle + take numQ
  const shuffled = [...allQ]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const questions = shuffled.slice(0, numQ)
  const questionIds = questions.map((q: { id: string }) => q.id)

  // Create session row
  const { data: session, error } = await (supabase as any)
    .from('quiz_sessions')
    .insert({
      telegram_id: telegramId,
      mode,
      total_questions: numQ,
      question_ids: questionIds,
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (error || !session) return fail('Failed to create session', 'DB_ERROR', 500)

  return ok({
    sessionId: session.id,
    mode,
    playsUsedToday: used + 1,
    playsRemainingToday: DAILY_LIMIT - used - 1,
    questions, // NO correct_option field — stripped by select
  })
}
```

- [ ] Verify `parseTelegramUser` exists in `lib/telegram.ts` — if not, add it:

```ts
// In lib/telegram.ts — add if missing:
export function parseTelegramUser(initData: string): { id: number; first_name?: string; username?: string } | null {
  try {
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(decodeURIComponent(userStr))
  } catch {
    return null
  }
}
```

- [ ] `npx tsc --noEmit` — 0 errors

---

### Task 5: POST /api/quiz/answer — server-validate one answer

**Files:**
- Create: `telegram-app/app/api/quiz/answer/route.ts`

- [ ] Create file:

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  let telegramId: number

  if (DEV_BYPASS && !initData) {
    telegramId = 0
  } else {
    const valid = validateTelegramInitData(initData, BOT_TOKEN)
    if (!valid) return fail('Unauthorized', 'UNAUTHORIZED', 401)
    const user = parseTelegramUser(initData)
    if (!user) return fail('No user', 'NO_USER', 400)
    telegramId = user.id
  }

  const body = await req.json().catch(() => null)
  if (!body?.sessionId || !body?.questionId || !body?.chosen) {
    return fail('Missing fields', 'BAD_REQUEST', 400)
  }
  const { sessionId, questionId, chosen } = body

  const supabase = createServiceClient()

  // Load session
  const { data: session } = await (supabase as any)
    .from('quiz_sessions')
    .select('telegram_id, status, question_ids, answers_given, expires_at')
    .eq('id', sessionId)
    .single()

  if (!session) return fail('Session not found', 'NOT_FOUND', 404)
  if (session.telegram_id !== telegramId) return fail('Forbidden', 'FORBIDDEN', 403)
  if (session.status !== 'in_progress') return fail('Session not active', 'SESSION_DONE', 409)
  if (new Date(session.expires_at) < new Date()) return fail('Session expired', 'EXPIRED', 410)
  if (!session.question_ids.includes(questionId)) return fail('Question not in session', 'BAD_QUESTION', 400)
  if (session.answers_given[questionId]) return fail('Already answered', 'ALREADY_ANSWERED', 409)

  // Validate answer
  const { data: q } = await (supabase as any)
    .from('quiz_questions')
    .select('correct_option, explanation')
    .eq('id', questionId)
    .single()

  if (!q) return fail('Question not found', 'NOT_FOUND', 404)

  const correct = chosen === q.correct_option

  // Update answers_given map
  const updatedAnswers = { ...session.answers_given, [questionId]: chosen }
  await (supabase as any)
    .from('quiz_sessions')
    .update({ answers_given: updatedAnswers })
    .eq('id', sessionId)

  return ok({
    correct,
    correctOption: q.correct_option,
    explanation: q.explanation ?? null,
  })
}
```

- [ ] `npx tsc --noEmit` — 0 errors

---

### Task 6: POST /api/quiz/complete — finalise session, award points + optional prize

**Files:**
- Create: `telegram-app/app/api/quiz/complete/route.ts`

- [ ] Create file. The weighted prize logic mirrors the Lucky Draw PRIZES array:

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'
import { nanoid } from 'nanoid'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

const MODE_MULT: Record<string, number> = { quick: 1, standard: 1.5, champion: 2 }
const BASE_POINTS = 10

// Same weights as Lucky Draw PRIZES (abridged — only real prizes for perfect round)
const PERFECT_PRIZES = [
  { label: '1000 XLM', prize: 'xlm', amount: '1000', asset: 'XLM', weight: 10 },
  { label: '100 XLM', prize: 'xlm', amount: '100', asset: 'XLM', weight: 20 },
  { label: '100 NSAFL', prize: 'nsafl', amount: '100', asset: 'NSAFL', weight: 30 },
  { label: '50 NSAFL', prize: 'nsafl', amount: '50', asset: 'NSAFL', weight: 40 },
  { label: '25 NSAFL', prize: 'nsafl', amount: '25', asset: 'NSAFL', weight: 50 },
  { label: '+1 Ball', prize: 'ball', amount: '1', asset: 'BALL', weight: 170 },
  { label: 'Better luck!', prize: 'none', amount: '0', asset: '', weight: 680 },
]

function pickPrize() {
  const total = PERFECT_PRIZES.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (const p of PERFECT_PRIZES) {
    r -= p.weight
    if (r <= 0) return p
  }
  return PERFECT_PRIZES[PERFECT_PRIZES.length - 1]
}

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  let telegramId: number

  if (DEV_BYPASS && !initData) {
    telegramId = 0
  } else {
    const valid = validateTelegramInitData(initData, BOT_TOKEN)
    if (!valid) return fail('Unauthorized', 'UNAUTHORIZED', 401)
    const user = parseTelegramUser(initData)
    if (!user) return fail('No user', 'NO_USER', 400)
    telegramId = user.id
  }

  const body = await req.json().catch(() => null)
  if (!body?.sessionId) return fail('Missing sessionId', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()

  const { data: session } = await (supabase as any)
    .from('quiz_sessions')
    .select('telegram_id, mode, status, question_ids, answers_given, expires_at, total_questions')
    .eq('id', body.sessionId)
    .single()

  if (!session) return fail('Session not found', 'NOT_FOUND', 404)
  if (session.telegram_id !== telegramId) return fail('Forbidden', 'FORBIDDEN', 403)
  if (session.status !== 'in_progress') return fail('Already completed', 'SESSION_DONE', 409)
  if (new Date(session.expires_at) < new Date()) return fail('Session expired', 'EXPIRED', 410)

  // Count correct answers from answers_given vs actual correct_options
  const answeredIds = Object.keys(session.answers_given)
  let correctCount = 0

  if (answeredIds.length > 0) {
    const { data: questions } = await (supabase as any)
      .from('quiz_questions')
      .select('id, correct_option')
      .in('id', answeredIds)

    for (const q of (questions ?? [])) {
      if (session.answers_given[q.id] === q.correct_option) correctCount++
    }
  }

  const mult = MODE_MULT[session.mode] ?? 1
  const pointsEarned = Math.round(correctCount * BASE_POINTS * mult)
  const isPerfect = correctCount === session.total_questions && session.total_questions > 0

  // Update session to completed
  await (supabase as any)
    .from('quiz_sessions')
    .update({
      status: 'completed',
      correct_count: correctCount,
      score: correctCount,
      is_perfect: isPerfect,
      points_earned: pointsEarned,
    })
    .eq('id', body.sessionId)

  // Award quiz_points to user
  if (pointsEarned > 0 && telegramId !== 0) {
    await (supabase as any).rpc('increment_quiz_points', {
      p_telegram_id: telegramId,
      p_points: pointsEarned,
    }).catch(() => {
      // Fallback if RPC doesn't exist yet — raw update
      supabase.from('users').select('quiz_points').eq('telegram_id', telegramId).single()
        .then(({ data }) => {
          (supabase as any).from('users').update({ quiz_points: (data?.quiz_points ?? 0) + pointsEarned }).eq('telegram_id', telegramId)
        })
    })
  }

  // Perfect round prize — server-side selection and insert
  let prize = null
  if (isPerfect && telegramId !== 0) {
    const picked = pickPrize()
    if (picked.prize !== 'none') {
      const winCode = nanoid(10).toUpperCase()
      // lucky_draw_wins columns: id, telegram_id, prize, amount (integer), win_code, wallet_address,
      //   claimed, claimed_at, created_at, payout_status (migration 015), prize_source (migration 018)
      await (supabase as any).from('lucky_draw_wins').insert({
        telegram_id: telegramId,
        prize: picked.label,         // human-readable label e.g. "100 XLM"
        amount: parseInt(picked.amount, 10) || null,
        win_code: winCode,
        payout_status: 'pending',
        prize_source: 'quiz',
      })
      prize = { label: picked.label, winCode }
    }
  }

  return ok({
    correctCount,
    totalQuestions: session.total_questions,
    pointsEarned,
    isPerfect,
    prize,
  })
}
```

**Note:** `nanoid` may need installing: `cd telegram-app && npm install nanoid`. Check if already present first with `grep -r "nanoid" package.json`.

- [ ] Check if `nanoid` is in `telegram-app/package.json`. If not: `cd telegram-app && npm install nanoid`
- [ ] Check `lucky_draw_wins` column names match what this insert uses (check migration 014). Adjust field names if needed (e.g. `telegram_id` may not exist — it may be `wallet_id` only). If wallet-only, store `telegram_id` separately or skip prize insert for now and just return `isPerfect: true`.
- [ ] `npx tsc --noEmit` — 0 errors

---

### Task 7: Admin quiz API routes

**Files:**
- Create: `telegram-app/app/api/admin/quiz/route.ts`
- Create: `telegram-app/app/api/admin/quiz/questions/route.ts`
- Create: `telegram-app/app/api/admin/quiz/questions/[id]/route.ts`

- [ ] Create `app/api/admin/quiz/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const supabase = createServiceClient()

  const [{ data: questions }, { data: sessions }, { data: topScorers }] = await Promise.all([
    (supabase as any).from('quiz_questions').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('quiz_sessions').select('id, mode, score, correct_count, total_questions, is_perfect, points_earned, status, created_at, telegram_id').eq('status', 'completed').order('created_at', { ascending: false }).limit(200),
    (supabase as any).from('quiz_sessions').select('telegram_id, points_earned').eq('status', 'completed').order('points_earned', { ascending: false }).limit(20),
  ])

  const allSessions = sessions ?? []
  const avgScore = allSessions.length
    ? Math.round((allSessions.reduce((s: number, r: { correct_count: number; total_questions: number }) => s + (r.correct_count / Math.max(r.total_questions, 1)), 0) / allSessions.length) * 100)
    : 0

  return ok({
    questions: questions ?? [],
    sessions: allSessions,
    stats: {
      totalQuestions: (questions ?? []).length,
      activeQuestions: (questions ?? []).filter((q: { active: boolean }) => q.active).length,
      totalSessions: allSessions.length,
      avgScorePct: avgScore,
    },
    topScorers: topScorers ?? [],
  })
}
```

- [ ] Create `app/api/admin/quiz/questions/route.ts` (POST to add question):

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const body = await req.json().catch(() => null)
  if (!body?.question || !body?.option_a || !body?.option_b || !body?.option_c || !body?.option_d || !body?.correct_option) {
    return fail('Missing required fields', 'BAD_REQUEST', 400)
  }
  const supabase = createServiceClient()
  const { data, error } = await (supabase as any)
    .from('quiz_questions')
    .insert({
      question: body.question,
      option_a: body.option_a,
      option_b: body.option_b,
      option_c: body.option_c,
      option_d: body.option_d,
      correct_option: body.correct_option,
      explanation: body.explanation ?? null,
      category: body.category ?? 'afl',
      difficulty: body.difficulty ?? 'medium',
    })
    .select()
    .single()
  if (error) return fail('Failed to create question', 'DB_ERROR', 500)
  return ok(data)
}
```

- [ ] Create `app/api/admin/quiz/questions/[id]/route.ts` (PATCH + DELETE):

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const body = await req.json().catch(() => null)
  if (!body) return fail('No body', 'BAD_REQUEST', 400)
  const supabase = createServiceClient()
  const { data, error } = await (supabase as any)
    .from('quiz_questions')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return fail('Failed to update', 'DB_ERROR', 500)
  return ok(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const supabase = createServiceClient()
  const { error } = await (supabase as any).from('quiz_questions').delete().eq('id', params.id)
  if (error) return fail('Failed to delete', 'DB_ERROR', 500)
  return ok({ deleted: params.id })
}
```

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `git add -A && git commit -m "feat: quiz API routes (session, answer, complete, admin)"`

---

## Chunk 3: Frontend Components

### Task 8: ModePicker component

**Files:**
- Create: `telegram-app/components/quiz/ModePicker.tsx`

- [ ] Create file:

```tsx
'use client'

export interface QuizMode {
  id: 'quick' | 'standard' | 'champion'
  label: string
  questions: number
  multiplier: string
  icon: string
  color: string
  border: string
}

export const QUIZ_MODES: QuizMode[] = [
  { id: 'quick', label: 'Quick', questions: 5, multiplier: '1×', icon: 'bolt', color: 'text-blue-300', border: 'border-blue-500/30' },
  { id: 'standard', label: 'Standard', questions: 10, multiplier: '1.5×', icon: 'sports_football', color: 'text-[#D4AF37]', border: 'border-[#D4AF37]/30' },
  { id: 'champion', label: 'Champion', questions: 20, multiplier: '2×', icon: 'emoji_events', color: 'text-purple-400', border: 'border-purple-500/30' },
]

interface Props {
  playsLeft: Record<string, number> // { quick: 2, standard: 3, champion: 1 }
  onSelect: (mode: QuizMode) => void
  onBack: () => void
}

export default function ModePicker({ playsLeft, onSelect, onBack }: Props) {
  return (
    <div className="flex flex-col min-h-dvh bg-[#0A0E1A]">
      <header className="pt-3 pb-2 px-4 sticky top-0 z-30 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white">AFL/WAFL Quiz</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 space-y-4">
        <p className="text-sm text-gray-400 text-center">Choose your challenge</p>

        {QUIZ_MODES.map((mode) => {
          const left = playsLeft[mode.id] ?? 3
          const disabled = left <= 0
          return (
            <button
              key={mode.id}
              onClick={() => !disabled && onSelect(mode)}
              disabled={disabled}
              className={`w-full rounded-2xl border p-5 text-left transition active:scale-[0.98] ${mode.border} bg-white/3 ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/6'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`material-symbols-outlined text-2xl ${mode.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{mode.icon}</span>
                  <div>
                    <p className="text-base font-bold text-white">{mode.label}</p>
                    <p className="text-xs text-gray-400">{mode.questions} questions · {mode.multiplier} points</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${disabled ? 'text-red-400' : 'text-gray-300'}`}>
                    {disabled ? 'Done for today' : `${left} left`}
                  </p>
                  <p className="text-[10px] text-gray-600">of 3 daily plays</p>
                </div>
              </div>
            </button>
          )
        })}

        <div className="glass-card rounded-2xl p-4 mt-2 space-y-1.5">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">How it works</p>
          <p className="text-xs text-gray-300">• +10 pts per correct answer × mode multiplier</p>
          <p className="text-xs text-gray-300">• 15 seconds per question</p>
          <p className="text-xs text-gray-300">• Perfect round? You enter the prize draw 🏆</p>
        </div>
      </main>
    </div>
  )
}
```

---

### Task 9: QuizSession component

**Files:**
- Create: `telegram-app/components/quiz/QuizSession.tsx`

- [ ] Create file:

```tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getTelegramInitData } from '@/lib/telegram'
import { haptic } from '@/lib/telegram-ui'
import type { QuizMode } from './ModePicker'

interface Question {
  id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  category: string
  difficulty: string
}

interface AnswerResult {
  correct: boolean
  correctOption: string
  explanation: string | null
}

interface SessionResult {
  correctCount: number
  totalQuestions: number
  pointsEarned: number
  isPerfect: boolean
  prize: { label: string; winCode: string } | null
}

interface Props {
  mode: QuizMode
  sessionId: string
  questions: Question[]
  onComplete: (result: SessionResult) => void
  onBack: () => void
}

const OPTIONS = ['a', 'b', 'c', 'd'] as const
const OPTION_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' }
const TIMER_SECONDS = 15

export default function QuizSession({ mode, sessionId, questions, onComplete, onBack }: Props) {
  const [qIdx, setQIdx] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [streak, setStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answeredRef = useRef(false)

  const currentQ = questions[qIdx]
  const isLast = qIdx === questions.length - 1

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const submitAnswer = useCallback(async (pick: string) => {
    if (answeredRef.current || loading) return
    answeredRef.current = true
    stopTimer()
    setChosen(pick)
    setLoading(true)
    haptic.light()

    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTelegramInitData(),
        },
        body: JSON.stringify({ sessionId, questionId: currentQ.id, chosen: pick }),
      })
      const json = await res.json()
      const data = json.data ?? json
      setResult(data)
      if (data.correct) {
        setCorrectCount(c => c + 1)
        setStreak(s => s + 1)
        haptic.success()
      } else {
        setStreak(0)
        haptic.error()
      }
    } catch {
      setResult({ correct: false, correctOption: '', explanation: null })
    } finally {
      setLoading(false)
    }
  }, [sessionId, currentQ, loading, stopTimer])

  // Timer
  useEffect(() => {
    setTimeLeft(TIMER_SECONDS)
    answeredRef.current = false
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          submitAnswer('_timeout')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return stopTimer
  }, [qIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = async () => {
    if (isLast) {
      // Complete session
      try {
        const res = await fetch('/api/quiz/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTelegramInitData(),
          },
          body: JSON.stringify({ sessionId }),
        })
        const json = await res.json()
        onComplete(json.data ?? json)
      } catch {
        onComplete({ correctCount, totalQuestions: questions.length, pointsEarned: 0, isPerfect: false, prize: null })
      }
    } else {
      setQIdx(i => i + 1)
      setChosen(null)
      setResult(null)
    }
  }

  const pct = ((qIdx) / questions.length) * 100
  const timerPct = (timeLeft / TIMER_SECONDS) * 100

  const optionStyle = (opt: string) => {
    if (!result) return 'border-white/10 bg-white/3 hover:bg-white/8 text-white'
    if (opt === result.correctOption) return 'border-green-500 bg-green-500/15 text-green-300'
    if (opt === chosen && !result.correct) return 'border-red-500 bg-red-500/15 text-red-300'
    return 'border-white/5 bg-white/2 text-gray-500'
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#0A0E1A]">
      {/* Header */}
      <header className="pt-3 pb-2 px-4 sticky top-0 z-30 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
              <span className="material-symbols-outlined text-white text-lg">close</span>
            </button>
            <p className="text-sm font-bold text-white">{mode.label} Quiz</p>
          </div>
          <div className="flex items-center space-x-3">
            {streak >= 2 && (
              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30">
                <span className="material-symbols-outlined text-orange-400 text-sm">local_fire_department</span>
                <span className="text-xs font-bold text-orange-300">{streak}</span>
              </div>
            )}
            <p className="text-xs text-gray-400">{qIdx + 1}/{questions.length}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-1 bg-[#D4AF37] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="flex-1 px-5 py-5 flex flex-col space-y-4">
        {/* Timer */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-1000 linear ${timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-orange-400' : 'bg-green-400'}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <span className={`text-xs font-bold w-5 text-right ${timeLeft <= 5 ? 'text-red-400' : 'text-gray-400'}`}>{timeLeft}</span>
        </div>

        {/* Question */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center space-x-2 mb-3">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${currentQ.category === 'wafl' ? 'bg-blue-500/15 text-blue-300' : 'bg-[#D4AF37]/15 text-[#D4AF37]'}`}>
              {currentQ.category.toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-500 uppercase">{currentQ.difficulty}</span>
          </div>
          <p className="text-base font-semibold text-white leading-relaxed">{currentQ.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {OPTIONS.map((opt) => {
            const text = currentQ[`option_${opt}` as keyof Question] as string
            return (
              <button
                key={opt}
                onClick={() => !result && submitAnswer(opt)}
                disabled={!!result || loading}
                className={`w-full rounded-xl border p-4 text-left transition active:scale-[0.98] ${optionStyle(opt)}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-full border border-current flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {OPTION_LABELS[opt]}
                  </span>
                  <span className="text-sm leading-snug">{text}</span>
                  {result && opt === result.correctOption && (
                    <span className="material-symbols-outlined text-green-400 text-base ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                  {result && opt === chosen && !result.correct && (
                    <span className="material-symbols-outlined text-red-400 text-base ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Explanation + Next */}
        {result && (
          <div className="space-y-3">
            {result.explanation && (
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-400 leading-relaxed">{result.explanation}</p>
              </div>
            )}
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm transition active:scale-[0.98] hover:brightness-110"
            >
              {isLast ? 'See Results' : 'Next Question →'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
```

---

### Task 10: ResultScreen component

**Files:**
- Create: `telegram-app/components/quiz/ResultScreen.tsx`

- [ ] Create file:

```tsx
'use client'
import { useState, useEffect } from 'react'

interface SessionResult {
  correctCount: number
  totalQuestions: number
  pointsEarned: number
  isPerfect: boolean
  prize: { label: string; winCode: string } | null
}

interface Props {
  result: SessionResult
  modeName: string
  onPlayAgain: () => void
  onBack: () => void
}

export default function ResultScreen({ result, modeName, onPlayAgain, onBack }: Props) {
  const { correctCount, totalQuestions, pointsEarned, isPerfect, prize } = result
  const pct = Math.round((correctCount / totalQuestions) * 100)
  const [showPrize, setShowPrize] = useState(false)

  useEffect(() => {
    if (isPerfect && prize) {
      setTimeout(() => setShowPrize(true), 800)
    }
  }, [isPerfect, prize])

  const grade = pct === 100 ? '🏆 Perfect!' : pct >= 80 ? '⭐ Excellent' : pct >= 60 ? '👍 Good' : pct >= 40 ? '📚 Keep learning' : '💪 Try again'

  return (
    <div className="flex flex-col min-h-dvh bg-[#0A0E1A]">
      <header className="pt-3 pb-2 px-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white">Quiz Results</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 space-y-5">
        {/* Score card */}
        <div className={`rounded-2xl border p-6 text-center ${isPerfect ? 'border-[#D4AF37]/50 bg-[#D4AF37]/5' : 'border-white/10 glass-card'}`}>
          <p className="text-4xl font-bold text-white mb-1">{correctCount}/{totalQuestions}</p>
          <p className="text-lg text-gray-300">{grade}</p>
          <p className="text-sm text-gray-500 mt-1">{modeName} mode · {pct}% correct</p>
        </div>

        {/* Points earned */}
        {pointsEarned > 0 && (
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#D4AF37]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <p className="text-sm font-bold text-white">Points earned</p>
            </div>
            <p className="text-lg font-bold text-[#D4AF37]">+{pointsEarned}</p>
          </div>
        )}

        {/* Perfect round prize reveal */}
        {isPerfect && showPrize && prize && (
          <div className="rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37]/5 p-5 text-center space-y-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            <p className="text-base font-bold text-[#D4AF37]">Perfect Round Prize!</p>
            <p className="text-2xl font-bold text-white">{prize.label}</p>
            <div className="glass-card rounded-lg p-2 mt-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Win code (show to admin)</p>
              <p className="text-sm font-mono font-bold text-[#D4AF37]">{prize.winCode}</p>
            </div>
            <p className="text-[10px] text-gray-500">Admin will send your reward within 48h</p>
          </div>
        )}

        {isPerfect && !prize && showPrize && (
          <div className="rounded-2xl border border-white/10 glass-card p-4 text-center">
            <p className="text-sm font-bold text-white">Perfect round! 🎯</p>
            <p className="text-xs text-gray-400 mt-1">No prize this time — but the glory is yours!</p>
          </div>
        )}

        <div className="flex space-x-3 pt-2">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl border border-white/15 text-gray-300 font-bold text-sm transition hover:bg-white/5"
          >
            Back to Hub
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm transition hover:brightness-110 active:scale-[0.98]"
          >
            Play Again
          </button>
        </div>
      </main>
    </div>
  )
}
```

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `git add -A && git commit -m "feat: quiz components (ModePicker, QuizSession, ResultScreen)"`

---

## Chunk 4: Game Hub Integration

### Task 11: Wire quiz into game/page.tsx

**Files:**
- Modify: `telegram-app/app/game/page.tsx`

- [ ] Add quiz imports at top of file (after existing imports):

```ts
import ModePicker, { type QuizMode, QUIZ_MODES } from '@/components/quiz/ModePicker'
import QuizSession from '@/components/quiz/QuizSession'
import ResultScreen from '@/components/quiz/ResultScreen'
```

- [ ] Extend `GameView` type (find `type GameView = ...` around line 75):

```ts
type GameView = 'hub' | 'playing' | 'lucky' | 'quiz-pick' | 'quiz' | 'quiz-result'
```

- [ ] Add quiz state in `GamePage` component (after existing `useState` calls):

```ts
const [quizMode, setQuizMode] = useState<QuizMode | null>(null)
const [quizSessionId, setQuizSessionId] = useState<string>('')
const [quizQuestions, setQuizQuestions] = useState<any[]>([])
const [quizResult, setQuizResult] = useState<any>(null)
const [playsLeft, setPlaysLeft] = useState<Record<string, number>>({ quick: 3, standard: 3, champion: 3 })
const [quizLoading, setQuizLoading] = useState(false)
```

- [ ] Add `startQuiz` handler in `GamePage` (after other handlers):

```ts
const startQuiz = async (mode: QuizMode) => {
  setQuizLoading(true)
  haptic.light()
  try {
    const res = await fetch(`/api/quiz/session?mode=${mode.id}`, {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
    const json = await res.json()
    const data = json.data ?? json
    if (!res.ok) {
      alert(data.error ?? 'Could not start quiz')
      setQuizLoading(false)
      return
    }
    setQuizMode(mode)
    setQuizSessionId(data.sessionId)
    setQuizQuestions(data.questions)
    setPlaysLeft(prev => ({ ...prev, [mode.id]: data.playsRemainingToday }))
    setView('quiz')
  } catch {
    alert('Network error — please try again')
  } finally {
    setQuizLoading(false)
  }
}
```

- [ ] Add Telegram back handler for quiz views (extend existing `useTelegramBack` callback):

Replace:
```ts
useTelegramBack(useCallback(() => {
  if (view !== 'hub') setView('hub')
}, [view]))
```
With:
```ts
useTelegramBack(useCallback(() => {
  if (view === 'quiz') setView('quiz-pick')
  else if (view === 'quiz-pick' || view === 'quiz-result') setView('hub')
  else if (view !== 'hub') setView('hub')
}, [view]))
```

- [ ] Add quiz view renders in the JSX return (find the existing ternary chain `view === 'playing' ? ... : view === 'lucky' ? ...`):

Add these two cases before the final `) : (` that renders the hub:

```tsx
) : view === 'quiz-pick' ? (
  <ModePicker
    playsLeft={playsLeft}
    onSelect={startQuiz}
    onBack={() => setView('hub')}
  />
) : view === 'quiz' && quizMode && quizSessionId ? (
  <QuizSession
    mode={quizMode}
    sessionId={quizSessionId}
    questions={quizQuestions}
    onComplete={(result) => { setQuizResult(result); setView('quiz-result') }}
    onBack={() => setView('hub')}
  />
) : view === 'quiz-result' && quizResult ? (
  <ResultScreen
    result={quizResult}
    modeName={quizMode?.label ?? 'Quiz'}
    onPlayAgain={() => setView('quiz-pick')}
    onBack={() => setView('hub')}
  />
```

- [ ] Add a Quiz card to `HubView`. Find where the Lucky Draw card is rendered inside `HubView` and add below it:

```tsx
{/* Quiz card */}
<div
  onClick={onQuiz}
  className="glass-card rounded-2xl p-5 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition border border-purple-500/20"
>
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
        <span className="material-symbols-outlined text-purple-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>quiz</span>
      </div>
      <div>
        <p className="text-base font-bold text-white">AFL/WAFL Quiz</p>
        <p className="text-xs text-gray-400">Test your footy knowledge</p>
      </div>
    </div>
    <span className="material-symbols-outlined text-gray-500">chevron_right</span>
  </div>
  <div className="grid grid-cols-3 gap-2">
    {[
      { label: 'Quick', q: '5 Q', color: 'text-blue-300' },
      { label: 'Standard', q: '10 Q', color: 'text-[#D4AF37]' },
      { label: 'Champion', q: '20 Q', color: 'text-purple-400' },
    ].map(({ label, q, color }) => (
      <div key={label} className="bg-white/3 rounded-lg py-1.5 text-center border border-white/8">
        <p className={`text-xs font-bold ${color}`}>{label}</p>
        <p className="text-[9px] text-gray-500">{q}</p>
      </div>
    ))}
  </div>
</div>
```

- [ ] Update `HubView` function signature — add `onQuiz: () => void` to both the TypeScript interface and the destructured props parameter. In the `<HubView ... />` call site (around line 1212 of `game/page.tsx`), add `onQuiz={() => setView('quiz-pick')}`. TypeScript will error until both sides are updated.
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `git add -A && git commit -m "feat: wire quiz into game hub"`

---

## Chunk 5: Admin Quiz Page

### Task 12: Admin quiz management page

**Files:**
- Create: `telegram-app/app/admin/quiz/page.tsx`

- [ ] Create the page. It follows the same pattern as `app/admin/wins/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

interface Question {
  id: string; question: string; option_a: string; option_b: string; option_c: string; option_d: string
  correct_option: string; explanation: string | null; category: string; difficulty: string; active: boolean
  created_at: string
}

interface Stats { totalQuestions: number; activeQuestions: number; totalSessions: number; avgScorePct: number }

const DIFF_COLORS: Record<string, string> = { easy: 'text-green-400', medium: 'text-yellow-400', hard: 'text-red-400' }
const CAT_COLORS: Record<string, string> = { afl: 'text-[#D4AF37]', wafl: 'text-blue-300', general: 'text-gray-300' }

export default function AdminQuizPage() {
  const [token, setToken] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', explanation: '', category: 'afl', difficulty: 'medium' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken(t)
    if (t) fetchData(t)
  }, [])

  async function fetchData(t: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/quiz?token=${t}`)
      const json = await res.json()
      const data = json.data ?? json
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setQuestions(data.questions ?? [])
      setStats(data.stats ?? null)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  async function toggleActive(q: Question) {
    await fetch(`/api/admin/quiz/questions/${q.id}?token=${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ active: !q.active }),
    })
    setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, active: !q.active } : x))
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return
    await fetch(`/api/admin/quiz/questions/${id}?token=${token}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    })
    setQuestions(qs => qs.filter(x => x.id !== id))
  }

  async function addQuestion() {
    if (!form.question || !form.option_a || !form.option_b || !form.option_c || !form.option_d) {
      alert('Fill all option fields'); return
    }
    setSaving(true)
    const res = await fetch(`/api/admin/quiz/questions?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    const data = json.data ?? json
    setQuestions(qs => [data, ...qs])
    setShowAddForm(false)
    setForm({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', explanation: '', category: 'afl', difficulty: 'medium' })
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center text-white">Loading…</div>
  if (error) return <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center text-red-400">{error}</div>

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white font-[Inter]">
      <header className="sticky top-0 bg-[#0A0E1A]/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <a href={`/admin?token=${token}`} className="text-gray-400 hover:text-white text-sm">← Admin</a>
          <span className="text-gray-600">/</span>
          <h1 className="text-base font-bold">Quiz Management</h1>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-sm font-bold"
        >+ Add Question</button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Questions', value: stats.totalQuestions },
              { label: 'Active', value: stats.activeQuestions },
              { label: 'Sessions Played', value: stats.totalSessions },
              { label: 'Avg Score', value: `${stats.avgScorePct}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[#D4AF37]">{value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-sm">New Question</h2>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white resize-none"
              rows={3} placeholder="Question text…"
              value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              {(['a','b','c','d'] as const).map(opt => (
                <input
                  key={opt}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                  placeholder={`Option ${opt.toUpperCase()}`}
                  value={form[`option_${opt}` as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [`option_${opt}`]: e.target.value }))}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Correct</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white mt-0.5"
                  value={form.correct_option} onChange={e => setForm(f => ({ ...f, correct_option: e.target.value }))}>
                  {['a','b','c','d'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Category</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white mt-0.5"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['afl','wafl','general'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Difficulty</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white mt-0.5"
                  value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  {['easy','medium','hard'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
              placeholder="Explanation (optional)…"
              value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
            />
            <div className="flex space-x-2">
              <button onClick={() => setShowAddForm(false)} className="flex-1 py-2 rounded-lg border border-white/15 text-sm text-gray-300">Cancel</button>
              <button onClick={addQuestion} disabled={saving} className="flex-1 py-2 rounded-lg bg-[#D4AF37] text-black font-bold text-sm disabled:opacity-60">
                {saving ? 'Saving…' : 'Add Question'}
              </button>
            </div>
          </div>
        )}

        {/* Question list */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Question Bank ({questions.length})</h2>
          {questions.map(q => (
            <div key={q.id} className={`bg-white/2 border rounded-xl p-4 space-y-2 ${q.active ? 'border-white/8' : 'border-white/3 opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-white leading-snug flex-1">{q.question}</p>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button onClick={() => toggleActive(q)} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${q.active ? 'border-green-500/40 text-green-400' : 'border-gray-600 text-gray-500'}`}>
                    {q.active ? 'Active' : 'Off'}
                  </button>
                  <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className={CAT_COLORS[q.category] ?? 'text-gray-400'}>{q.category.toUpperCase()}</span>
                <span className={DIFF_COLORS[q.difficulty] ?? 'text-gray-400'}>{q.difficulty}</span>
                <span className="text-gray-600">Correct: <strong className="text-gray-300">{q.correct_option.toUpperCase()}</strong></span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500">
                {(['a','b','c','d'] as const).map(opt => (
                  <span key={opt} className={opt === q.correct_option ? 'text-green-400' : ''}>
                    {opt.toUpperCase()}: {q[`option_${opt}` as keyof Question] as string}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] Add link to quiz admin from main admin panel. In `app/admin/page.tsx`, find the Lucky Draw link and add alongside:

```tsx
<a href={`/admin/quiz?token=${token}`} className="px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition">
  Quiz ↗
</a>
```

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `git add -A && git commit -m "feat: admin quiz page with question bank management"`

---

## Chunk 6: Final Wiring + Deploy

### Task 13: Quiz plays status + quiz_points API + hub display

**Files:**
- Create: `telegram-app/app/api/quiz/status/route.ts`
- Modify: `telegram-app/app/game/page.tsx`

- [ ] Create `app/api/quiz/status/route.ts` — returns plays used today per mode + total quiz_points. **Do NOT use `/api/quiz/session` for this** (that creates a session row):

```ts
import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegram'

const MODES = ['quick', 'standard', 'champion']
const DAILY_LIMIT = 3
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  let telegramId: number
  if (DEV_BYPASS && !initData) { telegramId = 0 }
  else {
    const valid = validateTelegramInitData(initData, BOT_TOKEN)
    if (!valid) return fail('Unauthorized', 'UNAUTHORIZED', 401)
    const user = parseTelegramUser(initData)
    if (!user) return fail('No user', 'NO_USER', 400)
    telegramId = user.id
  }

  const supabase = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [sessionRows, userData] = await Promise.all([
    (supabase as any)
      .from('quiz_sessions')
      .select('mode')
      .eq('telegram_id', telegramId)
      .neq('status', 'abandoned')
      .gte('created_at', today.toISOString()),
    (supabase as any)
      .from('users')
      .select('quiz_points')
      .eq('telegram_id', telegramId)
      .single(),
  ])

  const usedToday: Record<string, number> = {}
  for (const mode of MODES) {
    usedToday[mode] = (sessionRows.data ?? []).filter((r: { mode: string }) => r.mode === mode).length
  }
  const playsLeft: Record<string, number> = {}
  for (const mode of MODES) {
    playsLeft[mode] = Math.max(0, DAILY_LIMIT - (usedToday[mode] ?? 0))
  }

  return ok({
    playsLeft,
    quizPoints: userData.data?.quiz_points ?? 0,
  })
}
```

- [ ] In `GamePage`, add state + fetch on mount:

```ts
// State additions:
const [quizPoints, setQuizPoints] = useState(0)

// In GamePage's useEffect (alongside game stats fetch), add:
fetch('/api/quiz/status', { headers: { 'x-telegram-init-data': getTelegramInitData() } })
  .then(r => r.json())
  .then(j => {
    const d = j.data ?? j
    if (d.playsLeft) setPlaysLeft(d.playsLeft)
    if (d.quizPoints !== undefined) setQuizPoints(d.quizPoints)
  }).catch(() => {})
```

- [ ] Add `quizPoints` to `HubView` props interface and pass it from `GamePage`:

In `HubView` function signature, add `quizPoints: number` to the destructured props and to the interface. In the `<HubView ... />` call site in `GamePage`, add `quizPoints={quizPoints}`.

- [ ] In `HubView`, add quiz points row to the breakdown section:

```tsx
{quizPoints > 0 && (
  <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
    <span className="text-gray-400 flex items-center space-x-1">
      <span className="material-symbols-outlined text-purple-400 text-sm">quiz</span>
      <span>Quiz points earned</span>
    </span>
    <span className="font-bold text-purple-300">+{quizPoints}</span>
  </div>
)}
```

- [ ] `npx tsc --noEmit` — 0 errors

### Task 14: Verify + deploy

- [ ] Run full type check: `cd telegram-app && npx tsc --noEmit`
- [ ] Run lint: `npm run lint`
- [ ] Manual smoke test locally (`npm run dev`):
  - Navigate to `/game` hub — Quiz card visible
  - Tap Quiz → ModePicker shows 3 modes
  - Start Quick quiz — 5 questions load, no correct_option in network response
  - Answer questions — correct/wrong feedback shown
  - Complete — ResultScreen shows score + points
  - Admin `/admin/quiz?token=X` — questions table loads, add/toggle/delete work
- [ ] Deploy: `cd telegram-app && vercel --prod`
- [ ] `git add -A && git commit -m "feat: NSAFL Quiz complete"`
