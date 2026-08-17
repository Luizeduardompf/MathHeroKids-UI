/**
 * Tabuada Semanal Premiada — service layer.
 *
 * Módulo independente do desafio diário adaptativo (challenge.service.ts): sem XP, sem
 * child_fact_mastery. As mutações de progresso (gerar o dia, submeter um bloco) passam
 * sempre pelas Edge Functions start_tabuada_day/submit_tabuada_block, que validam tudo
 * server-side (mesmo padrão de challengeService). As leituras de estado (estado da semana,
 * grelha dos 7 dias) são diretas ao Supabase — RLS já restringe ao pai dono da criança.
 */

import { supabase } from '@/lib/supabase';
import type {
  StartTabuadaDayResponse,
  SubmitTabuadaBlockResponse,
  WeeklyTabuadaDay,
  WeeklyTabuadaWeek,
} from '@/types/database.types';

export interface SubmitBlockAnswer {
  position: number;
  fact_id: string;
  child_answer: number | null;
}

async function extractErrorCode(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (!ctx) return fallback;
    const body = (await ctx.clone().json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export const tabuadaSemanalService = {
  /** Cria ou retoma o progresso de hoje (idempotente). Sempre "hoje" — sem retroactivo. */
  async startDay(childId: string): Promise<StartTabuadaDayResponse> {
    const { data, error } = await supabase.functions.invoke<StartTabuadaDayResponse>(
      'start_tabuada_day',
      { body: { child_id: childId } },
    );
    if (error) throw new Error(await extractErrorCode(error, error.message));
    if (!data) throw new Error('errors.generic');
    return data;
  },

  /** Submete as 20 respostas de um bloco. Servidor valida tudo contra o payload persistido. */
  async submitBlock(
    childId: string,
    blockNumber: number,
    answers: SubmitBlockAnswer[],
  ): Promise<SubmitTabuadaBlockResponse> {
    const { data, error } = await supabase.functions.invoke<SubmitTabuadaBlockResponse>(
      'submit_tabuada_block',
      { body: { child_id: childId, block_number: blockNumber, answers } },
    );
    if (error) throw new Error(await extractErrorCode(error, error.message));
    if (!data) throw new Error('errors.generic');
    return data;
  },

  /** Estado da semana (dias completos, medalha) para a semana que começa em `weekStartDate`. */
  async getWeekStatus(childId: string, weekStartDate: string): Promise<WeeklyTabuadaWeek | null> {
    const { data, error } = await supabase
      .from('weekly_tabuada_weeks')
      .select('*')
      .eq('child_id', childId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();
    if (error) throw new Error('errors.generic');
    return data as WeeklyTabuadaWeek | null;
  },

  /** Progresso diário (completed_at + blocks_state) de cada dia entre weekStartDate e +6. */
  async getWeekDays(childId: string, weekStartDate: string): Promise<WeeklyTabuadaDay[]> {
    const end = new Date(`${weekStartDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const weekEndExclusive = end.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('weekly_tabuada_days')
      .select('*')
      .eq('child_id', childId)
      .gte('day_date', weekStartDate)
      .lt('day_date', weekEndExclusive)
      .order('day_date', { ascending: true });
    if (error) throw new Error('errors.generic');
    return (data ?? []) as WeeklyTabuadaDay[];
  },
};
