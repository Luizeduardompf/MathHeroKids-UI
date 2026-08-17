/**
 * Tabuada Semanal Premiada — store da sessão de jogo de UM bloco (20 questões).
 *
 * Modelado em challenge.store.ts mas simplificado: este módulo não tem marcos (25/50/75%)
 * nem blocos múltiplos dentro da mesma sessão — cada "sessão" de jogo é um único bloco de
 * 20 questões. A tela de overview (app/(app)/tabuada-semanal/index.tsx) decide qual bloco
 * abrir a seguir; a tela de jogo (play.tsx) chama startBlock() uma vez por bloco.
 * Efémero — não persiste em AsyncStorage.
 */

import { create } from 'zustand';
import type { TabuadaQuestion } from '@/types/database.types';
import { WEEKLY_TABUADA, computeAnswer } from '@/constants/config';

export type TabuadaPlayPhase =
  | 'idle'
  | 'playing'
  | 'correct'
  | 'wrong'
  | 'timeout'
  | 'completed'  // as 20 questões do bloco foram respondidas — a tela submete ao servidor
  | 'submitting'
  | 'error';

export interface TabuadaPlayQuestion extends TabuadaQuestion {
  correct_answer: number; // computado localmente via computeAnswer(operation, a, b) — só para feedback imediato
}

export interface TabuadaAnswerDraft {
  position: number;
  fact_id: string;
  operand_a: number;
  operand_b: number;
  operation: TabuadaQuestion['operation'];
  correct_answer: number;
  child_answer: number | null; // null = timeout
}

interface TabuadaPlayState {
  blockNumber: number | null;
  questions: TabuadaPlayQuestion[];
  currentIndex: number; // 0..19
  answers: TabuadaAnswerDraft[];
  questionStartTime: number;

  phase: TabuadaPlayPhase;
  lastAnswerCorrect: boolean | null;
  lastCorrectAnswer: number | null;
  lastUserAnswer: number | null;
  lastAnsweredQuestion: { operand_a: number; operand_b: number; operation: TabuadaQuestion['operation']; correct_answer: number } | null;
  errorMessage: string | null;

  startBlock: (blockNumber: number, questions: TabuadaQuestion[]) => void;
  setPhase: (phase: TabuadaPlayPhase) => void;
  markQuestionStart: () => void;
  submitAnswer: (childAnswer: number | null) => void;
  advanceAfterWrong: () => void;
  reset: () => void;
}

export const selectCurrentQuestion = (s: TabuadaPlayState): TabuadaPlayQuestion | null =>
  s.questions[s.currentIndex] ?? null;

export const selectProgressFraction = (s: TabuadaPlayState): number =>
  s.questions.length > 0 ? s.currentIndex / s.questions.length : 0;

export const selectCorrectCount = (s: TabuadaPlayState): number =>
  s.answers.filter((a) => a.child_answer !== null && a.child_answer === a.correct_answer).length;

const initialState = {
  blockNumber: null as number | null,
  questions: [] as TabuadaPlayQuestion[],
  currentIndex: 0,
  answers: [] as TabuadaAnswerDraft[],
  questionStartTime: 0,
  phase: 'idle' as TabuadaPlayPhase,
  lastAnswerCorrect: null as boolean | null,
  lastCorrectAnswer: null as number | null,
  lastUserAnswer: null as number | null,
  lastAnsweredQuestion: null as { operand_a: number; operand_b: number; operation: TabuadaQuestion['operation']; correct_answer: number } | null,
  errorMessage: null as string | null,
};

export const useTabuadaSemanalStore = create<TabuadaPlayState>()((set, get) => ({
  ...initialState,

  startBlock: (blockNumber, questions) => {
    const playQuestions: TabuadaPlayQuestion[] = questions.map((q) => ({
      ...q,
      correct_answer: computeAnswer(q.operation, q.operand_a, q.operand_b),
    }));
    set({
      blockNumber,
      questions: playQuestions,
      currentIndex: 0,
      answers: [],
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
    const question = state.questions[state.currentIndex];
    if (!question) return;

    const isCorrect = childAnswer !== null && childAnswer === question.correct_answer;

    const draft: TabuadaAnswerDraft = {
      position: question.position,
      fact_id: question.fact_id,
      operand_a: question.operand_a,
      operand_b: question.operand_b,
      operation: question.operation,
      correct_answer: question.correct_answer,
      child_answer: childAnswer,
    };

    const newAnswers = [...state.answers, draft];
    const nextIndex = state.currentIndex + 1;
    const isLast = nextIndex >= WEEKLY_TABUADA.QUESTIONS_PER_BLOCK;

    if (!isCorrect) {
      set({
        answers: newAnswers,
        lastAnswerCorrect: false,
        lastCorrectAnswer: question.correct_answer,
        lastUserAnswer: childAnswer,
        lastAnsweredQuestion: {
          operand_a: question.operand_a,
          operand_b: question.operand_b,
          operation: question.operation,
          correct_answer: question.correct_answer,
        },
        phase: childAnswer === null ? 'timeout' : 'wrong',
      });
      return;
    }

    if (isLast) {
      set({
        answers: newAnswers,
        currentIndex: nextIndex,
        lastAnswerCorrect: true,
        lastCorrectAnswer: null,
        lastUserAnswer: null,
        lastAnsweredQuestion: null,
        phase: 'completed',
      });
      return;
    }

    set({
      answers: newAnswers,
      currentIndex: nextIndex,
      lastAnswerCorrect: true,
      lastCorrectAnswer: null,
      lastUserAnswer: null,
      lastAnsweredQuestion: null,
      phase: 'correct',
      questionStartTime: Date.now(),
    });
  },

  advanceAfterWrong: () => {
    const state = get();
    const nextIndex = state.currentIndex + 1;
    const isLast = nextIndex >= WEEKLY_TABUADA.QUESTIONS_PER_BLOCK;

    set({
      currentIndex: nextIndex,
      phase: isLast ? 'completed' : 'playing',
      questionStartTime: Date.now(),
    });
  },

  reset: () => set({ ...initialState }),
}));
