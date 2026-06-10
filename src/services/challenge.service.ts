/**
 * Challenge service — abstracts calls to start_challenge and complete_challenge
 * Edge Functions. All XP and progression mutations happen server-side.
 *
 * Offline strategy: if complete_challenge fails due to network, the payload is
 * stored in AsyncStorage under OFFLINE_QUEUE_KEY and retried on the next call.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { CompleteChallengeResponse } from '@/types/database.types';
import type { AnswerDraft } from '@/stores/challenge.store';
import type { ModuleId, TimerOption, MultiplicationRange } from '@/constants/config';

const OFFLINE_QUEUE_KEY      = 'math-hero-offline-challenge-queue-v1';
const LOCAL_COMPLETIONS_KEY  = 'math-hero-local-completions-v1';

// ─── Local completion record ─────────────────────────────────────────────────
// Gravado no AsyncStorage sempre que um desafio é concluído localmente.
// Serve como fallback para o calendário quando a Edge Function não está deployada.

export interface LocalCompletion {
  childId:       string;
  challengeDate: string;   // YYYY-MM-DD
  isPerfect:     boolean;
  completedAt:   string;   // ISO timestamp
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartChallengeParams {
  childId: string;
  challengeDate: string;  // YYYY-MM-DD
  moduleId: ModuleId;
  sessionId: string;      // client-generated UUID
  questionSeed: string;
  timerSeconds: TimerOption;
  multiplicationMax: MultiplicationRange;
}

export interface StartChallengeResult {
  sessionId: string;
  status: 'new' | 'resumed';
  /** Last answered question_index if session was in_progress, else 0 */
  resumeFromIndex: number;
}

export interface CompletePayload {
  childId: string;
  challengeDate: string;
  sessionId: string;
  moduleId: ModuleId;
  timerSeconds: TimerOption;
  multiplicationMax: MultiplicationRange;
  answers: AnswerDraft[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const challengeService = {
  /**
   * Create or resume a challenge session (idempotent).
   * Calls the start_challenge Edge Function.
   */
  async startChallenge(params: StartChallengeParams): Promise<StartChallengeResult> {
    const { data, error } = await supabase.functions.invoke<StartChallengeResult>(
      'start_challenge',
      {
        body: {
          child_id: params.childId,
          challenge_date: params.challengeDate,
          module_id: params.moduleId,
          session_id: params.sessionId,
          question_seed: params.questionSeed,
          timer_seconds: params.timerSeconds,
          multiplication_max: params.multiplicationMax,
        },
      },
    );

    if (error) throw new Error(error.message);
    if (!data) throw new Error('errors.generic');

    return data;
  },

  /**
   * Submit the completed challenge to the server.
   * If offline, queues locally and returns null — caller should show a
   * "will sync when online" message.
   *
   * Returns CompleteChallengeResponse on success, null if queued offline.
   */
  async completeChallenge(
    payload: CompletePayload,
  ): Promise<CompleteChallengeResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke<CompleteChallengeResponse>(
        'complete_challenge',
        {
          body: {
            child_id: payload.childId,
            challenge_date: payload.challengeDate,
            session_id: payload.sessionId,
            module_id: payload.moduleId,
            timer_seconds: payload.timerSeconds,
            multiplication_max: payload.multiplicationMax,
            answers: payload.answers,
          },
        },
      );

      if (error) throw error;
      if (!data) throw new Error('errors.generic');

      // If we had queued items, try to flush them now
      await challengeService.flushOfflineQueue();

      return data;
    } catch (e) {
      const isNetworkError =
        e instanceof Error &&
        (e.message.includes('network') ||
          e.message.includes('fetch') ||
          e.message.includes('Failed to fetch'));

      if (isNetworkError) {
        await challengeService.queueOffline(payload);
        return null;
      }
      throw e;
    }
  },

  // ─── Offline queue ──────────────────────────────────────────────────────────

  async queueOffline(payload: CompletePayload): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: CompletePayload[] = raw ? (JSON.parse(raw) as CompletePayload[]) : [];
      // Deduplicate by sessionId
      const filtered = queue.filter((q) => q.sessionId !== payload.sessionId);
      filtered.push(payload);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    } catch {
      // AsyncStorage failure is non-fatal — data loss acceptable offline edge case
    }
  },

  async flushOfflineQueue(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;

      const queue: CompletePayload[] = JSON.parse(raw) as CompletePayload[];
      if (queue.length === 0) return;

      const remaining: CompletePayload[] = [];
      for (const payload of queue) {
        try {
          await challengeService.completeChallenge(payload);
        } catch {
          remaining.push(payload); // keep failed items for next attempt
        }
      }

      if (remaining.length === 0) {
        await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      } else {
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      }
    } catch {
      // Non-fatal
    }
  },

  // ─── Local completion fallback ───────────────────────────────────────────────

  /**
   * Persiste um completion local no AsyncStorage.
   * Chamado ao concluir o desafio, independentemente de a EF ter sucesso ou não.
   * Deduplica por (childId, challengeDate) — uma entrada por dia.
   */
  async storeLocalCompletion(
    childId:       string,
    challengeDate: string,
    isPerfect:     boolean,
  ): Promise<void> {
    try {
      const raw      = await AsyncStorage.getItem(LOCAL_COMPLETIONS_KEY);
      const existing = raw ? (JSON.parse(raw) as LocalCompletion[]) : [];
      // Remove entrada anterior do mesmo dia/criança (pode ter mudado isPerfect)
      const filtered = existing.filter(
        (c) => !(c.childId === childId && c.challengeDate === challengeDate),
      );
      filtered.push({ childId, challengeDate, isPerfect, completedAt: new Date().toISOString() });
      await AsyncStorage.setItem(LOCAL_COMPLETIONS_KEY, JSON.stringify(filtered));
    } catch {
      // Non-fatal — calendar fallback simplesmente não funcionará
    }
  },

  /**
   * Retorna as completions locais para um child dentro de um intervalo de datas.
   */
  async getLocalCompletions(
    childId:   string,
    dateFrom?: string,  // YYYY-MM-DD inclusive
    dateTo?:   string,  // YYYY-MM-DD inclusive
  ): Promise<LocalCompletion[]> {
    try {
      const raw  = await AsyncStorage.getItem(LOCAL_COMPLETIONS_KEY);
      if (!raw) return [];
      const all  = JSON.parse(raw) as LocalCompletion[];
      return all.filter((c) => {
        if (c.childId !== childId) return false;
        if (dateFrom && c.challengeDate < dateFrom) return false;
        if (dateTo   && c.challengeDate > dateTo)   return false;
        return true;
      });
    } catch {
      return [];
    }
  },

  async hasPendingOffline(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return false;
      const queue = JSON.parse(raw) as CompletePayload[];
      return queue.length > 0;
    } catch {
      return false;
    }
  },
};
