import { supabase } from '@/lib/supabase';
import type { ChildProfile } from '@/types';
import type { AvatarId, TimerOption, MultiplicationRange } from '@/constants/config';
import { DEFAULT_TIMER, DEFAULT_MULTIPLICATION_MAX } from '@/constants/config';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateChildInput {
  display_name: string;
  username: string;
  birth_date: string | null; // ISO date string (YYYY-MM-DD) or null
  avatar_id: AvatarId;
}

export interface UpdateChildInput {
  display_name?: string;
  username?: string;
  birth_date?: string | null;
  avatar_id?: AvatarId;
  timer_seconds?: TimerOption;
  multiplication_max?: MultiplicationRange;
  social_enabled?: boolean;
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapChildError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === '23505') {
    // PostgreSQL unique constraint violation — username already taken
    return 'errors.validation.usernameTaken';
  }
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'errors.network';
  }
  return 'errors.generic';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const childService = {
  /**
   * Fetch all active children for the given parent, ordered by sort_order.
   */
  async listChildren(parentId: string): Promise<ChildProfile[]> {
    const { data, error } = await supabase
      .from('child_profiles')
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw new Error(mapChildError(error));
    return (data ?? []) as ChildProfile[];
  },

  /**
   * Create a new child profile linked to the authenticated parent.
   * Throws a translatable error key string on failure.
   */
  async createChild(
    parentId: string,
    input: CreateChildInput,
  ): Promise<ChildProfile> {
    const { data, error } = await supabase
      .from('child_profiles')
      .insert({
        parent_id: parentId,
        display_name: input.display_name.trim(),
        username: input.username.trim().toLowerCase(),
        birth_date: input.birth_date,
        avatar_id: input.avatar_id,
        timer_seconds: DEFAULT_TIMER,
        multiplication_max: DEFAULT_MULTIPLICATION_MAX,
      })
      .select()
      .single();

    if (error) {
      console.error('[child.createChild] error:', error.code, error.message, error.details, error.hint);
      throw new Error(__DEV__ ? `${error.code}: ${error.message}` : mapChildError(error));
    }
    return data as ChildProfile;
  },

  /**
   * Update mutable fields of a child profile.
   * Progression fields (xp_total, level, streak, etc.) are NOT allowed here —
   * those are server-authoritative via Edge Functions.
   */
  async updateChild(
    childId: string,
    updates: UpdateChildInput,
  ): Promise<ChildProfile> {
    const { data, error } = await supabase
      .from('child_profiles')
      .update(updates)
      .eq('id', childId)
      .select()
      .single();

    if (error) throw new Error(mapChildError(error));
    return data as ChildProfile;
  },

  /**
   * Soft-delete a child profile (sets is_active = false).
   * Hard delete is not supported in MVP.
   */
  async deactivateChild(childId: string): Promise<void> {
    const { error } = await supabase
      .from('child_profiles')
      .update({ is_active: false })
      .eq('id', childId);

    if (error) throw new Error(mapChildError(error));
  },

  /**
   * Check if a username is available (case-insensitive).
   * Returns true if available.
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('child_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('username', username.trim().toLowerCase());

    if (error) throw new Error(mapChildError(error));
    return (count ?? 0) === 0;
  },
};
