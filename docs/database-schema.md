# Math Hero Kids — Database Schema

> **Revision note**: (1) `child_credentials` removed — no child login; (2) `weekly_rankings`/`monthly_rankings` removed — indexed queries; (3) `child_streaks` simplified to `last_challenge_date` on profile; (4) `notification_preferences` added; (5) `challenge_answers` — removed `UNIQUE (session_id, question_index)`, added `block_number` + `attempt_number` to support block retry without XP double-award.

All tables live in Supabase/PostgreSQL. RLS is enabled on every table. `auth.users` is managed by Supabase Auth.

---

## Entity Relationship Overview

```
auth.users (Supabase Auth)
    │
    └──< parent_profiles
              │
              ├──< notification_preferences
              └──< child_profiles
                        │
                        ├──< challenge_sessions
                        │         └──< challenge_answers
                        ├──< child_xp_ledger
                        ├──< calendar_days
                        ├──< child_trophies
                        ├──< child_achievements
                        ├──< child_level_rewards
                        ├──< friendships (child ←→ child)
                        └──< friend_requests
```

Static catalogs (seeded, no writes from app):
```
level_thresholds
trophies
achievements
level_rewards
```

---

## Tables

### `parent_profiles`

```sql
CREATE TABLE parent_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  pin_hash    TEXT,                 -- bcrypt hash of 4-digit PIN; NULL = PIN not yet set
  language    TEXT NOT NULL DEFAULT 'pt' CHECK (language IN ('pt','en','es','fr')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS**: `id = auth.uid()` — parent reads/writes own row only.

**Trigger**: created automatically on `auth.users` insert via Supabase DB trigger.

---

### `child_profiles`

```sql
CREATE TABLE child_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID NOT NULL REFERENCES parent_profiles(id) ON DELETE CASCADE,
  username            TEXT NOT NULL UNIQUE,       -- public-facing identifier; friend search key
  display_name        TEXT NOT NULL,
  birth_date          DATE,                       -- used for difficulty calibration
  avatar_id           TEXT NOT NULL,              -- 'sofia' | 'gabriel' | 'pedro' | ...
  -- Progression (server-authoritative — never updated by client directly)
  xp_total            INTEGER NOT NULL DEFAULT 0,
  level               INTEGER NOT NULL DEFAULT 1,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  best_streak         INTEGER NOT NULL DEFAULT 0,
  last_challenge_date DATE,                       -- for streak consecutive-day detection
  -- Parent-configurable settings (per child)
  timer_seconds       INTEGER NOT NULL DEFAULT 15
                        CHECK (timer_seconds IN (10, 15, 20, 30, 0)),  -- 0 = unlimited
  multiplication_max  INTEGER NOT NULL DEFAULT 10
                        CHECK (multiplication_max IN (10, 12, 15, 20)),
  social_enabled      BOOLEAN NOT NULL DEFAULT true,
  -- Profile management
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,   -- profile switcher display order
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_child_profiles_parent ON child_profiles(parent_id);
CREATE INDEX idx_child_profiles_username ON child_profiles(username);
```

**Security note**: Progression columns (`xp_total`, `level`, `current_streak`, `best_streak`, `last_challenge_date`) are updated **exclusively** by the `complete_challenge` Edge Function. The RLS `UPDATE` policy must allow only settings columns (`timer_seconds`, `multiplication_max`, `social_enabled`, `display_name`, `avatar_id`, `sort_order`) for the parent client role.

**RLS**:
- Parent: `SELECT` all own children (`parent_id = auth.uid()`); `UPDATE` settings columns only; `INSERT`/`DELETE` (soft delete via `is_active`).
- No direct child-session access to this table from the client — child profile data is loaded by the parent session.

---


### `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID NOT NULL UNIQUE REFERENCES parent_profiles(id) ON DELETE CASCADE,
  daily_reminder      BOOLEAN NOT NULL DEFAULT true,
  reminder_time       TIME NOT NULL DEFAULT '18:00:00',  -- local time (stored in UTC offset TBD)
  push_token          TEXT,                              -- Expo push token; nullable if not granted
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS**: parent reads/writes own row.

**Note**: Per-child notification preferences (e.g., different reminder times per child) not needed for MVP. One preference set per parent account.

---

### `challenge_sessions`

One record per challenge attempt. A "session" is idempotent — the client generates a UUID before starting and uses it as the session `id`. This makes `complete_challenge` safe to retry.

