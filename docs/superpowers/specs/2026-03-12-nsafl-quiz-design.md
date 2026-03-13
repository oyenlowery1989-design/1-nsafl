# NSAFL Quiz — Design Spec
_Date: 2026-03-12_

## Overview

An AFL/WAFL trivia quiz game embedded in the existing `/game` hub alongside the Lucky Draw. Players choose a game mode, answer questions (server-validated), earn game points, and can win token prizes for perfect rounds. Admins manage the question bank and view session stats via `/admin/quiz`.

---

## Game Modes

| Mode | Questions | Time per Q | Point Multiplier |
|------|-----------|------------|-----------------|
| Quick | 5 | 15s | 1× |
| Standard | 10 | 15s | 1.5× |
| Champion | 20 | 15s | 2× |

- **Daily limit:** 3 attempts per mode per day (keyed by `telegram_id + mode + date`)
- **Base score:** +10 points per correct answer × mode multiplier
- **No penalty** for wrong answers

---

## Bonus Prize

- **Perfect round** (all correct) → enters a mini lucky draw spin for NSAFL/XLM prize
- Same prize table as Lucky Draw (weighted random), handled by existing prize logic
- Win saved to `lucky_draw_wins` table with `prize_source = 'quiz'`

---

## Architecture

### UI Flow (all within `/game` route)

```
GameHub
  ├── LuckyDraw card (existing)
  └── Quiz card (new) → tap
        └── ModePicker screen (Quick / Standard / Champion)
              └── QuizSession screen
                    ├── ProgressBar (Q x of N)
                    ├── QuestionCard (question + 4 options A/B/C/D)
                    ├── Timer (15s countdown bar)
                    ├── StreakCounter
                    └── → POST /api/quiz/answer (server validates)
                          └── ResultScreen (score, correct count, points earned)
                                └── [if perfect] → PrizeSpinOverlay
```

### Answer Security

Correct answers are **never sent to the client**. Flow:
1. Client fetches questions for session: `GET /api/quiz/session?mode=quick` → returns `{sessionId, questions: [{id, question, option_a, option_b, option_c, option_d}]}` — **no `correct_option`**
2. Per answer: `POST /api/quiz/answer` with `{sessionId, questionId, chosen}` → server validates, returns `{correct: bool, explanation?: string}`
3. Session complete: `POST /api/quiz/complete` → saves `quiz_sessions` row, awards points, returns `{score, pointsEarned, isPerfect}`

---

## Database

### `quiz_questions` table
```sql
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  explanation text,
  category text not null default 'general', -- 'afl', 'wafl', 'general'
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### `quiz_sessions` table
```sql
create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users(telegram_id),
  mode text not null check (mode in ('quick','standard','champion')),
  score integer not null default 0,
  correct_count integer not null default 0,
  total_questions integer not null,
  is_perfect boolean not null default false,
  points_earned integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  question_ids uuid[] not null default '{}',  -- locked set of question IDs for this session
  answers_given jsonb not null default '{}',  -- {questionId: chosen} map to prevent replay
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);
```

### `quiz_points` on users
Add column `quiz_points integer not null default 0` to the `users` table (migration 018). Incremented by `POST /api/quiz/complete`. Displayed in the game hub alongside tier/referral/bonus points.

### `prize_source` on lucky_draw_wins
Add column `prize_source text default 'lucky_draw'` to `lucky_draw_wins` (migration 018 same file). Set to `'quiz'` when a perfect-round prize is awarded.

### Migration numbering
Verify current max migration in `supabase/migrations/` before running — assign next available numbers. Expected: 016, 017, 018.

### Server-side session integrity
- `GET /api/quiz/session`: creates a `quiz_sessions` row with status `in_progress`, locks the question set (`question_ids[]`), and sets `expires_at = now() + 30min`. Returns `{sessionId, questions[]}` with no correct answers.
- `POST /api/quiz/answer`: verifies `questionId` is in `session.question_ids`, checks `answers_given` map to prevent replay, validates answer server-side, updates `answers_given`. Returns `{correct, explanation}`.
- `POST /api/quiz/complete`: verifies session status is `in_progress` and not expired, marks `completed`, computes score, increments `users.quiz_points`, optionally awards prize.
- Daily limit: enforced in `GET /api/quiz/session` by counting `quiz_sessions` rows where `telegram_id = X AND mode = Y AND created_at >= today AND status != 'abandoned'`.

### Perfect-round prize security
`POST /api/quiz/complete` server-side determines `is_perfect`. If perfect, the server selects a prize using the weighted random function and inserts directly into `lucky_draw_wins` (no client-side spin for prizes — client only shows the reveal animation after the fact). The spin overlay is cosmetic only.

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/quiz/session` | Start session — returns questions (no answers) |
| POST | `/api/quiz/answer` | Validate single answer server-side |
| POST | `/api/quiz/complete` | Save session, award points |
| GET | `/api/admin/quiz` | Admin: question list + session stats |
| POST | `/api/admin/quiz/questions` | Admin: create question |
| PATCH | `/api/admin/quiz/questions/[id]` | Admin: edit/toggle question |
| DELETE | `/api/admin/quiz/questions/[id]` | Admin: delete question |

---

## Admin Page `/admin/quiz`

Standalone page (linked from admin panel, like `/admin/wins`). Sections:
1. **Stats tiles** — total questions (active/inactive), total sessions, avg score %, top scorer
2. **Question Bank table** — columns: question preview, category, difficulty, active toggle, edit/delete buttons
3. **Add Question form** — inline form: question text, 4 options, correct answer selector, category, difficulty
4. **Session Leaderboard** — top 20 by score, with mode filter

---

## Question Bank (Seed Data)

~30 AFL/WAFL questions across easy/medium/hard to ship with migration. Categories: `afl` (clubs, players, history, rules), `wafl` (clubs, records).

---

## Components (new files)

- `components/quiz/ModePicker.tsx` — mode selection cards
- `components/quiz/QuizSession.tsx` — main quiz flow (question + timer + progress)
- `components/quiz/ResultScreen.tsx` — end-of-quiz results
- `app/admin/quiz/page.tsx` — admin quiz management page

---

## Integration with Game Hub

- New `QuizCard` added to hub alongside `LuckyDrawCard`
- `totalPoints` in hub already accounts for `bonusBalls` and `referralBalls` — quiz points are stored in `users.quiz_points` (new column) and fetched alongside other hub data
- Daily attempt count shown on the QuizCard (e.g. "2 of 3 plays used today")

---

## Out of Scope (v1)

- Multiplayer / head-to-head
- Admin bulk import of questions (CSV)
- Question image support
- Push notifications for quiz reminders
