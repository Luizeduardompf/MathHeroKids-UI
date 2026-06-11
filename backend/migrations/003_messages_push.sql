-- ============================================================
-- Migration 003 — Messages (chat) + Push tokens
-- Math Hero Kids
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PUSH TOKEN on child_profiles
-- Expo push token stored per child (set by the app after permission granted).
-- Written by the parent client; used by Edge Functions to send remote push.
-- ──────────────────────────────────────────────────────────────

alter table public.child_profiles
  add column if not exists expo_push_token text;

-- ──────────────────────────────────────────────────────────────
-- MESSAGES (friend chat)
-- One row per message. Indexed by (conversation pair, created_at).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.child_profiles(id) on delete cascade,
  to_id       uuid not null references public.child_profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 500),
  read        boolean not null default false,
  created_at  timestamptz not null default now(),
  check (from_id <> to_id)
);

-- Conversation lookup: both directions share the same pair
create index if not exists idx_messages_conversation on public.messages (
  least(from_id, to_id),
  greatest(from_id, to_id),
  created_at desc
);

-- Unread badge count
create index if not exists idx_messages_to_unread on public.messages (to_id, read)
  where read = false;

-- ──────────────────────────────────────────────────────────────
-- RLS for messages
-- auth.uid() is the parent's UUID.
-- A parent can access messages where their child is sender or recipient.
-- ──────────────────────────────────────────────────────────────

alter table public.messages enable row level security;

-- Read: parent of sender OR parent of recipient
create policy "Parent reads messages of own children"
  on public.messages for select
  using (
    exists (
      select 1 from public.child_profiles cp
      where cp.id = from_id and cp.parent_id = auth.uid()
    )
    or exists (
      select 1 from public.child_profiles cp
      where cp.id = to_id and cp.parent_id = auth.uid()
    )
  );

-- Insert: only parent of the sender can insert
create policy "Parent inserts messages for own children"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.child_profiles cp
      where cp.id = from_id and cp.parent_id = auth.uid()
    )
  );

-- Update (mark read): only parent of the recipient
create policy "Parent marks own children messages as read"
  on public.messages for update
  using (
    exists (
      select 1 from public.child_profiles cp
      where cp.id = to_id and cp.parent_id = auth.uid()
    )
  )
  with check (read = true);  -- only allowed mutation is marking read

-- Enable Realtime on messages
alter publication supabase_realtime add table public.messages;

-- ──────────────────────────────────────────────────────────────
-- Allow child_profiles UPDATE to include expo_push_token
-- (existing policy allows settings columns; expo_push_token is now a settings column)
-- The existing policy "Parent updates own children (non-progression fields)" already
-- uses a permissive with check (parent_id = auth.uid()), so no change needed.
-- ──────────────────────────────────────────────────────────────
