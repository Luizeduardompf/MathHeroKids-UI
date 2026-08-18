/**
 * Reforço profundo — lógica pura (sem estado, sem I/O) do drill de 10 questões que reforça
 * um fato errado na Tabuada Semanal Premiada. Puramente pedagógico: não é lido/escrito em
 * lado nenhum do backend, não afeta child_fact_mastery/child_fact_retest.
 *
 * Dado o fato errado (operandos + resposta certa + operação), deriva a "família" de 4 fatos
 * relacionados — a mesma relação multiplicação↔divisão / adição↔subtração já usada para
 * gerar o catálogo `arithmetic_facts` (ver backend/migrations/013-015): um fato de
 * multiplicação a×b=c tem sempre por família {a×b=c, b×a=c, c÷a=b, c÷b=a}; adição/subtração
 * seguem a mesma relação. Isto vale para qualquer fato de entrada da família (multiplicação
 * ou divisão, adição ou subtração) — a família resultante é sempre a mesma.
 */

import type { ModuleId } from '@/constants/config';

export interface FactStep {
  operandA: number;
  operandB: number;
  answer: number;
  operation: ModuleId;
}

export type ReinforcementInputMode = 'digit' | 'choice';

export interface ReinforcementStep {
  fact: FactStep;
  inputMode: ReinforcementInputMode;
  /** Só presente quando inputMode === 'choice' — 4 opções já embaralhadas, resposta certa incluída. */
  choices?: number[];
}

const STEPS_TOTAL = 10;
const FACT_COUNTS = [3, 3, 2, 2]; // soma 10 — ~2-3x cada um dos 4 fatos da família
const DIGIT_STEPS = 5;
const CHOICE_STEPS = STEPS_TOTAL - DIGIT_STEPS;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function deriveFactFamily(
  operandA: number,
  operandB: number,
  answer: number,
  operation: ModuleId,
): FactStep[] {
  let a: number, b: number, c: number;
  if (operation === 'multiplication' || operation === 'addition') {
    a = operandA; b = operandB; c = answer;
  } else {
    // divisão: operandA=dividendo, operandB=divisor, answer=quociente
    // subtração: operandA=minuendo, operandB=subtraendo, answer=diferença
    // em ambos os casos, "desfazer" a operação dá a=operandB, b=answer, c=operandA
    a = operandB; b = answer; c = operandA;
  }

  if (operation === 'multiplication' || operation === 'division') {
    return [
      { operandA: a, operandB: b, answer: c, operation: 'multiplication' },
      { operandA: b, operandB: a, answer: c, operation: 'multiplication' },
      { operandA: c, operandB: a, answer: b, operation: 'division' },
      { operandA: c, operandB: b, answer: a, operation: 'division' },
    ];
  }
  return [
    { operandA: a, operandB: b, answer: c, operation: 'addition' },
    { operandA: b, operandB: a, answer: c, operation: 'addition' },
    { operandA: c, operandB: a, answer: b, operation: 'subtraction' },
    { operandA: c, operandB: b, answer: a, operation: 'subtraction' },
  ];
}

/** 4 opções embaralhadas (resposta certa incluída) — vizinhos ±1/±2 da resposta certa, nunca negativos. */
export function generateChoices(correctAnswer: number): number[] {
  const candidates = new Set<number>();
  const offsets = shuffle([-2, -1, 1, 2]);
  for (const off of offsets) {
    if (candidates.size >= 3) break;
    const val = correctAnswer + off;
    if (val >= 0 && val !== correctAnswer) candidates.add(val);
  }
  // Fallback (respostas certas muito baixas, ex: 1 ou 2, colidem com vizinhos negativos):
  // completa com deslocamentos maiores até ter 3 distratores.
  let extra = 3;
  while (candidates.size < 3) {
    const val = correctAnswer + extra;
    if (val >= 0 && val !== correctAnswer) candidates.add(val);
    extra++;
  }
  return shuffle([correctAnswer, ...candidates]);
}

/**
 * Monta o roteiro de 10 passos: distribui os 4 fatos da família (~2-3x cada, ordem
 * embaralhada) e atribui o modo de input (5 digitados + 5 múltipla escolha, embaralhado) —
 * cada chamada produz uma ordem diferente, de propósito (sem seed determinística).
 */
export function buildReinforcementScript(family: FactStep[]): ReinforcementStep[] {
  const counts = shuffle(FACT_COUNTS);
  const factSlots: FactStep[] = [];
  family.forEach((fact, i) => {
    for (let n = 0; n < (counts[i] ?? 0); n++) factSlots.push(fact);
  });
  const shuffledFacts = shuffle(factSlots);

  const modeBag = shuffle([
    ...Array.from({ length: DIGIT_STEPS }, () => 'digit' as const),
    ...Array.from({ length: CHOICE_STEPS }, () => 'choice' as const),
  ]);

  return shuffledFacts.map((fact, i) => {
    const inputMode = modeBag[i] ?? 'digit';
    return {
      fact,
      inputMode,
      ...(inputMode === 'choice' ? { choices: generateChoices(fact.answer) } : {}),
    };
  });
}
