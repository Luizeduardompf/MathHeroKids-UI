/**
 * Database entity types — mirrors the PostgreSQL schema.
 * Generated types would normally come from `supabase gen types typescript`.
 * This is the hand-written version until Supabase is connected.
 */

import type { AvatarId, ModuleId, SupportedLocale, TimerOption, MultiplicationRange } from '@/constants/config';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type TrophyCategory = 'daily' | 'weekly' | 'monthly' | 'streak' | 'special';
export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type AchievementCategory = 'primeiros_passos' | 'sequencias' | 'habilidades' | 'especiais';
export type RewardType = 'frame' | 'outfit' | 'medal' | 'trophy_variant' | 'celebration';
export type ChallengeStatus = 'in_progress' | 'completed' | 'abandoned';
export type XpSource = 'correct_answer' | 'challenge_completion' | 'achievement' | 'trophy';

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ParentProfile {
  id: string; // UUID — same as auth.users.id
  name: string;
  pin_hash: string | null;
  language: SupportedLocale;
  created_at: string;
  updated_at: string;
}

export interface ChildProfile {
  id: string;
  parent_id: string;
  username: string;
  display_name: string;
  birth_date: string | null; // ISO date string
  avatar_id: AvatarId;
  // Progression (server-authoritative)
  xp_total: number;
  level: number;
  current_streak: number;
  best_streak: number;
  last_challenge_date: string | null; // ISO date
  // Settings
  timer_seconds: TimerOption;
  multiplication_max: MultiplicationRange;
  social_enabled: boolean;
  // Management
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChallengeSession {
  id: string; // client-generated UUID (idempotency key)
  child_id: string;
  challenge_date: string; // ISO date
  module_id: ModuleId;
  question_seed: string;
  status: ChallengeStatus;
  total_questions: number;
  correct_count: number;
  xp_awarded: number;
  is_retroactive: boolean;
  is_perfect: boolean;
  timer_seconds: TimerOption;
  multiplication_max: MultiplicationRange;
  started_at: string;
  completed_at: string | null;
}

export interface ChallengeAnswer {
  id: string;
  session_id: string;
  block_number: number; // 1–4
  attempt_number: number; // increments on block retry
  question_index: number; // 0–19
  operand_a: number;
  operand_b: number;
  correct_answer: number;
  child_answer: number | null; // null = timeout
  is_correct: boolean;
  time_taken_ms: number | null;
  xp_awarded: number; // 0 on retry attempts
}

export interface ChildXpLedger {
  id: string;
  child_id: string;
  source: XpSource;
  amount: number;
  reference_id: string | null;
  created_at: string;
}

export type CalendarDayState = 'completed' | 'failed' | 'in_progress';

export interface CalendarDay {
  id: string;
  child_id: string;
  day_date: string; // ISO date
  state: CalendarDayState;
  is_perfect: boolean;
  session_id: string | null;
}

export interface Trophy {
  id: string;
  name_key: string;
  description_key: string;
  category: TrophyCategory;
  tier: TrophyTier;
  requirement_type: string;
  requirement_value: number;
  icon_asset: string;
  sort_order: number;
}

export interface ChildTrophy {
  id: string;
  child_id: string;
  trophy_id: string;
  earned_at: string;
  progress: number;
  trophy?: Trophy;
}

export interface Achievement {
  id: string;
  name_key: string;
  description_key: string;
  category: AchievementCategory;
  condition_type: string;
  condition_value: number | null;
  icon_asset: string;
  sort_order: number;
}

export interface ChildAchievement {
  id: string;
  child_id: string;
  achievement_id: string;
  earned_at: string;
  progress: number;
  achievement?: Achievement;
}

export interface LevelReward {
  id: string;
  name_key: string;
  reward_type: RewardType;
  unlock_level: number;
  icon_asset: string;
  sort_order: number;
}

export interface ChildLevelReward {
  id: string;
  child_id: string;
  reward_id: string;
  unlocked_at: string;
  reward?: LevelReward;
}

export interface Friendship {
  child_id: string;
  friend_id: string;
  created_at: string;
  friend?: ChildProfile;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface FriendRequest {
  id: string;
  from_child_id: string;
  to_child_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
  from_child?: Pick<ChildProfile, 'id' | 'username' | 'display_name' | 'avatar_id' | 'level'>;
}

export interface LevelThreshold {
  level: number;
  xp_required: number;
  name_key: string;
}

export interface NotificationPreferences {
  id: string;
  parent_id: string;
  daily_reminder: boolean;
  reminder_time: string; // HH:MM:SS
  push_token: string | null;
  updated_at: string;
}

// ─── API Response shapes ───────────────────────────────────────────────────────

export interface CompleteChallengeResponse {
  session: ChallengeSession;
  xp_earned: number;
  level_up: boolean;
  new_level: number | null;
  unlocked_reward: LevelReward | null;
  trophies_earned: Trophy[];
  achievements_earned: Achievement[];
}
