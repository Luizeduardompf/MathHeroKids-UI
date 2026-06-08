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
}

interface ChallengeState {
  // Session identity
  sessionId: string | null;
  childId: string | null;
  challengeDate: string | null; // YYYY-MM-DD
  moduleId: string;

  // Questions
  questions: Question[];
  currentQuestionIndex: number; // 0–19

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
  errorMessage: string | null;

  // ─── Actions ────────────────────────────────────────────────────────────────
  startSession: (params: {
    sessionId: string;
    childId: string;
    challengeDate: string;
    moduleId: string;
    questions: Question[];
    timerSeconds: number;
    resumeFromIndex?: number;
  }) => void;

  setPhase: (phase: ChallengePhase) => void;
  markQuestionStart: () => void;

  submitAnswer: (childAnswer: number | null) => void;
  /** Called when player opts to retry the current block */
  retryBlock: () => void;
  /** Called after milestone overlay is dismissed */
  dismissMilestone: () => void;

  reset: () => void;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectCurrentQuestion = (s: ChallengeState): Question | null =>
  s.questions[s.currentQuestionIndex] ?? null;

export const selectProgressFraction = (s: ChallengeState): number =>
  s.questions.length > 0 ? s.currentQuestionIndex / CHALLENGE.TOTAL_QUESTIONS : 0;

export const selectBlockQuestions = (s: ChallengeState): Question[] => {
  const start = (s.currentBlock - 1) * CHALLENGE.QUESTIONS_PER_BLOCK;
  return s.questions.slice(start, start + CHALLENGE.QUESTIONS_PER_BLOCK);
};

export const selectBlockCorrectCount = (s: ChallengeState): number =>
  s.blockAnswers.filter((a) => a.child_answer !== null && a.child_answer === a.operand_a * a.operand_b).length;

export const selectAllAnswers = (s: ChallengeState): AnswerDraft[] => s.answers;

// ─── Store ────────────────────────────────────────────────────────────────────

const initialState = {
  sessionId: null,
  childId: null,
  challengeDate: null,
  moduleId: 'multiplication',
  questions: [] as Question[],
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
  errorMessage: null as string | null,
};

export const useChallengeStore = create<ChallengeState>()((set, get) => ({
  ...initialState,

  startSession: ({ sessionId, childId, challengeDate, moduleId, questions, timerSeconds, resumeFromIndex = 0 }) => {
    const block = Math.floor(resumeFromIndex / CHALLENGE.QUESTIONS_PER_BLOCK) + 1;
    set({
      sessionId,
      childId,
      challengeDate,
      moduleId,
      questions,
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
    };

    const newBlockAnswers = [...state.blockAnswers, draft];
    const newAnswers = [...state.answers, draft];
    const nextIndex = state.currentQuestionIndex + 1;
    const isLastInBlock = nextIndex % CHALLENGE.QUESTIONS_PER_BLOCK === 0;
    const isMilestone = nextIndex === 5 || nextIndex === 10 || nextIndex === 15;
    const isLast = nextIndex >= CHALLENGE.TOTAL_QUESTIONS;

    if (!isCorrect) {
      // Wrong or timeout — continue to overlay
      set({
        answers: newAnswers,
        blockAnswers: newBlockAnswers,
        lastAnswerCorrect: false,
        lastCorrectAnswer: question.correct_answer,
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
      phase: 'correct',
    });
  },

  retryBlock: () => {
    const state = get();
    // Go back to start of current block
    const blockStart = (state.currentBlock - 1) * CHALLENGE.QUESTIONS_PER_BLOCK;
    set({
      currentQuestionIndex: blockStart,
      blockAttempt: state.blockAttempt + 1,
      blockAnswers: [],
      phase: 'playing',
      questionStartTime: Date.now(),
    });
  },

  dismissMilestone: () => {
    set({ phase: 'playing', questionStartTime: Date.now() });
  },

  reset: () => set({ ...initialState }),
}));