```sql
CREATE TABLE challenge_sessions (
  id                UUID PRIMARY KEY,              -- client-generated UUID (idempotency key)
  child_id          UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  challenge_date    DATE NOT NULL,
  module_id         TEXT NOT NULL DEFAULT 'multiplication',
  question_seed     TEXT NOT NULL,                 -- seed used to generate this session's questions
  status            TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','completed','abandoned')),
  total_questions   INTEGER NOT NULL DEFAULT 20,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  xp_awarded        INTEGER NOT NULL DEFAULT 0,
  is_retroactive    BOOLEAN NOT NULL DEFAULT false,
  is_perfect        BOOLEAN NOT NULL DEFAULT false,  -- all 20 correct
  -- Settings snapshot (frozen at session start)
  timer_seconds     INTEGER NOT NULL,
  multiplication_max INTEGER NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  UNIQUE (child_id, challenge_date, module_id)      -- one session per day per module per child
);

CREATE INDEX idx_challenge_sessions_child_date ON challenge_sessions(child_id, challenge_date DESC);
```

**Notes**:
- `UNIQUE (child_id, challenge_date, module_id)` enforces one challenge per day. The Edge Function handles conflicts: if a session already exists and is `completed`, reject re-submission. If `in_progress` and same UUID, this is a retry → idempotent update.
- `status = 'abandoned'` is set when the child exits mid-challenge. Questions completed up to the last block checkpoint are preserved in `challenge_answers`.
- No `failed` status: a session is either completed (possibly with low score) or abandoned. "Failed" in the calendar context means `challenge_date` passed with no `completed` session.
- **Retroactive challenge rules** (enforced in `start_challenge` Edge Function):
  - `challenge_date` must be within the past 7 calendar days; older dates are rejected with a `429 RETROACTIVE_WINDOW_EXPIRED` error.
  - XP awarded is identical to a same-day challenge.
  - Trophy progress counters (cumulative counts like monthly_days_completed) are incremented.
  - "Perfect week" / "perfect month" trophy conditions are only evaluated for the **current** open window, not retroactively closed ones.
  - `last_challenge_date` and `current_streak` are NOT updated by retroactive completions.

---

### `challenge_answers`

Submitted in a batch at block checkpoint or session end. Stores every attempt, including retries.

```sql
CREATE TABLE challenge_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES challenge_sessions(id) ON DELETE CASCADE,
  block_number    SMALLINT NOT NULL,             -- 1–4 (block of 5 questions)
  attempt_number  SMALLINT NOT NULL DEFAULT 1,   -- increments on each block retry
  question_index  SMALLINT NOT NULL,             -- 0–19 (absolute position in session)
  operand_a       SMALLINT NOT NULL,
  operand_b       SMALLINT NOT NULL,
  correct_answer  SMALLINT NOT NULL,
  child_answer    SMALLINT,                      -- NULL = timed out or unanswered
  is_correct      BOOLEAN NOT NULL,
  time_taken_ms   INTEGER,
  xp_awarded      SMALLINT NOT NULL DEFAULT 0    -- 0 on retry attempts; XP paid once per question
);

CREATE INDEX idx_challenge_answers_session ON challenge_answers(session_id);
```

**Block retry rules** (enforced in `complete_challenge` Edge Function):

- `UNIQUE (session_id, question_index)` is intentionally **absent** — the same question_index can appear multiple times across retry attempts.
- `correct_count` on `challenge_sessions` is computed as:
  ```sql
  COUNT(DISTINCT question_index) FILTER (WHERE is_correct = true)
  ```
  This deduplicates retries: a question answered correctly on attempt 2 counts, but only once.
- `xp_awarded = 10` only on the **first correct answer** for a given `question_index` within the session. All retry rows for that question_index get `xp_awarded = 0`.
- `is_perfect = (correct_count = 20)` — requires every unique question to have been answered correctly at least once.
- Block retry does **not** reset other blocks. `block_number` tracks which block each answer belongs to.

---

### `child_xp_ledger`

Append-only audit log. `child_profiles.xp_total` is the denormalized running total. Both must stay in sync — the Edge Function updates both atomically.

```sql
CREATE TABLE child_xp_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK (source IN (
                  'correct_answer',
                  'challenge_completion',
                  'achievement',
                  'trophy'
                )),
  amount        INTEGER NOT NULL,
  reference_id  UUID,                           -- session_id, achievement_id, trophy_id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_ledger_child_date ON child_xp_ledger(child_id, created_at DESC);
```

