/**
 * Challenge session store.
 *
 * Manages the active challenge gameplay state: current question, answers buffer,
 * block checkpoints, and timer. Does NOT persist to AsyncStorage — a challenge
 * session is ephemeral UI state. The offline queue (unsent payloads) uses a
 * separate AsyncStorage mechanism in challenge.service.ts.
 */

import { create } from 'zustand';
import type { Question } from '@/lib/question-generator';
import type { ChallengeAnswer } from '@/types/database.types';
import { CHALLENGE } from '@/constants/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengePhase =
  | 'idle'           // no active session
  | 'loading'        // calling start_challenge EF
  | 'playing'        // question is visible, timer running
  | 'correct'        // correct answer overlay
  | 'wrong'          // wrong answer overlay
  | 'timeout'        // time expired overlay
  | 'block_end'      // end of a 5-question block — show retry or continue
  | 'milestone'      // Q5/Q10/Q15 Milo message
  | 'completed'      // all 20 questions done
  | 'submitting'     // sending to complete_challenge EF
  | 'error';         // EF call failed

export interface AnswerDraft {
  question_index: number;
  block_number: number;       // 1–4
  attempt_number: number;     // 1+ (increments on block retry)
  operand_a: number;
  operand_b: number;
  child_answer: number | null; // null = timeout
  time_taken_ms: number | null;
  /** Phase 2.5+: fact_id do catálogo (e.g. 'fact_7x8'). Presente quando questões vêm do servidor. */
  fact_id?: string;
  /** Phase 2.5+: posição 1-based retornada pelo servidor */
  position?: number;
}

interface ChallengeState {
  // Session identity
  sessionId: string | null;
  childId: string | null;
  challengeDate: string | null; // YYYY-MM-DD
  moduleId: string;

  // Questions
  questions: Question[];
  currentQuestionIndex: number; // 0–(totalQuestions-1)
  totalQuestions: number;       // configurable per session (default 20)

  // Answers collected this session (all attempts including retries)
  answers: AnswerDraft[];

  // Block state
  currentBlock: number;       // 1–4
  blockAttempt: number;       // increments on retry
  blockAnswers: AnswerDraft[]; // answers for current block attempt only

  // Timer
  timerSeconds: number;       // configured limit (0 = unlimited)
  questionStartTime: number;  // Date.now() when question was presented

  // Phase / UI
  phase: ChallengePhase;
  lastAnswerCorrect: boolean | null;
  lastCorrectAnswer: number | null;
  lastUserAnswer: number | null;
  lastAnsweredQuestion: { operand_a: number; operand_b: number; correct_answer: number } | null;
  errorMessage: string | null;

  // ─── Actions ────────────────────────────────────────────────────────────────
  startSession: (params: {
    sessionId: string;
    childId: string;
    challengeDate: string;
    moduleId: string;
    questions: Question[];
    timerSeconds: number;
    totalQuestions?: number;  // defaults to questions.length
    resumeFromIndex?: number;
  }) => void;

  setPhase: (phase: ChallengePhase) => void;
  markQuestionStart: () => void;

  submitAnswer: (childAnswer: number | null) => void;
  /** Called when player opts to retry the current block */
  retryBlock: () => void;
  /** Called when player accepts wrong answer and advances to next question */
  advanceAfterWrong: () => void;
  /** Called after milestone overlay is dismissed */
  dismissMilestone: () => void;

