/**
 * gamification.service.ts — Trophies, Achievements, Level Rewards
 *
 * Todas as leituras do catálogo + estado do child.
 * Escrita apenas via Edge Functions (complete_challenge).
 */

import { supabase } from '@/lib/supabase';
import type {
  Achievement,
  ChildAchievement,
  ChildTrophy,
  LevelReward,
  Trophy,
} from '@/types/database.types';

// ─── Trophies ─────────────────────────────────────────────────────────────────

export interface TrophyWithState extends Trophy {
  earned: boolean;
  earned_at?: string;
  progress: number; // earned count or 0
}

export async function fetchTrophiesWithState(childId: string): Promise<TrophyWithState[]> {
  const [catalogRes, earnedRes] = await Promise.all([
    supabase.from('trophies').select('*').order('sort_order'),
    supabase.from('child_trophies').select('*').eq('child_id', childId),
  ]);

  if (catalogRes.error) throw catalogRes.error;

  const earnedMap = new Map<string, ChildTrophy>(
    (earnedRes.data ?? []).map((ct: ChildTrophy) => [ct.trophy_id, ct]),
  );

  return (catalogRes.data as Trophy[]).map((t) => {
    const ct = earnedMap.get(t.id);
    return {
      ...t,
      earned: !!ct,
      earned_at: ct?.earned_at,
      progress: ct?.progress ?? 0,
    };
  });
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export interface AchievementWithState extends Achievement {
  earned: boolean;
  earned_at?: string;
  progress: number;
}

export async function fetchAchievementsWithState(childId: string): Promise<AchievementWithState[]> {
  const [catalogRes, earnedRes] = await Promise.all([
    supabase.from('achievements').select('*').order('sort_order'),
    supabase.from('child_achievements').select('*').eq('child_id', childId),
  ]);

  if (catalogRes.error) throw catalogRes.error;

  const earnedMap = new Map<string, ChildAchievement>(
    (earnedRes.data ?? []).map((ca: ChildAchievement) => [ca.achievement_id, ca]),
  );

  return (catalogRes.data as Achievement[]).map((a) => {
    const ca = earnedMap.get(a.id);
    return {
      ...a,
      earned: !!ca,
      earned_at: ca?.earned_at,
      progress: ca?.progress ?? 0,
    };
  });
}

// ─── Level Rewards ────────────────────────────────────────────────────────────

export interface LevelRewardWithState extends LevelReward {
  unlocked: boolean;
  unlocked_at?: string;
}

export async function fetchLevelRewards(childId: string): Promise<LevelRewardWithState[]> {
  const [rewardsRes, unlockedRes] = await Promise.all([
    supabase.from('level_rewards').select('*').order('unlock_level'),
    supabase.from('child_level_rewards').select('*').eq('child_id', childId),
  ]);

  if (rewardsRes.error) throw rewardsRes.error;

  const unlockedSet = new Set<string>(
    (unlockedRes.data ?? []).map((r: { reward_id: string }) => r.reward_id),
  );

  return (rewardsRes.data as LevelReward[]).map((r) => ({
    ...r,
    unlocked: unlockedSet.has(r.id),
  }));
}

// ─── Level thresholds ─────────────────────────────────────────────────────────

export interface LevelThreshold {
  level: number;
  xp_required: number;
  name_key: string;
}

export async function fetchLevelThresholds(): Promise<LevelThreshold[]> {
  const { data, error } = await supabase
    .from('level_thresholds')
    .select('*')
    .order('level');
  if (error) throw error;
  return data as LevelThreshold[];
}
