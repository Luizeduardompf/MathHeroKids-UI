/**
 * Database entity types — mirrors the PostgreSQL schema.
 * Generated types would normally come from `supabase gen types typescript`.
 * This is the hand-written version until Supabase is connected.
 */

import type { AvatarId, ModuleId, SupportedLocale, TimerOption, MultiplicationRange, QuestionCountOption } from '@/constants/config';

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
  whatsapp_phone: string | null;
  whatsapp_phone_ddi: string;
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
  timer_auto: boolean;
  multiplication_max: MultiplicationRange;
  social_enabled: boolean;
  question_count: QuestionCountOption;
  enabled_operations: ModuleId[];
  mix_operations: boolean;
  // WhatsApp — número próprio, opcional (nem toda criança tem telefone)
  whatsapp_phone: string | null;
  whatsapp_phone_ddi: string;
  // Tabuada Semanal Premiada — migrations 021/022
  tabuada_enabled: boolean;
  tabuada_use_general_settings: boolean;
  tabuada_weekly_reward: number;
  // Management
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null; // set by client on each app open
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
  is_retroactive: boolean;
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
  // "daily_reminder" — reaproveita as colunas originais (001), agora também gatilho WhatsApp
  daily_reminder: boolean;
  reminder_time: string; // "HH:MM:SS"
  push_token: string | null;
  whatsapp_enabled: boolean;
  unfinished_warning_enabled: boolean;
  unfinished_warning_time: string;
  completed_notice_enabled: boolean;
  completed_notice_time: string;
  weekly_summary_enabled: boolean;
  weekly_summary_weekday: number; // 0 = domingo ... 6 = sábado
  weekly_summary_time: string;
  // Aviso único (sem horário) quando o filho completa a Tabuada Semanal Premiada — migration 020
  tabuada_medal_notice_enabled: boolean;
  // Resumo semanal da Tabuada — domingo 21h fixo (sem picker) — migration 021
  tabuada_weekly_summary_enabled: boolean;
  // Aviso ao pai sempre que o filho conclui o dia da Tabuada (5 blocos + desafio diário) —
  // sem horário fixo, mesmo padrão do medal_notice — migration 023
  tabuada_day_completed_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildNotificationSettings {
  child_id: string;
  whatsapp_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  unfinished_warning_enabled: boolean;
  unfinished_warning_time: string;
  // Lembretes da Tabuada Semanal Premiada — até 4 horas (0-23), migration 020
  tabuada_reminder_enabled: boolean;
  tabuada_reminder_hours: number[];
  // Resumo semanal da Tabuada enviado à própria criança — mesmo horário fixo do pai — migration 021
  tabuada_weekly_summary_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Tabuada Semanal Premiada (migration 020) ──────────────────────────────────
// Módulo independente do desafio diário — ver comentário em src/constants/config.ts
// (WEEKLY_TABUADA) e no topo da migration para o racional completo.

export interface TabuadaQuestion {
  position: number; // 1..100
  block_number: number; // 1..5
  fact_id: string;
  operand_a: number;
  operand_b: number;
}

export type TabuadaBlockStatus = 'pending' | 'passed';

export interface TabuadaBlockState {
  block_number: number;
  status: TabuadaBlockStatus;
  attempts: number;
  best_correct_count: number;
  passed_at: string | null;
}

export interface WeeklyTabuadaDay {
  id: string;
  child_id: string;
  day_date: string; // ISO date
  questions_payload: TabuadaQuestion[];
  blocks_state: TabuadaBlockState[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyTabuadaWeek {
  id: string;
  child_id: string;
  week_start_date: string; // ISO date, sempre segunda-feira
  days_completed: number;
  medal_earned_at: string | null;
  medal_notified_at: string | null;
  updated_at: string;
}

export interface StartTabuadaDayResponse {
  dayDate: string;
  status: 'new' | 'resumed' | 'completed';
  questions: TabuadaQuestion[];
  blocksState: TabuadaBlockState[];
}

export interface SubmitTabuadaBlockResponse {
  dayCompleted: boolean;
  /** true quando os 5 blocos da tabuada passaram, mesmo que dayCompleted ainda seja false (falta o desafio diário normal, o "6º bloco"). */
  tabuadaBlocksPassed: boolean;
  blockPassed: boolean;
  correctCount: number;
  blocksState: TabuadaBlockState[];
  weekStatus: {
    weekStartDate: string;
    daysCompleted: number;
    medalEarned: boolean;
  };
}

// ─── API Response shapes ───────────────────────────────────────────────────────

export interface CompleteChallengeResponse {
  session: ChallengeSession;
  xp_earned: number;
  /** Novo total cumulativo de XP da criança (child_profiles.xp_total já actualizado). */
  xp_total: number;
  level_up: boolean;
  new_level: number | null;
  unlocked_reward: LevelReward | null;
  trophies_earned: Trophy[];
  achievements_earned: Achievement[];
}