  reset: () => void;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectCurrentQuestion = (s: ChallengeState): Question | null =>
  s.questions[s.currentQuestionIndex] ?? null;

export const selectProgressFraction = (s: ChallengeState): number =>
  s.totalQuestions > 0 ? s.currentQuestionIndex / s.totalQuestions : 0;

export const selectBlockQuestions = (s: ChallengeState): Question[] => {
  const start = (s.currentBlock - 1) * CHALLENGE.QUESTIONS_PER_BLOCK;
  return s.questions.slice(start, start + CHALLENGE.QUESTIONS_PER_BLOCK);
};

export const selectBlockCorrectCount = (s: ChallengeState): number =>
  s.blockAnswers.filter((a) => a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b).length;

export const selectAllAnswers = (s: ChallengeState): AnswerDraft[] => s.answers;

export const selectSessionXp = (s: ChallengeState): number => {
  const correct = new Set(
    s.answers
      .filter((a) => a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b)
      .map((a) => a.question_index),
  );
  return correct.size * CHALLENGE.XP_PER_CORRECT_ANSWER;
};

export const selectUniqueCorrectCount = (s: ChallengeState): number => {
  return new Set(
    s.answers
      .filter((a) => a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b)
      .map((a) => a.question_index),
  ).size;
};

// ─── Store ────────────────────────────────────────────────────────────────────

const initialState = {
  sessionId: null,
  childId: null,
  challengeDate: null,
  moduleId: 'multiplication',
  questions: [] as Question[],
  totalQuestions: CHALLENGE.TOTAL_QUESTIONS,
  currentQuestionIndex: 0,
  answers: [] as AnswerDraft[],
  currentBlock: 1,
  blockAttempt: 1,
  blockAnswers: [] as AnswerDraft[],
  timerSeconds: 15,
  questionStartTime: 0,
  phase: 'idle' as ChallengePhase,
  lastAnswerCorrect: null as boolean | null,
  lastCorrectAnswer: null as number | null,
  lastUserAnswer: null as number | null,
  lastAnsweredQuestion: null as { operand_a: number; operand_b: number; correct_answer: number } | null,
  errorMessage: null as string | null,
};

export const useChallengeStore = create<ChallengeState>()((set, get) => ({
  ...initialState,

  startSession: ({ sessionId, childId, challengeDate, moduleId, questions, timerSeconds, totalQuestions, resumeFromIndex = 0 }) => {
    const total = totalQuestions ?? questions.length;
    const block = Math.floor(resumeFromIndex / CHALLENGE.QUESTIONS_PER_BLOCK) + 1;
    set({
      sessionId,
      childId,
      challengeDate,
      moduleId,
      questions,
      totalQuestions: total,
      currentQuestionIndex: resumeFromIndex,
      answers: [],
      currentBlock: block,
      blockAttempt: 1,
      blockAnswers: [],
      timerSeconds,
      questionStartTime: Date.now(),
      phase: 'playing',
      lastAnswerCorrect: null,
      lastCorrectAnswer: null,
      lastUserAnswer: null,
      lastAnsweredQuestion: null,
      errorMessage: null,
    });
  },

  setPhase: (phase) => set({ phase }),

  markQuestionStart: () => set({ questionStartTime: Date.now() }),

  submitAnswer: (childAnswer) => {
    const state = get();
    const question = state.questions[state.currentQuestionIndex];
    if (!question) return;

    const timeTakenMs = state.questionStartTime > 0
      ? Date.now() - state.questionStartTime
      : null;

    const isCorrect = childAnswer !== null && childAnswer === question.correct_answer;

    const draft: AnswerDraft = {
      question_index: question.index,
      block_number: state.currentBlock,
      attempt_number: state.blockAttempt,
      operand_a: question.operand_a,
      operand_b: question.operand_b,
      child_answer: childAnswer,
      time_taken_ms: timeTakenMs,
      // Phase 2.5+: presentes quando questões vêm do servidor
      ...(question.fact_id != null ? { fact_id: question.fact_id } : {}),
      ...(question.fact_id != null ? { position: question.index + 1 } : {}),
    };

    const newBlockAnswers = [...state.blockAnswers, draft];
    const newAnswers = [...state.answers, draft];
    const nextIndex = state.currentQuestionIndex + 1;
    const isLastInBlock = nextIndex % CHALLENGE.QUESTIONS_PER_BLOCK === 0;
    const total = state.totalQuestions;
    // Milestones at 25%, 50%, 75% of totalQuestions
    const q25 = Math.floor(total * 0.25);
    const q50 = Math.floor(total * 0.5);
    const q75 = Math.floor(total * 0.75);
    const isMilestone = (nextIndex === q25 || nextIndex === q50 || nextIndex === q75) && nextIndex > 0 && nextIndex < total;
    const isLast = nextIndex >= total;

    if (!isCorrect) {
      // Wrong or timeout — store for display in overlay
      set({
        answers: newAnswers,
        blockAnswers: newBlockAnswers,
        lastAnswerCorrect: false,
        lastCorrectAnswer: question.correct_answer,
        lastUserAnswer: childAnswer,
        lastAnsweredQuestion: {
          operand_a: question.operand_a,
          operand_b: question.operand_b,
          correct_answer: question.correct_answer,
        },
        phase: childAnswer === null ? 'timeout' : 'wrong',
      });
      return;
    }

    // Correct answer
    if (isLast) {
      set({
        answers: newAnswers,
        blockAnswers: newBlockAnswers,
        currentQuestionIndex: nextIndex,
        lastAnswerCorrect: true,
        lastCorrectAnswer: null,
        lastUserAnswer: null,
        lastAnsweredQuestion: null,
        phase: 'completed',
      });
      return;
    }

    if (isLastInBlock) {
      set({
        answers: newAnswers,
        currentQuestionIndex: nextIndex,
        currentBlock: state.currentBlock + 1,
        blockAttempt: 1,
        blockAnswers: [],
        lastAnswerCorrect: true,
        lastCorrectAnswer: null,
        lastUserAnswer: null,
        lastAnsweredQuestion: null,
        phase: isMilestone ? 'milestone' : 'correct',
      });
      return;
    }

    if (isMilestone) {
      set({
        answers: newAnswers,
        blockAnswers: newBlockAnswers,
        currentQuestionIndex: nextIndex,
        lastAnswerCorrect: true,
        lastCorrectAnswer: null,
        lastUserAnswer: null,
        lastAnsweredQuestion: null,
        phase: 'milestone',
      });
      return;
    }

    set({
      answers: newAnswers,
      blockAnswers: newBlockAnswers,
      currentQuestionIndex: nextIndex,
      lastAnswerCorrect: true,
      lastCorrectAnswer: null,
      lastUserAnswer: null,
      lastAnsweredQuestion: null,
      phase: 'correct',
    });
  },

  retryBlock: () => {
    const state = get();
    const blockStart = (state.currentBlock - 1) * CHALLENGE.QUESTIONS_PER_BLOCK;
    set({
      currentQuestionIndex: blockStart,
      blockAttempt: state.blockAttempt + 1,
      blockAnswers: [],
      phase: 'playing',
      questionStartTime: Date.now(),
    });
  },

  advanceAfterWrong: () => {
    const state = get();
    const nextIndex = state.currentQuestionIndex + 1;

    if (nextIndex >= state.totalQuestions) {
      set({ currentQuestionIndex: nextIndex, phase: 'completed' });
      return;
    }

    const isLastInBlock = nextIndex % CHALLENGE.QUESTIONS_PER_BLOCK === 0;
    const q25 = Math.floor(state.totalQuestions * 0.25);
    const q50 = Math.floor(state.totalQuestions * 0.5);
    const q75 = Math.floor(state.totalQuestions * 0.75);
    const isMilestone = (nextIndex === q25 || nextIndex === q50 || nextIndex === q75) && nextIndex > 0 && nextIndex < state.totalQuestions;

    set({
      currentQuestionIndex: nextIndex,
      ...(isLastInBlock ? { currentBlock: state.currentBlock + 1, blockAttempt: 1, blockAnswers: [] } : {}),
      phase: isMilestone ? 'milestone' : 'playing',
    });
  },

  dismissMilestone: () => {
    set({ phase: 'playing', questionStartTime: Date.now() });
  },

  reset: () => set({ ...initialState }),
}));
