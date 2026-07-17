/**
 * Challenge service — abstracts calls to start_challenge and complete_challenge
 * Edge Functions. All XP and progression mutations happen server-side.
 *
 * Phase 2.5+: start_challenge retorna questions geradas adaptativamente pelo servidor.
 * O cliente apenas renderiza — sem geração local de questões.
 *
 * Online-only para challenges (decisão DP de Phase 2.5).
 * Cache local apenas para: completions (calendário), activeChild, idioma, tema.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { CompleteChallengeResponse } from '@/types/database.types';
import type { ChallengeStartResponse } from '@/types';
import type { AnswerDraft } from '@/stores/challenge.store';
import type { ModuleId, TimerOption } from '@/constants/config';

const LOCAL_COMPLETIONS_KEY  = 'math-hero-local-completions-v1';

// ─── Local completion record ─────────────────────────────────────────────────
// Gravado no AsyncStorage sempre que um desafio é concluído localmente.
// Serve como fallback para o calendário quando a Edge Function não está deployada.

export interface LocalCompletion {
  childId:        string;
  challengeDate:  string;   // YYYY-MM-DD
  isPerfect:      boolean;
  completedAt:    string;   // ISO timestamp
  /** True when completed after the challenge date (late — counts XP only, no streak/perfect week) */
  isRetroactive?: boolean;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartChallengeParams {
  childId: string;
  challengeDate: string;  // YYYY-MM-DD
  moduleId: ModuleId;
  sessionId: string;      // client-generated UUID
  timerSeconds: TimerOption;
}

export interface CompletePayload {
  sessionId: string;
  answers: AnswerDraft[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const challengeService = {
  /**
   * Create or resume a challenge session (idempotent).
   * Calls the start_challenge Edge Function.
   */
  /**
   * Cria ou retoma uma sessão de challenge.
   * Phase 2.5+: retorna questions geradas adaptativamente pelo servidor.
   * Lança erro se offline — challenge é online-only (decisão Phase 2.5).
   */
  async startChallenge(params: StartChallengeParams): Promise<ChallengeStartResponse> {
    const { data, error } = await supabase.functions.invoke<ChallengeStartResponse>(
      'start_challenge',
      {
        body: {
          child_id: params.childId,
          challenge_date: params.challengeDate,
          module_id: params.moduleId,
          session_id: params.sessionId,
          timer_seconds: params.timerSeconds,
        },
      },
    );

    if (error) {
      // Parseia FunctionsHttpError.context para expor o código de erro real da EF
      // (ex: ALREADY_COMPLETED — cliente decide como apresentar).
      let code = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          const body = await ctx.clone().json() as { error?: string };
          if (body.error) code = body.error;
        }
      } catch { /* usar mensagem default */ }
      throw new Error(code);
    }
    if (!data) throw new Error('errors.generic');

    return data;
  },

  /**
   * Submete o challenge completo ao servidor.
   * Phase 2.5+: answers devem conter position + fact_id quando vêm do servidor.
   * Lança erro — o caller decide como apresentar o erro ao utilizador.
   */
  async completeChallenge(
    payload: CompletePayload,
  ): Promise<CompleteChallengeResponse> {
    // Mapear AnswerDraft para o formato esperado pela EF Phase 2.5
    const serverAnswers = payload.answers.map((a) => ({
      position: a.position ?? a.question_index + 1,
      fact_id: a.fact_id ?? `fact_${a.operand_a}x${a.operand_b}`,
      child_answer: a.child_answer,
      time_taken_ms: a.time_taken_ms ?? 0,
      block_number: a.block_number,
    }));

    const { data, error } = await supabase.functions.invoke<CompleteChallengeResponse>(
      'complete_challenge',
      {
        body: {
          session_id: payload.sessionId,
          answers: serverAnswers,
        },
      },
    );

    if (error) throw error;
    if (!data) throw new Error('errors.generic');

    return data;
  },

  // ─── Local completion fallback ───────────────────────────────────────────────

  /**
   * Persiste um completion local no AsyncStorage.
   * Chamado ao concluir o desafio, independentemente de a EF ter sucesso ou não.
   * Deduplica por (childId, challengeDate) — uma entrada por dia.
   */
  async storeLocalCompletion(
    childId:        string,
    challengeDate:  string,
    isPerfect:      boolean,
    isRetroactive?: boolean,
  ): Promise<void> {
    try {
      const raw      = await AsyncStorage.getItem(LOCAL_COMPLETIONS_KEY);
      const existing = raw ? (JSON.parse(raw) as LocalCompletion[]) : [];
      // Remove entrada anterior do mesmo dia/criança (pode ter mudado isPerfect)
      const filtered = existing.filter(
        (c) => !(c.childId === childId && c.challengeDate === challengeDate),
      );
      filtered.push({ childId, challengeDate, isPerfect, isRetroactive, completedAt: new Date().toISOString() });
      await AsyncStorage.setItem(LOCAL_COMPLETIONS_KEY, JSON.stringify(filtered));
    } catch {
      // Non-fatal — calendar fallback simplesmente não funcionará
    }
  },

  /** Returns whether a specific date has been completed (any completion, retroactive or not). */
  async isDateCompleted(childId: string, date: string): Promise<boolean> {
    const completions = await challengeService.getLocalCompletions(childId, date, date);
    if (completions.length > 0) return true;
    // Also check Supabase calendar_days
    try {
      const { data } = await supabase
        .from('calendar_days')
        .select('id')
        .eq('child_id', childId)
        .eq('challenge_date', date)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
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

};