**Note on "perfect_block" and "weekly_completion" XP sources from PRD**: These are not yet confirmed as distinct ledger entries. Milestone bonuses (Q5/Q10/Q15/Q20 shown in UI) may be part of the flat `challenge_completion` bonus, not separate ledger rows. See OQ-16. Keeping source categories minimal for now; can add later.

This table also serves as the **ranking data source** — weekly/monthly XP totals are computed with date-range queries on this table (see architecture.md §6). No pre-computed ranking tables.

---

### `calendar_days`

```sql
CREATE TABLE calendar_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  day_date    DATE NOT NULL,
  state       TEXT NOT NULL CHECK (state IN ('completed','failed','in_progress')),
             -- 'future' and 'today' are computed client-side from date comparison; not stored
  is_perfect  BOOLEAN NOT NULL DEFAULT false,
  session_id  UUID REFERENCES challenge_sessions(id),
  UNIQUE (child_id, day_date)
);

CREATE INDEX idx_calendar_days_child_date ON calendar_days(child_id, day_date DESC);
```

**Simplification from original draft**: `'future'` and `'today'` states are not stored — they're computed client-side by comparing `day_date` with today's date. Only days with actual challenge activity have rows.

A day is `'failed'` when a cron job (or the next `complete_challenge` call) detects that a past `day_date` has no `completed` session. Alternatively, the client infers `failed` for any past day with no row (no session = missed day). The latter is simpler and preferred for MVP.

---

### `trophies` (static catalog)

```sql
CREATE TABLE trophies (
  id                TEXT PRIMARY KEY,
  name_key          TEXT NOT NULL,
  description_key   TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('daily','weekly','monthly','streak','special')),
  tier              TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','diamond')),
  requirement_type  TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  icon_asset        TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);
```

**Known trophies** (from designs):

| id | category | tier | requirement_type | requirement_value |
|---|---|---|---|---|
| daily_trophy | daily | bronze | days_completed | 1 |
| madrugador | daily | bronze | TBD (OQ-11) | TBD |
| weekly_trophy | weekly | silver | days_completed_week | 7 |
| monthly_trophy | monthly | gold | days_completed_month | 30 |
| sequencia_de_fogo | streak | gold | streak_days | TBD |
| semana_perfeita | special | diamond | perfect_week_days | 7 |
| mes_perfeito | special | diamond | perfect_month_days | 30 |
| campiao | special | gold | TBD | TBD |

**RLS**: public read, no client writes.

---

### `child_trophies`

```sql
CREATE TABLE child_trophies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  trophy_id   TEXT NOT NULL REFERENCES trophies(id),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress    INTEGER NOT NULL DEFAULT 0,        -- progress toward trophy (e.g. 18/30 days)
  UNIQUE (child_id, trophy_id)
);

CREATE INDEX idx_child_trophies_child ON child_trophies(child_id);
```

---

### `achievements` (static catalog)

```sql
CREATE TABLE achievements (
  id                TEXT PRIMARY KEY,
  name_key          TEXT NOT NULL,
  description_key   TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('primeiros_passos','sequencias','habilidades','especiais')),
  condition_type    TEXT NOT NULL,
  condition_value   INTEGER,
  icon_asset        TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);
```

**Known achievements** (from designs):

| id | category | condition_type | condition_value |
|---|---|---|---|
| primeiro_acesso | primeiros_passos | app_opened | 1 |
| primeiro_dia_perfeito | primeiros_passos | perfect_days | 1 |
| sequencia_7_dias | sequencias | streak_days | 7 |
| sequencia_30_dias | sequencias | streak_days | 30 |
| mestre_multiplicacao | habilidades | TBD | TBD |
| campeao_velocidade | habilidades | speed_perfect_challenge | TBD |
| semana_perfeita | especiais | perfect_week | 7 |
| mes_perfeito | especiais | perfect_month | 30 |

**RLS**: public read, no client writes.

---

### `child_achievements`

```sql
CREATE TABLE child_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL REFERENCES achievements(id),
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (child_id, achievement_id)
);

CREATE INDEX idx_child_achievements_child ON child_achievements(child_id);
```

---

### `level_thresholds` (static catalog)

```sql
CREATE TABLE level_thresholds (
  level         SMALLINT PRIMARY KEY,
  xp_required   INTEGER NOT NULL,          -- cumulative XP to reach this level
  name_key      TEXT NOT NULL              -- i18n key for level title
);
```

**Known values** (inferred from designs — needs product confirmation):

