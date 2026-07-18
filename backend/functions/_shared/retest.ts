/**
 * Sistema de reteste persistente cross-challenge (child_fact_retest).
 *
 * Independente de child_fact_mastery/WEAK (adaptive-rules.ts, mastery.ts) — mastery mede
 * domínio de longo prazo, esta tabela garante correção de erros específicos: um erro marca
 * o fato para reteste obrigatório em desafios FUTUROS (start_challenge injecta com garantia),
 * até acumular `retestCorrectThreshold` acertos em sessões/dias distintos.
 */

import type { createClient } from 'npm:@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

// ─── Config global (app_config) ────────────────────────────────────────────────

export interface AppConfig {
  retestCorrectThreshold: number;
  retestPercentage: number;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  retestCorrectThreshold: 5,
  retestPercentage: 0.25,
};

export async function getAppConfig(supabase: SupabaseClient): Promise<AppConfig> {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['retest_correct_threshold', 'retest_percentage']);

  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const threshold = Number(map.get('retest_correct_threshold'));
  const percentage = Number(map.get('retest_percentage'));

  return {
    retestCorrectThreshold: Number.isFinite(threshold) && threshold > 0
      ? threshold : DEFAULT_APP_CONFIG.retestCorrectThreshold,
    retestPercentage: Number.isFinite(percentage) && percentage > 0 && percentage <= 1
      ? percentage : DEFAULT_APP_CONFIG.retestPercentage,
  };
}

// ─── Leitura para start_challenge ──────────────────────────────────────────────

export interface RetestFact {
  fact_id: string;
  first_flagged_at: string;
}

/** Fatos com a_retestar=true dentro do conjunto elegível (operações da sessão), mais antigos primeiro. */
export async function getActiveRetestFacts(
  supabase: SupabaseClient,
  childId: string,
  eligibleFactIds: Set<string>,
): Promise<RetestFact[]> {
  if (eligibleFactIds.size === 0) return [];
  const { data } = await supabase
    .from('child_fact_retest')
    .select('fact_id, first_flagged_at')
    .eq('child_id', childId)
    .eq('a_retestar', true)
    .in('fact_id', [...eligibleFactIds])
    .order('first_flagged_at', { ascending: true });
  return (data ?? []) as RetestFact[];
}

// ─── Escrita para complete_challenge ────────────────────────────────────────────

function toLocalDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

interface RetestRow {
  a_retestar: boolean;
  retest_correct_streak: number;
  retest_wrong_count: number;
  last_correct_local_date: string | null;
  first_flagged_at: string;
  cleared_at: string | null;
}

async function flagWrong(
  supabase: SupabaseClient,
  childId: string,
  factId: string,
  nowIso: string,
  countsAsDirectAttempt: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from('child_fact_retest')
    .select('retest_wrong_count, first_flagged_at')
    .eq('child_id', childId)
    .eq('fact_id', factId)
    .maybeSingle();

  await supabase.from('child_fact_retest').upsert({
    child_id: childId,
    fact_id: factId,
    a_retestar: true,
    retest_correct_streak: 0,
    retest_wrong_count: (existing?.retest_wrong_count ?? 0) + (countsAsDirectAttempt ? 1 : 0),
    first_flagged_at: existing?.first_flagged_at ?? nowIso,
    cleared_at: null,
    updated_at: nowIso,
  }, { onConflict: 'child_id,fact_id' });
}

async function flagCorrect(
  supabase: SupabaseClient,
  childId: string,
  factId: string,
  todayLocal: string,
  nowIso: string,
  threshold: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from('child_fact_retest')
    .select('*')
    .eq('child_id', childId)
    .eq('fact_id', factId)
    .maybeSingle();

  const row = existing as RetestRow | null;
  if (!row || !row.a_retestar) return; // não está em reteste, nada a fazer
  if (row.last_correct_local_date === todayLocal) return; // já contou uma sessão hoje

  const newStreak = row.retest_correct_streak + 1;
  const cleared = newStreak >= threshold;

  await supabase.from('child_fact_retest').update({
    retest_correct_streak: newStreak,
    last_correct_local_date: todayLocal,
    a_retestar: !cleared,
    cleared_at: cleared ? nowIso : row.cleared_at,
    updated_at: nowIso,
  }).eq('child_id', childId).eq('fact_id', factId);
}

export interface RetestAnswerOutcome {
  factId: string;
  wrong: boolean;    // pelo menos 1 ocorrência errada nesta sessão
  correct: boolean;  // todas as ocorrências corretas nesta sessão (mutuamente exclusivo com wrong)
}

/**
 * Aplica as regras de reteste após uma sessão completa — chamado por complete_challenge em
 * paralelo a updateMastery/applyCommutativity (sistema independente, mesma sessão de dados).
 *
 * Erro em qualquer fato → flag + reset de streak. Se o fato tiver par comutativo
 * (mult/adição — factGroupMap só tem entrada para essas operações), o par também é
 * flagged (sem incrementar retest_wrong_count — não foi literalmente perguntado, só
 * sinalizado, mesmo critério de applyCommutativity em mastery.ts).
 */
export async function applyRetestOutcomes(input: {
  supabase: SupabaseClient;
  childId: string;
  childTimezone: string;
  threshold: number;
  outcomes: RetestAnswerOutcome[];
  factGroupMap: Map<string, string | null>;
}): Promise<void> {
  const { supabase, childId, childTimezone, threshold, outcomes, factGroupMap } = input;
  const now = new Date();
  const nowIso = now.toISOString();
  const todayLocal = toLocalDate(now, childTimezone);

  for (const o of outcomes) {
    if (o.wrong) {
      await flagWrong(supabase, childId, o.factId, nowIso, true);

      const groupId = factGroupMap.get(o.factId);
      if (groupId) {
        const { data: siblings } = await supabase
          .from('arithmetic_facts')
          .select('id')
          .eq('fact_group_id', groupId)
          .neq('id', o.factId);
        for (const sib of (siblings ?? []) as Array<{ id: string }>) {
          await flagWrong(supabase, childId, sib.id, nowIso, false);
        }
      }
    } else if (o.correct) {
      await flagCorrect(supabase, childId, o.factId, todayLocal, nowIso, threshold);
    }
  }
}
