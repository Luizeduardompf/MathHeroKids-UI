import { supabase } from '@/lib/supabase';
import type { ModuleId } from '@/constants/config';

export interface RetestFactEntry {
  factId: string;
  operation: ModuleId;
  operandA: number;
  operandB: number;
  answer: number;
  aRetestar: boolean;
  retestCorrectStreak: number;
  retestWrongCount: number;
  clearedAt: string | null;
}

interface RetestRow {
  fact_id: string;
  a_retestar: boolean;
  retest_correct_streak: number;
  retest_wrong_count: number;
  cleared_at: string | null;
  arithmetic_facts: { operation: ModuleId; operand_a: number; operand_b: number; answer: number } | null;
}

export const retestService = {
  /** Fatos que já foram errados por esta criança (tabela child_fact_retest), com os dados do fato via join. */
  async fetchChildRetestPerformance(childId: string): Promise<RetestFactEntry[]> {
    const { data, error } = await supabase
      .from('child_fact_retest')
      .select('fact_id, a_retestar, retest_correct_streak, retest_wrong_count, cleared_at, arithmetic_facts(operation, operand_a, operand_b, answer)')
      .eq('child_id', childId)
      .order('first_flagged_at', { ascending: true });

    if (error) throw new Error(error.message);

    return ((data ?? []) as unknown as RetestRow[])
      .filter((row) => row.arithmetic_facts != null)
      .map((row) => ({
        factId: row.fact_id,
        operation: row.arithmetic_facts!.operation,
        operandA: row.arithmetic_facts!.operand_a,
        operandB: row.arithmetic_facts!.operand_b,
        answer: row.arithmetic_facts!.answer,
        aRetestar: row.a_retestar,
        retestCorrectStreak: row.retest_correct_streak,
        retestWrongCount: row.retest_wrong_count,
        clearedAt: row.cleared_at,
      }));
  },
};