| level | xp_required | title (PT) |
|---|---|---|
| 1 | 0 | Explorador |
| 10 | ~8,000 | Explorador |
| 11 | ~8,500 | Aventureiro |
| 12 | ~9,000 | Herói da Matemática |
| 13 | ~9,550 | Mago Aprendiz |
| 14 | ~10,200 | ? |
| 15 | ~11,000 | Mestre dos Números |
| 18 | ~13,500 | ? |
| 20 | ~15,000 | Lenda Matemática |
| 50 | TBD | Math Legend (PRD) |

Full table must be defined by product before Phase 3 starts.

---

### `level_rewards` (static catalog)

```sql
CREATE TABLE level_rewards (
  id            TEXT PRIMARY KEY,
  name_key      TEXT NOT NULL,
  reward_type   TEXT NOT NULL CHECK (reward_type IN ('frame','outfit','medal','trophy_variant','celebration')),
  unlock_level  SMALLINT NOT NULL REFERENCES level_thresholds(level),
  icon_asset    TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
```

**Known rewards** (from designs):

| id | type | unlock_level |
|---|---|---|
| moldura_estrelas | frame | 10 |
| capa_magica | outfit | 11 |
| medalha_prata | medal | 12 |
| trofe_brilhante | trophy_variant | 13 |
| moldura_arco_iris | frame | 14 |
| chapeu_galactico | outfit | 15 |
| medalha_ouro | medal | 18 |
| fogos_dourados | celebration | 20 |

---

### `child_level_rewards`

```sql
CREATE TABLE child_level_rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  reward_id   TEXT NOT NULL REFERENCES level_rewards(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, reward_id)
);
```

---

### `friendships`

Bidirectional friendship: always two rows per pair (`A→B` and `B→A`). Simpler to query than single-row with ordering trick.

```sql
CREATE TABLE friendships (
  child_id    UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, friend_id),
  CHECK (child_id <> friend_id)
);

CREATE INDEX idx_friendships_child ON friendships(child_id);
```

**RLS**: child reads own friendships only. Writes only via Edge Function (on request acceptance).

---

### `friend_requests`

```sql
CREATE TABLE friend_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_child_id   UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  to_child_id     UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  UNIQUE (from_child_id, to_child_id),
  CHECK (from_child_id <> to_child_id)
);

CREATE INDEX idx_friend_requests_to ON friend_requests(to_child_id, status)
  WHERE status = 'pending';            -- partial index — only pending requests need fast lookup
CREATE INDEX idx_friend_requests_from ON friend_requests(from_child_id);
```

**Anti-abuse rule**: after a request is rejected, the same `from_child_id` cannot send another request to the same `to_child_id` for 24 hours. Enforced in the `send_friend_request` Edge Function (check `responded_at`).

---

## Removed Tables ⚠️

The following tables were evaluated and removed:

**`weekly_rankings` / `monthly_rankings`**: Premature optimization. Computed via indexed queries on `child_xp_ledger`. Re-evaluate only if query latency exceeds 200ms in production.

**`child_streaks` (history table)**: Not needed for any MVP feature. `last_challenge_date` on `child_profiles` is sufficient for streak continuity logic. Analytics use case deferred.

**`child_credentials`**: Removed entirely. Children do not log in independently — the parent authenticates via Supabase Auth (email + password) and selects a child profile via the switcher. No child password exists. Child profile data is protected by the parent's RLS context.

---

## Security Checklist

| Concern | Mitigation |
|---|---|
| Child password hash exposure | Isolated in `child_credentials`; `SELECT` denied via RLS for all app roles |
| Parent PIN hash exposure | In `parent_profiles.pin_hash`; never returned by any API (RLS `SELECT` column exclusion or separate table) |
| XP manipulation | `xp_total`, `level`, `current_streak` — never writable by app client directly |
| Replay attacks on `complete_challenge` | Session UUID is idempotency key; duplicate submissions return same XP, no double-award |
| Cross-parent data access | All queries filtered by `auth.uid()` → `parent_profiles.id` → `child_profiles.parent_id` |
| Social privacy (children) | Username search only; no personal info (birth date, parent email) exposed in friend/search context |
| Friend request spam | Rate limit + 24h cooldown after rejection in Edge Function |

---

## Migration Strategy

All schema changes must be managed via Supabase migrations (`supabase/migrations/`). Never apply changes directly to the production DB. Migrations must be:
- Backward-compatible (add columns with defaults, never drop columns in MVP)
- Tested in `dev` environment before applying to `prod`
- Reviewed for RLS policy impact before applying
