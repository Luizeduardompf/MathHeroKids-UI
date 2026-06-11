export * from './database.types';

// ─── Utility Types ────────────────────────────────────────────────────────────

/** Make selected keys required */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make selected keys optional */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Deep readonly */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// ─── UI Types ─────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type InputVariant = 'default' | 'error' | 'success';

export type BadgeVariant =
  | 'primary'
  | 'accent'
  | 'success'
  | 'error'
  | 'warning'
  | 'neutral'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'diamond';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// ─── Challenge Types (Phase 2.5 — server-side adaptive) ───────────────────────

export type MasteryState = 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED' | 'WEAK';

/** Questao retornada pelo servidor em start_challenge (Phase 2.5+) */
export interface ChallengeQuestion {
  position: number;      // 1..20
  fact_id: string;       // e.g. 'fact_7x8'
  operand_a: number;
  operand_b: number;
  bucket: MasteryState;
}

/** Resposta de start_challenge (Phase 2.5+) */
export interface ChallengeStartResponse {
  sessionId: string;
  status: 'new' | 'resumed';
  questions: ChallengeQuestion[];
  rulesVersion: number;
}
