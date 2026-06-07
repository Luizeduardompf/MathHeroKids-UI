-- ============================================================
-- Migration 001 — Initial schema
-- Math Hero Kids
--
-- Run against the Supabase project via:
--   supabase db push
--   or paste in Supabase Studio > SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ──────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- PARENT PROFILES
-- Created automatically via trigger on auth.users insert.
-- ──────────────────────────────────────────────────────────────

create table public.parent_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  pin_hash    text,                 -- bcrypt hash; null = PIN not set
  language    text not null default 'pt'
                check (language in ('pt','en','es','fr')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- DB trigger: create parent_profiles row on new auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.parent_profiles (id, name, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'language', 'pt')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- CHILD PROFILES
-- ──────────────────────────────────────────────────────────────

create table public.child_profiles (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid not null references public.parent_profiles(id) on delete cascade,
  username            text not null unique,
  display_name        text not null,
  birth_date          date,
  avatar_id           text not null,
  -- Progression (server-authoritative — Edge Functions only)
  xp_total            integer not null default 0 check (xp_total >= 0),
  level               integer not null default 1 check (level >= 1),
  current_streak      integer not null default 0 check (current_streak >= 0),
  best_streak         integer not null default 0 check (best_streak >= 0),
  last_challenge_date date,
  -- Per-child settings (parent-configurable)
  timer_seconds       integer not null default 15
                        check (timer_seconds in (10, 15, 20, 30, 0)),
  multiplication_max  integer not null default 10
                        check (multiplication_max in (10, 12, 15, 20)),
  social_enabled      boolean not null default true,
  -- Management
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_child_profiles_parent_id on public.child_profiles (parent_id, is_active, sort_order);
create index idx_child_profiles_username  on public.child_profiles (username);

-- ──────────────────────────────────────────────────────────────
-- CHALLENGE SESSIONS
-- ──────────────────────────────────────────────────────────────

create table public.challenge_sessions (
  id                  uuid primary key,  -- client-generated (idempotency key)
  child_id            uuid not null references public.child_profiles(id) on delete cascade,
  challenge_date      date not null,
  module_id           text not null default 'multiplication',
  question_seed       text not null,
  status              text not null default 'in_progress'
                        check (status in ('in_progress', 'completed', 'abandoned')),
  total_questions     integer not null default 20,
  correct_count       integer not null default 0,
  xp_awarded          integer not null default 0,
  is_retroactive      boolean not null default false,
  is_perfect          boolean not null default false,
  timer_seconds       integer not null,
  multiplication_max  integer not null,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  unique (child_id, challenge_date, module_id)
);

create index idx_sessions_child_date on public.challenge_sessions (child_id, challenge_date desc);

-- ──────────────────────────────────────────────────────────────
-- CHALLENGE ANSWERS
-- ──────────────────────────────────────────────────────────────

create table public.challenge_answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.challenge_sessions(id) on delete cascade,
  block_number    integer not null check (block_number between 1 and 4),
  attempt_number  integer not null default 1,
  question_index  integer not null check (question_index between 0 and 19),
  operand_a       integer not null,
  operand_b       integer not null,
  correct_answer  integer not null,
  child_answer    integer,            -- null = timeout
  is_correct      boolean not null,
  time_taken_ms   integer,
  xp_awarded      integer not null default 0
);

create index idx_answers_session on public.challenge_answers (session_id);

-- ──────────────────────────────────────────────────────────────
-- XP LEDGER
-- ──────────────────────────────────────────────────────────────

create table public.child_xp_ledger (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.child_profiles(id) on delete cascade,
  source        text not null
                  check (source in ('correct_answer','challenge_completion','achievement','trophy')),
  amount        integer not null,
  reference_id  uuid,
  created_at    timestamptz not null default now()
);

create index idx_xp_ledger_child_created on public.child_xp_ledger (child_id, created_at desc);

-- ──────────────────────────────────────────────────────────────
-- CALENDAR DAYS
-- ──────────────────────────────────────────────────────────────

create table public.calendar_days (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.child_profiles(id) on delete cascade,
  day_date    date not null,
  state       text not null check (state in ('completed','failed','in_progress')),
  is_perfect  boolean not null default false,
  session_id  uuid references public.challenge_sessions(id),
  unique (child_id, day_date)
);

create index idx_calendar_child_date on public.calendar_days (child_id, day_date desc);

-- ──────────────────────────────────────────────────────────────
-- STATIC CATALOGS (seeded — no app writes)
-- ──────────────────────────────────────────────────────────────

create table public.trophies (
  id                  uuid primary key default gen_random_uuid(),
  name_key            text not null,
  description_key     text not null,
  category            text not null check (category in ('daily','weekly','monthly','streak','special')),
  tier                text not null check (tier in ('bronze','silver','gold','diamond')),
  requirement_type    text not null,
  requirement_value   integer not null,
  icon_asset          text not null,
  sort_order          integer not null default 0
);

create table public.achievements (
  id                uuid primary key default gen_random_uuid(),
  name_key          text not null,
  description_key   text not null,
  category          text not null check (category in ('primeiros_passos','sequencias','habilidades','especiais')),
  condition_type    text not null,
  condition_value   integer,
  icon_asset        text not null,
  sort_order        integer not null default 0
);

create table public.level_rewards (
  id            uuid primary key default gen_random_uuid(),
  name_key      text not null,
  reward_type   text not null check (reward_type in ('frame','outfit','medal','trophy_variant','celebration')),
  unlock_level  integer not null,
  icon_asset    text not null,
  sort_order    integer not null default 0
);

create table public.level_thresholds (
  level         integer primary key,
  xp_required   integer not null,
  name_key      text not null
);

-- ──────────────────────────────────────────────────────────────
-- CHILD EARNED ITEMS
-- ──────────────────────────────────────────────────────────────

create table public.child_trophies (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.child_profiles(id) on delete cascade,
  trophy_id   uuid not null references public.trophies(id),
  earned_at   timestamptz not null default now(),
  progress    integer not null default 0,
  unique (child_id, trophy_id)
);

create table public.child_achievements (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references public.child_profiles(id) on delete cascade,
  achievement_id  uuid not null references public.achievements(id),
  earned_at       timestamptz not null default now(),
  progress        integer not null default 0,
  unique (child_id, achievement_id)
);

create table public.child_level_rewards (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.child_profiles(id) on delete cascade,
  reward_id   uuid not null references public.level_rewards(id),
  unlocked_at timestamptz not null default now(),
  unique (child_id, reward_id)
);

-- ──────────────────────────────────────────────────────────────
-- SOCIAL
-- ──────────────────────────────────────────────────────────────

create table public.friendships (
  child_id    uuid not null references public.child_profiles(id) on delete cascade,
  friend_id   uuid not null references public.child_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (child_id, friend_id),
  check (child_id <> friend_id)
);

create index idx_friendships_child on public.friendships (child_id);
create index idx_friendships_friend on public.friendships (friend_id);

create table public.friend_requests (
  id              uuid primary key default gen_random_uuid(),
  from_child_id   uuid not null references public.child_profiles(id) on delete cascade,
  to_child_id     uuid not null references public.child_profiles(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending','accepted','rejected','cancelled')),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  check (from_child_id <> to_child_id)
);

create index idx_friend_requests_to on public.friend_requests (to_child_id, status);

-- ──────────────────────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- ──────────────────────────────────────────────────────────────

create table public.notification_preferences (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null unique references public.parent_profiles(id) on delete cascade,
  daily_reminder  boolean not null default true,
  reminder_time   time not null default '18:00:00',
  push_token      text,
  updated_at      timestamptz not null default now()
);
