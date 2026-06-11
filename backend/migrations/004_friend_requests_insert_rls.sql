-- ============================================================
-- Migration 004 — friend_requests INSERT policy
-- Math Hero Kids
-- ============================================================
-- Allows a parent to insert friend_requests for their own children.
-- This enables the client-side fallback in social.service.ts when
-- the Edge Function is temporarily unavailable.
-- ============================================================

create policy "Parents can insert friend_requests for their children"
  on public.friend_requests for insert
  with check (
    from_child_id in (
      select id from public.child_profiles where parent_id = auth.uid()
    )
  );
