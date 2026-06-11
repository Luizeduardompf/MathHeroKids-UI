-- ============================================================
-- Migration 005 — child_profiles.last_seen_at
-- Math Hero Kids
-- ============================================================
-- Tracks the last time a child accessed the app.
-- Used to display "last access" in the parent area and to
-- trigger re-engagement reminders (push notifications).
-- ============================================================

alter table public.child_profiles
  add column if not exists last_seen_at timestamptz;

-- Index for querying inactive children (reminder logic)
create index if not exists idx_child_profiles_last_seen
  on public.child_profiles (last_seen_at)
  where is_active = true;
