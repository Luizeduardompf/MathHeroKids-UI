-- ============================================================
-- Migration 002 — Row Level Security policies
-- Math Hero Kids
-- ============================================================

-- Enable RLS on all tables
alter table public.parent_profiles        enable row level security;
alter table public.child_profiles         enable row level security;
alter table public.challenge_sessions     enable row level security;
alter table public.challenge_answers      enable row level security;
alter table public.child_xp_ledger        enable row level security;
alter table public.calendar_days          enable row level security;
alter table public.child_trophies         enable row level security;
alter table public.child_achievements     enable row level security;
alter table public.child_level_rewards    enable row level security;
alter table public.friendships            enable row level security;
alter table public.friend_requests        enable row level security;
alter table public.notification_preferences enable row level security;
-- Static catalogs: public read, no writes from app
alter table public.trophies               enable row level security;
alter table public.achievements           enable row level security;
alter table public.level_rewards          enable row level security;
alter table public.level_thresholds       enable row level security;

-- ──────────────────────────────────────────────────────────────
-- PARENT PROFILES
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own profile"
  on public.parent_profiles for select
  using (id = auth.uid());

create policy "Parent updates own profile"
  on public.parent_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- pin_hash is managed by Edge Function only — never returned via select
-- (Supabase column-level security is not available; handled via Edge Function instead)

-- ──────────────────────────────────────────────────────────────
-- CHILD PROFILES
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own children"
  on public.child_profiles for select
  using (parent_id = auth.uid());

create policy "Parent inserts own children"
  on public.child_profiles for insert
  with check (parent_id = auth.uid());

create policy "Parent updates own children (non-progression fields)"
  on public.child_profiles for update
  using (parent_id = auth.uid())
  with check (
    parent_id = auth.uid()
    -- Progression columns (xp_total, level, streaks, last_challenge_date) are
    -- blocked by not including them in the allowed update fields via the app layer.
    -- Edge Functions use service_role and bypass RLS to write these fields.
  );

-- NOTE: "Child profile visible to friends" policy intentionally omitted.
-- Subquery on child_profiles inside a child_profiles policy causes 42P17 infinite recursion.
-- Will be re-added in Phase 5 using a security-definer helper function to avoid recursion.

-- ──────────────────────────────────────────────────────────────
-- CHALLENGE SESSIONS & ANSWERS
-- Written exclusively by Edge Functions (service_role bypasses RLS).
-- App can read its own children's sessions.
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own children sessions"
  on public.challenge_sessions for select
  using (
    child_id in (
      select id from public.child_profiles where parent_id = auth.uid()
    )
  );

create policy "Parent reads own children answers"
  on public.challenge_answers for select
  using (
    session_id in (
      select s.id from public.challenge_sessions s
      join public.child_profiles c on c.id = s.child_id
      where c.parent_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- XP LEDGER
-- Append-only via Edge Functions. App reads own children's entries.
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own children xp ledger"
  on public.child_xp_ledger for select
  using (
    child_id in (
      select id from public.child_profiles where parent_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- CALENDAR DAYS
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own children calendar"
  on public.calendar_days for select
  using (
    child_id in (
      select id from public.child_profiles where parent_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- TROPHIES / ACHIEVEMENTS / LEVEL REWARDS (static catalogs)
-- ──────────────────────────────────────────────────────────────

create policy "Anyone reads trophies"     on public.trophies       for select using (true);
create policy "Anyone reads achievements" on public.achievements    for select using (true);
create policy "Anyone reads rewards"      on public.level_rewards   for select using (true);
create policy "Anyone reads thresholds"   on public.level_thresholds for select using (true);

-- ──────────────────────────────────────────────────────────────
-- CHILD EARNED ITEMS
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own children trophies"
  on public.child_trophies for select
  using (child_id in (select id from public.child_profiles where parent_id = auth.uid()));

create policy "Parent reads own children achievements"
  on public.child_achievements for select
  using (child_id in (select id from public.child_profiles where parent_id = auth.uid()));

create policy "Parent reads own children level rewards"
  on public.child_level_rewards for select
  using (child_id in (select id from public.child_profiles where parent_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────
-- SOCIAL
-- ──────────────────────────────────────────────────────────────

create policy "Child reads own friendships"
  on public.friendships for select
  using (
    child_id in (select id from public.child_profiles where parent_id = auth.uid())
    or
    friend_id in (select id from public.child_profiles where parent_id = auth.uid())
  );

create policy "Child reads received friend requests"
  on public.friend_requests for select
  using (
    from_child_id in (select id from public.child_profiles where parent_id = auth.uid())
    or
    to_child_id in (select id from public.child_profiles where parent_id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- ──────────────────────────────────────────────────────────────

create policy "Parent reads own notification prefs"
  on public.notification_preferences for select
  using (parent_id = auth.uid());

create policy "Parent upserts own notification prefs"
  on public.notification_preferences for insert
  with check (parent_id = auth.uid());

create policy "Parent updates own notification prefs"
  on public.notification_preferences for update
  using (parent_id = auth.uid());
