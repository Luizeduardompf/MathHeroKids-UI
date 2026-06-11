# Phase 2.5 — Handoff de implementação (Sistema Adaptativo de Tabuadas)

> **Para o agente que vai implementar.** Este documento é autocontido. Não precisa reler o histórico do chat.
> Documento de design: `docs/adaptive-multiplication-system.md` (contexto e justificativa).
> Instruções gerais do projeto: `CLAUDE.md` (raiz).

---

## 0. TL;DR

Você vai implementar a Phase 2.5 do MathHeroKids: trocar o sistema de challenge de **seed determinístico client-side** para **seleção adaptativa server-side** com tracking de mastery por questão.

8 sprints, cada um com escopo fechado, SQL/código completo nesse doc, e critérios de aceitação claros. **App online-only** (sem fila offline para challenges). **JSON** como formato de config. **10×10 = 100 questões** no banco.

Stack inalterada: Expo + Supabase + TanStack Query + Zustand. Toda lógica adaptativa vive em duas Edge Functions: `start_challenge` (refactor) e `complete_challenge` (refactor).

---

## 1. Estado atual relevante do projeto

### O que já existe e vai ser modificado

| Arquivo | Estado atual | O que muda |
|---|---|---|
| `backend/migrations/001_initial_schema.sql` | Define `child_profiles`, `challenge_sessions`, `challenge_answers` no modelo seed | Criar migrations 006 e 007 que estendem (não modificam o 001) |
| `backend/functions/start_challenge/index.ts` | Recebe `question_seed` do cliente, cria/retoma sessão sem persistir questões | Refactor completo: ignorar seed, gerar questões adaptativamente, persistir em `questions_payload` |
| `backend/functions/complete_challenge/index.ts` | Valida respostas regenerando questões com seed | Refactor: validar contra `questions_payload` armazenado, atualizar `child_fact_mastery` |
| `app/(app)/challenge/[date].tsx` (se já existir) | Geração local com PRNG semeado | Consumir `questions_payload` do retorno de `start_challenge` |

### O que existe mas não muda

- Auth, profile-select, parent-area, trophies, achievements — intocados.
- Tabela `child_xp_ledger`, `calendar_days` — usadas por `complete_challenge`, mantidas.
- UNIQUE em `challenge_sessions (child_id, challenge_date, module_id)` — preservada (1 desafio por dia por módulo).

### Próximas migrations livres

Última migration é `005_child_last_seen.sql`. Próximas livres: **006, 007**.

---

## 2. Decisões fechadas (não revisitar)

| ID | Decisão |
|---|---|
| DP-1 | 7×8 e 8×7 são questões distintas, compartilham `fact_group_id`, com transferência de mastery configurável (default 50%) |
| DP-2 | Geração server-side via Edge Function; payload persistido em `challenge_sessions.questions_payload` |
| DP-3 | 100 questões (1×1 até 10×10) no MVP |
| DP-4 | Recovery de WEAK: 2 sessões distintas com ≥1 acerto cada |
| DP-5 | JSON (não XML) para configuração |
| DP-6 | Edição de config via PR no repo (MVP); UI admin fica para Phase 6+ |
| DP-7 | "Sessão distinta" = por dia calendário no timezone da criança |
| App offline | Online-only para challenges. Sem fila de sync para sessões. Cache local só para sessão, activeChild, idioma, tema |

---

## 3. Sprints e ordem de execução

Executar **em ordem**. Cada sprint deve commitar e fazer push (workflow do CLAUDE.md: handoff atualizado, commit imediato, push).

### Sprint 2.5.1 — Migration `006_multiplication_facts.sql`

**Objetivo:** catálogo estático das 100 questões com tier de dificuldade.

**Criar:** `backend/migrations/006_multiplication_facts.sql`

```sql
-- ──────────────────────────────────────────────────────────────
-- 006 — Multiplication Facts (Phase 2.5)
-- Catalogo estatico das 100 questoes (1x1..10x10)
-- ──────────────────────────────────────────────────────────────

create table public.multiplication_facts (
  id              text primary key,
  operand_a       smallint not null check (operand_a between 1 and 10),
  operand_b       smallint not null check (operand_b between 1 and 10),
  answer          smallint not null,
  fact_group_id   text not null,
  base_difficulty smallint not null check (base_difficulty between 1 and 5),
  created_at      timestamptz not null default now()
);

create index idx_facts_difficulty on public.multiplication_facts (base_difficulty);
create index idx_facts_group on public.multiplication_facts (fact_group_id);
create index idx_facts_operands on public.multiplication_facts (operand_a, operand_b);

-- RLS: leitura publica autenticada (catalogo estatico)
alter table public.multiplication_facts enable row level security;

create policy facts_read_authenticated on public.multiplication_facts
  for select to authenticated
  using (true);

-- Seed completo (100 rows)
insert into public.multiplication_facts (id, operand_a, operand_b, answer, fact_group_id, base_difficulty) values
  ('fact_1x1', 1, 1, 1, 'group_1x1', 1),
  ('fact_1x2', 1, 2, 2, 'group_1x2', 1),
  ('fact_1x3', 1, 3, 3, 'group_1x3', 1),
  ('fact_1x4', 1, 4, 4, 'group_1x4', 1),
  ('fact_1x5', 1, 5, 5, 'group_1x5', 1),
  ('fact_1x6', 1, 6, 6, 'group_1x6', 1),
  ('fact_1x7', 1, 7, 7, 'group_1x7', 1),
  ('fact_1x8', 1, 8, 8, 'group_1x8', 1),
  ('fact_1x9', 1, 9, 9, 'group_1x9', 1),
  ('fact_1x10', 1, 10, 10, 'group_1x10', 1),
  ('fact_2x1', 2, 1, 2, 'group_1x2', 1),
  ('fact_2x2', 2, 2, 4, 'group_2x2', 2),
  ('fact_2x3', 2, 3, 6, 'group_2x3', 2),
  ('fact_2x4', 2, 4, 8, 'group_2x4', 2),
  ('fact_2x5', 2, 5, 10, 'group_2x5', 2),
  ('fact_2x6', 2, 6, 12, 'group_2x6', 2),
  ('fact_2x7', 2, 7, 14, 'group_2x7', 2),
  ('fact_2x8', 2, 8, 16, 'group_2x8', 2),
  ('fact_2x9', 2, 9, 18, 'group_2x9', 2),
  ('fact_2x10', 2, 10, 20, 'group_2x10', 2),
  ('fact_3x1', 3, 1, 3, 'group_1x3', 1),
  ('fact_3x2', 3, 2, 6, 'group_2x3', 2),
  ('fact_3x3', 3, 3, 9, 'group_3x3', 2),
  ('fact_3x4', 3, 4, 12, 'group_3x4', 3),
  ('fact_3x5', 3, 5, 15, 'group_3x5', 2),
  ('fact_3x6', 3, 6, 18, 'group_3x6', 3),
  ('fact_3x7', 3, 7, 21, 'group_3x7', 3),
  ('fact_3x8', 3, 8, 24, 'group_3x8', 3),
  ('fact_3x9', 3, 9, 27, 'group_3x9', 3),
  ('fact_3x10', 3, 10, 30, 'group_3x10', 2),
  ('fact_4x1', 4, 1, 4, 'group_1x4', 1),
  ('fact_4x2', 4, 2, 8, 'group_2x4', 2),
  ('fact_4x3', 4, 3, 12, 'group_3x4', 3),
  ('fact_4x4', 4, 4, 16, 'group_4x4', 2),
  ('fact_4x5', 4, 5, 20, 'group_4x5', 2),
  ('fact_4x6', 4, 6, 24, 'group_4x6', 3),
  ('fact_4x7', 4, 7, 28, 'group_4x7', 4),
  ('fact_4x8', 4, 8, 32, 'group_4x8', 4),
  ('fact_4x9', 4, 9, 36, 'group_4x9', 3),
  ('fact_4x10', 4, 10, 40, 'group_4x10', 2),
  ('fact_5x1', 5, 1, 5, 'group_1x5', 1),
  ('fact_5x2', 5, 2, 10, 'group_2x5', 2),
  ('fact_5x3', 5, 3, 15, 'group_3x5', 2),
  ('fact_5x4', 5, 4, 20, 'group_4x5', 2),
  ('fact_5x5', 5, 5, 25, 'group_5x5', 2),
  ('fact_5x6', 5, 6, 30, 'group_5x6', 2),
  ('fact_5x7', 5, 7, 35, 'group_5x7', 2),
  ('fact_5x8', 5, 8, 40, 'group_5x8', 2),
  ('fact_5x9', 5, 9, 45, 'group_5x9', 2),
  ('fact_5x10', 5, 10, 50, 'group_5x10', 2),
  ('fact_6x1', 6, 1, 6, 'group_1x6', 1),
  ('fact_6x2', 6, 2, 12, 'group_2x6', 2),
  ('fact_6x3', 6, 3, 18, 'group_3x6', 3),
  ('fact_6x4', 6, 4, 24, 'group_4x6', 3),
  ('fact_6x5', 6, 5, 30, 'group_5x6', 2),
  ('fact_6x6', 6, 6, 36, 'group_6x6', 4),
  ('fact_6x7', 6, 7, 42, 'group_6x7', 5),
  ('fact_6x8', 6, 8, 48, 'group_6x8', 4),
  ('fact_6x9', 6, 9, 54, 'group_6x9', 5),
  ('fact_6x10', 6, 10, 60, 'group_6x10', 2),
  ('fact_7x1', 7, 1, 7, 'group_1x7', 1),
  ('fact_7x2', 7, 2, 14, 'group_2x7', 2),
  ('fact_7x3', 7, 3, 21, 'group_3x7', 3),
  ('fact_7x4', 7, 4, 28, 'group_4x7', 4),
  ('fact_7x5', 7, 5, 35, 'group_5x7', 2),
  ('fact_7x6', 7, 6, 42, 'group_6x7', 5),
  ('fact_7x7', 7, 7, 49, 'group_7x7', 5),
  ('fact_7x8', 7, 8, 56, 'group_7x8', 5),
  ('fact_7x9', 7, 9, 63, 'group_7x9', 4),
  ('fact_7x10', 7, 10, 70, 'group_7x10', 2),
  ('fact_8x1', 8, 1, 8, 'group_1x8', 1),
  ('fact_8x2', 8, 2, 16, 'group_2x8', 2),
  ('fact_8x3', 8, 3, 24, 'group_3x8', 3),
  ('fact_8x4', 8, 4, 32, 'group_4x8', 4),
  ('fact_8x5', 8, 5, 40, 'group_5x8', 2),
  ('fact_8x6', 8, 6, 48, 'group_6x8', 4),
  ('fact_8x7', 8, 7, 56, 'group_7x8', 5),
  ('fact_8x8', 8, 8, 64, 'group_8x8', 4),
  ('fact_8x9', 8, 9, 72, 'group_8x9', 5),
  ('fact_8x10', 8, 10, 80, 'group_8x10', 2),
  ('fact_9x1', 9, 1, 9, 'group_1x9', 1),
  ('fact_9x2', 9, 2, 18, 'group_2x9', 2),
  ('fact_9x3', 9, 3, 27, 'group_3x9', 3),
  ('fact_9x4', 9, 4, 36, 'group_4x9', 3),
  ('fact_9x5', 9, 5, 45, 'group_5x9', 2),
  ('fact_9x6', 9, 6, 54, 'group_6x9', 5),
  ('fact_9x7', 9, 7, 63, 'group_7x9', 4),
  ('fact_9x8', 9, 8, 72, 'group_8x9', 5),
  ('fact_9x9', 9, 9, 81, 'group_9x9', 4),
  ('fact_9x10', 9, 10, 90, 'group_9x10', 2),
  ('fact_10x1', 10, 1, 10, 'group_1x10', 1),
  ('fact_10x2', 10, 2, 20, 'group_2x10', 2),
  ('fact_10x3', 10, 3, 30, 'group_3x10', 2),
  ('fact_10x4', 10, 4, 40, 'group_4x10', 2),
  ('fact_10x5', 10, 5, 50, 'group_5x10', 2),
  ('fact_10x6', 10, 6, 60, 'group_6x10', 2),
  ('fact_10x7', 10, 7, 70, 'group_7x10', 2),
  ('fact_10x8', 10, 8, 80, 'group_8x10', 2),
  ('fact_10x9', 10, 9, 90, 'group_9x10', 2),
  ('fact_10x10', 10, 10, 100, 'group_10x10', 2);

-- Validacao pos-seed (deve retornar 100)
-- select count(*) from public.multiplication_facts;
-- Distribuicao esperada: T1=19, T2=47, T3=14, T4=11, T5=9
```

**Distribuição final por tier:**
- T1 (Trivial): 19
- T2 (Fácil): 47
- T3 (Médio): 14
- T4 (Difícil): 11
- T5 (Muito difícil): 9

**Critério de aceitação:**
- `SELECT COUNT(*) FROM multiplication_facts` retorna 100.
- `SELECT base_difficulty, COUNT(*) FROM multiplication_facts GROUP BY 1 ORDER BY 1` retorna a distribuição acima.
- `SELECT COUNT(DISTINCT fact_group_id)` retorna 55 (100 questões - 45 grupos comutativos).
- `select * from multiplication_facts where id = 'fact_7x8'` retorna `base_difficulty=5, fact_group_id='group_7x8'`.

---

### Sprint 2.5.2 — Migration `007_child_fact_mastery.sql`

**Objetivo:** mastery por criança + colunas em `challenge_sessions` e `challenge_answers` + timezone em `child_profiles`.

**Criar:** `backend/migrations/007_child_fact_mastery.sql`

```sql
-- ──────────────────────────────────────────────────────────────
-- 007 — Child Fact Mastery + Adaptive Engine columns
-- ──────────────────────────────────────────────────────────────

-- Timezone por crianca (necessario para DP-7: sessao distinta por dia calendario)
alter table public.child_profiles
  add column timezone text not null default 'America/Sao_Paulo';

-- Mastery por crianca x questao
create table public.child_fact_mastery (
  child_id                  uuid not null references public.child_profiles(id) on delete cascade,
  fact_id                   text not null references public.multiplication_facts(id),
  state                     text not null default 'NEW'
                              check (state in ('NEW','LEARNING','REVIEWING','MASTERED','WEAK')),
  times_seen                integer not null default 0 check (times_seen >= 0),
  times_correct             integer not null default 0 check (times_correct >= 0),
  times_wrong               integer not null default 0 check (times_wrong >= 0),
  distinct_sessions_correct integer not null default 0 check (distinct_sessions_correct >= 0),
  consecutive_correct       integer not null default 0,
  consecutive_wrong         integer not null default 0,
  last_seen_at              timestamptz,
  last_correct_at           timestamptz,
  last_wrong_at             timestamptz,
  last_correct_local_date   date,  -- date no timezone da crianca (para DP-7)
  strength                  real not null default 0 check (strength between 0 and 1),
  next_review_at            timestamptz,
  updated_at                timestamptz not null default now(),
  primary key (child_id, fact_id)
);

create index idx_mastery_state on public.child_fact_mastery (child_id, state);
create index idx_mastery_next_review on public.child_fact_mastery (child_id, next_review_at)
  where next_review_at is not null;

-- RLS
alter table public.child_fact_mastery enable row level security;

create policy mastery_read_own on public.child_fact_mastery
  for select to authenticated
  using (
    child_id in (
      select id from public.child_profiles
       where parent_id = (select id from public.parent_profiles where user_id = auth.uid())
    )
  );

-- Apenas service_role escreve (via Edge Functions)
create policy mastery_write_service on public.child_fact_mastery
  for all to service_role
  using (true) with check (true);

-- Extensao de challenge_sessions: payload persistido + versao das regras
alter table public.challenge_sessions
  add column questions_payload  jsonb,
  add column rules_version      integer,
  add column selection_metadata jsonb;

-- question_seed agora e legacy. Manter coluna por compatibilidade,
-- mas tornar nullable (novas sessoes nao usam).
alter table public.challenge_sessions
  alter column question_seed drop not null;

comment on column public.challenge_sessions.question_seed is
  'DEPRECATED (Phase 2.5). Sessoes geradas server-side a partir de questions_payload.';

-- Extensao de challenge_answers: fact_id + response time
alter table public.challenge_answers
  add column fact_id          text references public.multiplication_facts(id),
  add column response_time_ms integer;

create index idx_answers_child_fact on public.challenge_answers (fact_id, id)
  where fact_id is not null;
```

**Critério de aceitação:**
- Migration aplica sem erro.
- `\d child_fact_mastery` mostra a estrutura esperada.
- RLS testada: criança 1 não consegue ler mastery da criança 2 (com sessões auth de parents diferentes).
- `challenge_sessions.question_seed` aceita NULL.
- `challenge_answers.fact_id` referencia `multiplication_facts(id)`.

---

### Sprint 2.5.3 — Config JSON + Schema + Loader

**Objetivo:** arquivo de regras adaptativas + validação por JSON Schema + módulo `_shared/` para Edge Functions.

**Criar:** `backend/config/adaptive-rules.json`

```json
{
  "version": 1,
  "lastUpdated": "2026-06-11",
  "mastery": {
    "_description": "Thresholds de transicao entre estados (pontos A, B, C)",
    "learning": {
      "distinctSessionsRequired": 5
    },
    "mastered": {
      "totalCorrectRequired": 8,
      "distinctSessionsRequired": 4
    },
    "weak": {
      "consecutiveWrongTrigger": 1,
      "recoveryDistinctSessions": 2,
      "recoveryCorrectPerSession": 1
    }
  },
  "selectionMix": {
    "weights": {
      "WEAK": 0.30,
      "LEARNING": 0.35,
      "NEW": 0.15,
      "REVIEWING": 0.15,
      "MASTERED": 0.05
    },
    "fallbackOrder": ["WEAK", "LEARNING", "REVIEWING", "NEW", "MASTERED"]
  },
  "antiRepeat": {
    "intraSessionUnique": true,
    "crossSessionCooldown": 2,
    "introduceByDifficulty": true
  },
  "progression": {
    "tiers": [
      { "base": 1, "unlockAt": "start" },
      { "base": 2, "unlockAt": "start" },
      { "base": 3, "unlockWhen": "tierLearned", "minTier": 2, "minMasteryPct": 0.6 },
      { "base": 4, "unlockWhen": "tierLearned", "minTier": 3, "minMasteryPct": 0.5 },
      { "base": 5, "unlockWhen": "tierLearned", "minTier": 4, "minMasteryPct": 0.4 }
    ]
  },
  "strength": {
    "halfLifeDays": 3,
    "wrongDecay": 0.5,
    "weights": {
      "recency": 0.4,
      "accuracy": 0.4,
      "sessions": 0.2
    },
    "targetSessions": 4
  },
  "commutativity": {
    "enabled": true,
    "transferFactor": 0.5
  },
  "sessionDistinctness": {
    "mode": "byCalendarDay"
  },
  "session": {
    "questionsPerChallenge": 20,
    "blockSize": 5,
    "maxWeakPerSession": 8
  }
}
```

**Criar:** `backend/config/adaptive-rules.schema.json` (JSON Schema 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mathheroskids.com/schemas/adaptive-rules.json",
  "type": "object",
  "required": ["version","mastery","selectionMix","antiRepeat","progression","strength","commutativity","sessionDistinctness","session"],
  "properties": {
    "version": { "type": "integer", "minimum": 1 },
    "lastUpdated": { "type": "string", "format": "date" },
    "mastery": {
      "type": "object",
      "required": ["learning","mastered","weak"],
      "properties": {
        "learning": {
          "type": "object",
          "required": ["distinctSessionsRequired"],
          "properties": {
            "distinctSessionsRequired": { "type": "integer", "minimum": 1 }
          }
        },
        "mastered": {
          "type": "object",
          "required": ["totalCorrectRequired","distinctSessionsRequired"],
          "properties": {
            "totalCorrectRequired": { "type": "integer", "minimum": 1 },
            "distinctSessionsRequired": { "type": "integer", "minimum": 1 }
          }
        },
        "weak": {
          "type": "object",
          "required": ["consecutiveWrongTrigger","recoveryDistinctSessions","recoveryCorrectPerSession"],
          "properties": {
            "consecutiveWrongTrigger": { "type": "integer", "minimum": 1 },
            "recoveryDistinctSessions": { "type": "integer", "minimum": 1 },
            "recoveryCorrectPerSession": { "type": "integer", "minimum": 1 }
          }
        }
      }
    },
    "selectionMix": {
      "type": "object",
      "required": ["weights","fallbackOrder"],
      "properties": {
        "weights": {
          "type": "object",
          "required": ["WEAK","LEARNING","NEW","REVIEWING","MASTERED"],
          "additionalProperties": false,
          "properties": {
            "WEAK":      { "type": "number", "minimum": 0, "maximum": 1 },
            "LEARNING":  { "type": "number", "minimum": 0, "maximum": 1 },
            "NEW":       { "type": "number", "minimum": 0, "maximum": 1 },
            "REVIEWING": { "type": "number", "minimum": 0, "maximum": 1 },
            "MASTERED":  { "type": "number", "minimum": 0, "maximum": 1 }
          }
        },
        "fallbackOrder": {
          "type": "array",
          "items": { "enum": ["WEAK","LEARNING","NEW","REVIEWING","MASTERED"] },
          "minItems": 5,
          "maxItems": 5
        }
      }
    },
    "antiRepeat": {
      "type": "object",
      "required": ["intraSessionUnique","crossSessionCooldown","introduceByDifficulty"],
      "properties": {
        "intraSessionUnique": { "type": "boolean" },
        "crossSessionCooldown": { "type": "integer", "minimum": 0 },
        "introduceByDifficulty": { "type": "boolean" }
      }
    },
    "progression": {
      "type": "object",
      "required": ["tiers"],
      "properties": {
        "tiers": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["base"],
            "properties": {
              "base": { "type": "integer", "minimum": 1, "maximum": 5 },
              "unlockAt": { "enum": ["start"] },
              "unlockWhen": { "enum": ["tierLearned"] },
              "minTier": { "type": "integer", "minimum": 1, "maximum": 5 },
              "minMasteryPct": { "type": "number", "minimum": 0, "maximum": 1 }
            }
          }
        }
      }
    },
    "strength": {
      "type": "object",
      "required": ["halfLifeDays","wrongDecay","weights","targetSessions"],
      "properties": {
        "halfLifeDays": { "type": "number", "exclusiveMinimum": 0 },
        "wrongDecay": { "type": "number", "minimum": 0 },
        "weights": {
          "type": "object",
          "required": ["recency","accuracy","sessions"],
          "properties": {
            "recency":  { "type": "number", "minimum": 0, "maximum": 1 },
            "accuracy": { "type": "number", "minimum": 0, "maximum": 1 },
            "sessions": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        },
        "targetSessions": { "type": "integer", "minimum": 1 }
      }
    },
    "commutativity": {
      "type": "object",
      "required": ["enabled","transferFactor"],
      "properties": {
        "enabled": { "type": "boolean" },
        "transferFactor": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "sessionDistinctness": {
      "type": "object",
      "required": ["mode"],
      "properties": {
        "mode": { "enum": ["byCalendarDay","bySessionId"] }
      }
    },
    "session": {
      "type": "object",
      "required": ["questionsPerChallenge","blockSize","maxWeakPerSession"],
      "properties": {
        "questionsPerChallenge": { "type": "integer", "minimum": 1 },
        "blockSize": { "type": "integer", "minimum": 1 },
        "maxWeakPerSession": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

**Criar:** `backend/functions/_shared/adaptive-rules.ts`

```ts
// Loader + tipos para adaptive-rules.json.
// Importado por start_challenge e complete_challenge.

import rulesJson from '../../config/adaptive-rules.json' with { type: 'json' };

export type MasteryState = 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED' | 'WEAK';

export interface AdaptiveRules {
  version: number;
  lastUpdated?: string;
  mastery: {
    learning: { distinctSessionsRequired: number };
    mastered: { totalCorrectRequired: number; distinctSessionsRequired: number };
    weak: {
      consecutiveWrongTrigger: number;
      recoveryDistinctSessions: number;
      recoveryCorrectPerSession: number;
    };
  };
  selectionMix: {
    weights: Record<MasteryState, number>;
    fallbackOrder: MasteryState[];
  };
  antiRepeat: {
    intraSessionUnique: boolean;
    crossSessionCooldown: number;
    introduceByDifficulty: boolean;
  };
  progression: {
    tiers: Array<{
      base: number;
      unlockAt?: 'start';
      unlockWhen?: 'tierLearned';
      minTier?: number;
      minMasteryPct?: number;
    }>;
  };
  strength: {
    halfLifeDays: number;
    wrongDecay: number;
    weights: { recency: number; accuracy: number; sessions: number };
    targetSessions: number;
  };
  commutativity: { enabled: boolean; transferFactor: number };
  sessionDistinctness: { mode: 'byCalendarDay' | 'bySessionId' };
  session: {
    questionsPerChallenge: number;
    blockSize: number;
    maxWeakPerSession: number;
  };
}

const rules = rulesJson as AdaptiveRules;

// Validacao basica no boot — JSON Schema cobre o resto via CI.
// Aqui apenas invariantes criticos.
function validateRules(r: AdaptiveRules): void {
  const weightSum = Object.values(r.selectionMix.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.001) {
    throw new Error(`selectionMix.weights soma ${weightSum}, esperado 1.0`);
  }
  const strSum = r.strength.weights.recency + r.strength.weights.accuracy + r.strength.weights.sessions;
  if (Math.abs(strSum - 1) > 0.001) {
    throw new Error(`strength.weights soma ${strSum}, esperado 1.0`);
  }
}

validateRules(rules);

export function getRules(): AdaptiveRules {
  return rules;
}

export function getRulesVersion(): number {
  return rules.version;
}
```

**Critério de aceitação:**
- `adaptive-rules.json` valida contra `adaptive-rules.schema.json` (validar via `ajv` em CI ou manualmente).
- `getRules()` retorna config sem throw quando JSON é válido.
- Modificar `selectionMix.weights.WEAK` para 0.5 (somando >1) faz boot da EF falhar com erro claro.
- Soma `strength.weights` validada.

---

### Sprint 2.5.4 — Refactor `start_challenge`

**Objetivo:** geração adaptativa server-side, persistir payload, retornar para cliente.

**Modificar:** `backend/functions/start_challenge/index.ts`

Estrutura nova (substituir `index.ts` atual):

```ts
/**
 * start_challenge — Edge Function (Phase 2.5 — adaptive engine)
 *
 * Cria ou retoma uma challenge_session. Diferenca para v1:
 * - Ignora question_seed (legacy).
 * - Gera 20 questoes adaptativamente a partir de child_fact_mastery + adaptive-rules.json.
 * - Persiste payload em challenge_sessions.questions_payload.
 *
 * Request body:
 * {
 *   child_id: string;
 *   challenge_date: string;   // YYYY-MM-DD
 *   module_id?: string;       // default 'multiplication'
 *   session_id: string;       // client UUID (idempotencia)
 *   timer_seconds: number;
 * }
 *
 * Response:
 * {
 *   sessionId: string;
 *   status: 'new' | 'resumed';
 *   questions: Array<{
 *     position: number;
 *     fact_id: string;
 *     operand_a: number;
 *     operand_b: number;
 *     bucket: MasteryState;
 *   }>;
 *   rulesVersion: number;
 * }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getRules, getRulesVersion } from '../_shared/adaptive-rules.ts';
import { selectQuestions } from '../_shared/question-selector.ts';

const RETROACTIVE_WINDOW_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { child_id, challenge_date, session_id, timer_seconds } = body;
    const module_id = body.module_id ?? 'multiplication';

    // Validacao de data (mantida do v1)
    const today = new Date().toISOString().split('T')[0]!;
    const diffDays = Math.floor(
      (new Date(today).getTime() - new Date(challenge_date).getTime()) / 86400000,
    );
    if (diffDays < 0) {
      return jsonError(400, 'FUTURE_DATE', 'Cannot start a challenge for a future date.');
    }
    if (diffDays > RETROACTIVE_WINDOW_DAYS) {
      return jsonError(429, 'RETROACTIVE_WINDOW_EXPIRED', 'Outside 7-day retroactive window.');
    }

    // Idempotencia: se sessao existente, retomar
    const { data: existing } = await supabase
      .from('challenge_sessions')
      .select('id, status, questions_payload, rules_version')
      .eq('id', session_id)
      .maybeSingle();

    if (existing && existing.questions_payload) {
      return jsonOk({
        sessionId: existing.id,
        status: 'resumed',
        questions: existing.questions_payload,
        rulesVersion: existing.rules_version,
      });
    }

    // Carregar mastery atual da crianca
    const { data: mastery } = await supabase
      .from('child_fact_mastery')
      .select('*')
      .eq('child_id', child_id);

    // Carregar facts catalogo
    const { data: facts } = await supabase
      .from('multiplication_facts')
      .select('*');

    if (!facts || facts.length === 0) {
      return jsonError(500, 'FACTS_NOT_SEEDED', 'multiplication_facts table is empty.');
    }

    // Cooldown: facts usados nos ultimos N sessoes
    const rules = getRules();
    const { data: recentSessions } = await supabase
      .from('challenge_sessions')
      .select('questions_payload')
      .eq('child_id', child_id)
      .neq('id', session_id)
      .order('started_at', { ascending: false })
      .limit(rules.antiRepeat.crossSessionCooldown);

    const excludedFactIds = new Set<string>();
    (recentSessions ?? []).forEach(s => {
      (s.questions_payload ?? []).forEach((q: any) => excludedFactIds.add(q.fact_id));
    });

    // Selecionar 20 questoes
    const { questions, metadata } = selectQuestions({
      facts,
      mastery: mastery ?? [],
      excludedFactIds,
      rules,
    });

    // Upsert da sessao com payload persistido
    const { error: upsertErr } = await supabase
      .from('challenge_sessions')
      .upsert({
        id: session_id,
        child_id,
        challenge_date,
        module_id,
        questions_payload: questions,
        rules_version: getRulesVersion(),
        selection_metadata: metadata,
        timer_seconds,
        multiplication_max: 10,
        status: 'in_progress',
        total_questions: rules.session.questionsPerChallenge,
        is_retroactive: diffDays > 0,
        question_seed: null, // legacy
      }, { onConflict: 'id' });

    if (upsertErr) {
      console.error('upsert error', upsertErr);
      return jsonError(500, 'SESSION_UPSERT_FAILED', upsertErr.message);
    }

    return jsonOk({
      sessionId: session_id,
      status: 'new',
      questions,
      rulesVersion: getRulesVersion(),
    });

  } catch (err: any) {
    console.error('start_challenge error', err);
    return jsonError(500, 'INTERNAL_ERROR', err.message ?? 'Unknown error');
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Criar:** `backend/functions/_shared/question-selector.ts`

Algoritmo completo:

```ts
import type { AdaptiveRules, MasteryState } from './adaptive-rules.ts';

interface Fact {
  id: string;
  operand_a: number;
  operand_b: number;
  answer: number;
  fact_group_id: string;
  base_difficulty: number;
}

interface MasteryRow {
  fact_id: string;
  state: MasteryState;
  strength: number;
  last_seen_at: string | null;
}

interface SelectInput {
  facts: Fact[];
  mastery: MasteryRow[];
  excludedFactIds: Set<string>;
  rules: AdaptiveRules;
}

interface SelectedQuestion {
  position: number;
  fact_id: string;
  operand_a: number;
  operand_b: number;
  bucket: MasteryState;
}

interface SelectionMetadata {
  bucketCounts: Record<MasteryState, number>;
  unlockedTiers: number[];
  effectiveWeights: Record<MasteryState, number>;
}

export function selectQuestions(input: SelectInput): {
  questions: SelectedQuestion[];
  metadata: SelectionMetadata;
} {
  const { facts, mastery, excludedFactIds, rules } = input;
  const N = rules.session.questionsPerChallenge;

  // Map fact_id -> mastery (default NEW)
  const masteryMap = new Map<string, MasteryRow>();
  mastery.forEach(m => masteryMap.set(m.fact_id, m));

  // Determinar tiers desbloqueados (progressao)
  const unlockedTiers = computeUnlockedTiers(facts, masteryMap, rules);

  // Particionar em buckets
  const buckets: Record<MasteryState, Fact[]> = {
    WEAK: [], LEARNING: [], REVIEWING: [], MASTERED: [], NEW: []
  };

  facts.forEach(f => {
    if (excludedFactIds.has(f.id)) return;
    if (!unlockedTiers.includes(f.base_difficulty)) return;
    const m = masteryMap.get(f.id);
    const state = (m?.state ?? 'NEW') as MasteryState;
    buckets[state].push(f);
  });

  // Ordenar cada bucket
  // - WEAK/LEARNING: prioridade para menor strength
  // - NEW: ordem de dificuldade base ascendente
  // - REVIEWING/MASTERED: maior tempo desde last_seen primeiro
  buckets.WEAK.sort((a, b) => strengthOf(a, masteryMap) - strengthOf(b, masteryMap));
  buckets.LEARNING.sort((a, b) => strengthOf(a, masteryMap) - strengthOf(b, masteryMap));
  buckets.NEW.sort((a, b) => a.base_difficulty - b.base_difficulty || hash(a.id) - hash(b.id));
  buckets.REVIEWING.sort((a, b) => ageOf(a, masteryMap) - ageOf(b, masteryMap));
  buckets.MASTERED.sort((a, b) => ageOf(a, masteryMap) - ageOf(b, masteryMap));

  // Calcular cotas por bucket
  const w = rules.selectionMix.weights;
  const quotas: Record<MasteryState, number> = {
    WEAK: Math.min(rules.session.maxWeakPerSession, Math.round(N * w.WEAK)),
    LEARNING: Math.round(N * w.LEARNING),
    REVIEWING: Math.round(N * w.REVIEWING),
    NEW: Math.round(N * w.NEW),
    MASTERED: Math.round(N * w.MASTERED),
  };

  // Coletar respeitando cotas + fallback
  const selected: Fact[] = [];
  const selectedIds = new Set<string>();
  const order = rules.selectionMix.fallbackOrder;
  const bucketCounts: Record<MasteryState, number> = {
    WEAK: 0, LEARNING: 0, REVIEWING: 0, NEW: 0, MASTERED: 0,
  };

  for (const state of order) {
    let take = Math.min(quotas[state], buckets[state].length);
    while (take > 0 && selected.length < N) {
      const f = buckets[state].shift()!;
      if (selectedIds.has(f.id)) continue;
      // Anti-repeat por fact_group_id dentro da mesma sessao (opcional, configuravel via rules)
      // Aqui: permitimos 7x8 e 8x7 na mesma sessao (sao distintos).
      selected.push(f);
      selectedIds.add(f.id);
      bucketCounts[state]++;
      take--;
    }
  }

  // Fallback: completar com qualquer bucket disponivel
  if (selected.length < N) {
    for (const state of order) {
      while (selected.length < N && buckets[state].length > 0) {
        const f = buckets[state].shift()!;
        if (selectedIds.has(f.id)) continue;
        selected.push(f);
        selectedIds.add(f.id);
        bucketCounts[state]++;
      }
    }
  }

  // Embaralhar para nao agrupar dificuldades, mas manter um peso de variedade
  const shuffled = interleaveByDifficulty(selected);

  const questions: SelectedQuestion[] = shuffled.map((f, idx) => ({
    position: idx + 1,
    fact_id: f.id,
    operand_a: f.operand_a,
    operand_b: f.operand_b,
    bucket: stateOf(f, masteryMap),
  }));

  return {
    questions,
    metadata: {
      bucketCounts,
      unlockedTiers,
      effectiveWeights: w,
    },
  };
}

function strengthOf(f: Fact, m: Map<string, MasteryRow>): number {
  return m.get(f.id)?.strength ?? 0;
}

function ageOf(f: Fact, m: Map<string, MasteryRow>): number {
  const last = m.get(f.id)?.last_seen_at;
  if (!last) return Number.MAX_SAFE_INTEGER;
  return Date.now() - new Date(last).getTime();
}

function stateOf(f: Fact, m: Map<string, MasteryRow>): MasteryState {
  return (m.get(f.id)?.state ?? 'NEW') as MasteryState;
}

function hash(s: string): number {
  // simples para tie-break deterministico
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function computeUnlockedTiers(
  facts: Fact[],
  m: Map<string, MasteryRow>,
  rules: AdaptiveRules,
): number[] {
  const unlocked = new Set<number>();
  for (const tier of rules.progression.tiers) {
    if (tier.unlockAt === 'start') {
      unlocked.add(tier.base);
      continue;
    }
    if (tier.unlockWhen === 'tierLearned' && tier.minTier && tier.minMasteryPct) {
      const prevFacts = facts.filter(f => f.base_difficulty === tier.minTier);
      if (prevFacts.length === 0) continue;
      const learned = prevFacts.filter(f => {
        const st = m.get(f.id)?.state;
        return st && st !== 'NEW' && st !== 'WEAK';
      }).length;
      if (learned / prevFacts.length >= tier.minMasteryPct) {
        unlocked.add(tier.base);
      }
    }
  }
  // Sempre incluir T1 e T2 como fallback minimo
  unlocked.add(1);
  unlocked.add(2);
  return [...unlocked].sort();
}

function interleaveByDifficulty(facts: Fact[]): Fact[] {
  // Agrupa por tier, depois intercala round-robin para nao agrupar dificuldades
  const groups = new Map<number, Fact[]>();
  facts.forEach(f => {
    if (!groups.has(f.base_difficulty)) groups.set(f.base_difficulty, []);
    groups.get(f.base_difficulty)!.push(f);
  });
  const tiers = [...groups.keys()].sort();
  const out: Fact[] = [];
  let i = 0;
  while (out.length < facts.length) {
    const tier = tiers[i % tiers.length]!;
    const arr = groups.get(tier);
    if (arr && arr.length > 0) out.push(arr.shift()!);
    i++;
    if (i > facts.length * tiers.length) break; // safety
  }
  return out;
}
```

**Critério de aceitação:**
- Rodar `start_challenge` 100 vezes com mesma criança (recriando sessões): nenhuma sessão contém questão repetida.
- Mix observado bate com pesos do JSON ±10% após 100 sessões.
- Criança nova só recebe questões T1/T2 na primeira sessão.
- `selection_metadata` populado com `bucketCounts` corretos.
- `questions_payload` é array de 20 objetos com `position`, `fact_id`, `operand_a`, `operand_b`, `bucket`.

---

### Sprint 2.5.5 — Refactor `complete_challenge`

**Objetivo:** validar respostas contra payload armazenado, atualizar mastery, computar strength, aplicar transições de estado.

**Modificar:** `backend/functions/complete_challenge/index.ts`

Estrutura (resumida — mantém XP/streak/trophies do código atual, adiciona mastery update):

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getRules } from '../_shared/adaptive-rules.ts';
import { updateMastery } from '../_shared/mastery.ts';

interface AnswerInput {
  position: number;            // 1..20
  fact_id: string;
  child_answer: number | null; // null = timeout
  time_taken_ms: number;
  block_number: number;        // 1..4
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { session_id, answers }: { session_id: string; answers: AnswerInput[] } = await req.json();

    // 1. Buscar sessao + payload + child
    const { data: session, error: sErr } = await supabase
      .from('challenge_sessions')
      .select('*, child_profiles!inner(id, timezone)')
      .eq('id', session_id)
      .single();
    if (sErr || !session) return jsonError(404, 'SESSION_NOT_FOUND', 'Session not found');
    if (session.status === 'completed') {
      return jsonError(409, 'ALREADY_COMPLETED', 'Session already completed');
    }

    const payload = session.questions_payload as Array<{
      position: number; fact_id: string; operand_a: number; operand_b: number;
    }>;

    // 2. Buscar facts referenciados (para correct_answer)
    const factIds = payload.map(p => p.fact_id);
    const { data: facts } = await supabase
      .from('multiplication_facts')
      .select('id, answer')
      .in('id', factIds);
    const answerMap = new Map(facts!.map(f => [f.id, f.answer]));

    // 3. Validar e construir rows de challenge_answers
    const rules = getRules();
    const answerRows = answers.map(a => {
      const q = payload.find(p => p.position === a.position);
      if (!q || q.fact_id !== a.fact_id) {
        throw new Error(`Answer mismatch at position ${a.position}`);
      }
      const correct = answerMap.get(a.fact_id);
      const isCorrect = a.child_answer === correct;
      return {
        session_id,
        block_number: a.block_number,
        attempt_number: 1,
        question_index: a.position - 1,
        operand_a: payload.find(p => p.position === a.position)!.operand_a,
        operand_b: payload.find(p => p.position === a.position)!.operand_b,
        correct_answer: correct,
        child_answer: a.child_answer,
        is_correct: isCorrect,
        time_taken_ms: a.time_taken_ms,
        response_time_ms: a.time_taken_ms,
        fact_id: a.fact_id,
        xp_awarded: isCorrect ? 5 : 0, // ajustar conforme regras de XP
      };
    });

    // 4. Inserir answers
    const { error: insErr } = await supabase.from('challenge_answers').insert(answerRows);
    if (insErr) return jsonError(500, 'INSERT_ANSWERS_FAILED', insErr.message);

    // 5. Atualizar mastery por fact
    const childTz = session.child_profiles.timezone;
    for (const row of answerRows) {
      await updateMastery({
        supabase,
        childId: session.child_id,
        factId: row.fact_id,
        sessionId: session_id,
        isCorrect: row.is_correct,
        childTimezone: childTz,
        rules,
      });
    }

    // 6. Aplicar transferencia de comutatividade
    if (rules.commutativity.enabled) {
      // Para cada fact respondido, achar o irmao no mesmo group e dar credito parcial
      // Implementacao em mastery.ts
    }

    // 7. Marcar sessao completa, atualizar XP/streak/calendar_days/etc (manter logica do v1)
    const correctCount = answerRows.filter(r => r.is_correct).length;
    const xpAwarded = answerRows.reduce((s, r) => s + r.xp_awarded, 0);
    const isPerfect = correctCount === answerRows.length;

    await supabase
      .from('challenge_sessions')
      .update({
        status: 'completed',
        correct_count: correctCount,
        xp_awarded: xpAwarded,
        is_perfect: isPerfect,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    // (Manter lógica de child_xp_ledger, child_profiles.xp_total/level/streak,
    //  calendar_days, achievements, trophies — do código atual)
    // ...

    return jsonOk({
      sessionId: session_id,
      correctCount,
      xpAwarded,
      isPerfect,
    });

  } catch (err: any) {
    console.error('complete_challenge error', err);
    return jsonError(500, 'INTERNAL_ERROR', err.message);
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Criar:** `backend/functions/_shared/mastery.ts`

```ts
import type { AdaptiveRules, MasteryState } from './adaptive-rules.ts';

interface UpdateInput {
  supabase: any;
  childId: string;
  factId: string;
  sessionId: string;
  isCorrect: boolean;
  childTimezone: string;
  rules: AdaptiveRules;
}

export async function updateMastery(input: UpdateInput): Promise<void> {
  const { supabase, childId, factId, isCorrect, childTimezone, rules } = input;

  // 1. Carregar row existente (ou criar default)
  const { data: existing } = await supabase
    .from('child_fact_mastery')
    .select('*')
    .eq('child_id', childId)
    .eq('fact_id', factId)
    .maybeSingle();

  const now = new Date();
  const todayLocal = toLocalDate(now, childTimezone);

  const m = existing ?? {
    child_id: childId,
    fact_id: factId,
    state: 'NEW' as MasteryState,
    times_seen: 0,
    times_correct: 0,
    times_wrong: 0,
    distinct_sessions_correct: 0,
    consecutive_correct: 0,
    consecutive_wrong: 0,
    last_seen_at: null as string | null,
    last_correct_at: null as string | null,
    last_wrong_at: null as string | null,
    last_correct_local_date: null as string | null,
    strength: 0,
  };

  m.times_seen += 1;
  m.last_seen_at = now.toISOString();

  if (isCorrect) {
    m.times_correct += 1;
    m.consecutive_correct += 1;
    m.consecutive_wrong = 0;
    m.last_correct_at = now.toISOString();
    // DP-7: incrementa distinct_sessions_correct apenas se mudou o dia local
    if (m.last_correct_local_date !== todayLocal) {
      m.distinct_sessions_correct += 1;
      m.last_correct_local_date = todayLocal;
    }
  } else {
    m.times_wrong += 1;
    m.consecutive_wrong += 1;
    m.consecutive_correct = 0;
    m.last_wrong_at = now.toISOString();
  }

  // 2. Calcular strength
  m.strength = computeStrength(m, rules, now);

  // 3. Aplicar transicao de estado
  m.state = nextState(m, rules);

  // 4. Upsert
  await supabase
    .from('child_fact_mastery')
    .upsert({ ...m, updated_at: now.toISOString() }, { onConflict: 'child_id,fact_id' });
}

function computeStrength(m: any, rules: AdaptiveRules, now: Date): number {
  const w = rules.strength.weights;
  // recency: decay exponencial baseado em half-life
  let recency = 0;
  if (m.last_correct_at) {
    const dtDays = (now.getTime() - new Date(m.last_correct_at).getTime()) / 86400000;
    recency = Math.pow(2, -dtDays / rules.strength.halfLifeDays);
  }
  const accuracy = m.times_correct / Math.max(1, m.times_seen);
  const sessionFactor = Math.min(1, m.distinct_sessions_correct / rules.strength.targetSessions);
  const wrongPenalty = Math.exp(-rules.strength.wrongDecay * m.consecutive_wrong);

  const base = w.recency * recency + w.accuracy * accuracy + w.sessions * sessionFactor;
  return Math.max(0, Math.min(1, base * wrongPenalty));
}

function nextState(m: any, rules: AdaptiveRules): MasteryState {
  const current = m.state as MasteryState;
  const { learning, mastered, weak } = rules.mastery;

  // WEAK trigger: erro apos REVIEWING/MASTERED
  if (m.consecutive_wrong >= weak.consecutiveWrongTrigger
      && (current === 'REVIEWING' || current === 'MASTERED')) {
    return 'WEAK';
  }

  // WEAK recovery
  if (current === 'WEAK') {
    if (m.distinct_sessions_correct >= weak.recoveryDistinctSessions
        && m.consecutive_correct >= weak.recoveryCorrectPerSession) {
      return 'LEARNING';
    }
    return 'WEAK';
  }

  // NEW -> LEARNING
  if (current === 'NEW' && m.times_seen >= 1) return 'LEARNING';

  // LEARNING -> REVIEWING (ponto A)
  if (current === 'LEARNING'
      && m.distinct_sessions_correct >= learning.distinctSessionsRequired) {
    return 'REVIEWING';
  }

  // REVIEWING -> MASTERED (ponto B + C)
  if (current === 'REVIEWING'
      && m.times_correct >= mastered.totalCorrectRequired
      && m.distinct_sessions_correct >= mastered.distinctSessionsRequired) {
    return 'MASTERED';
  }

  return current;
}

function toLocalDate(d: Date, tz: string): string {
  // YYYY-MM-DD no timezone informado
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}
```

**Critério de aceitação:**
- Teste integração: 5 sessões simuladas com 100% acerto numa questão → estado vira `REVIEWING` após 5 sessões distintas.
- Sessão com erro após `MASTERED` → estado vira `WEAK`.
- 2 sessões em dias distintos com acerto numa questão `WEAK` → estado volta para `LEARNING`.
- Strength calculada batendo com fórmula (validar 1 caso manual).
- `last_correct_local_date` populado no timezone correto.
- Comutatividade: acerto em `7x8` aumenta strength de `8x7` (transferFactor * delta).

---

### Sprint 2.5.6 — Atualizar app (cliente)

**Objetivo:** consumir `questions_payload` server-side; remover PRNG local.

**Criar:** `src/services/challenge.service.ts`

```ts
import { supabase } from '@/lib/supabase';
import type { ChallengeQuestion, ChallengeStartResponse } from '@/types';

export async function startChallenge(args: {
  childId: string;
  challengeDate: string;
  sessionId: string;
  timerSeconds: number;
}): Promise<ChallengeStartResponse> {
  const { data, error } = await supabase.functions.invoke('start_challenge', {
    body: {
      child_id: args.childId,
      challenge_date: args.challengeDate,
      session_id: args.sessionId,
      timer_seconds: args.timerSeconds,
    },
  });
  if (error) throw error;
  return data as ChallengeStartResponse;
}

export async function completeChallenge(args: {
  sessionId: string;
  answers: Array<{
    position: number;
    fact_id: string;
    child_answer: number | null;
    time_taken_ms: number;
    block_number: number;
  }>;
}) {
  const { data, error } = await supabase.functions.invoke('complete_challenge', {
    body: { session_id: args.sessionId, answers: args.answers },
  });
  if (error) throw error;
  return data;
}
```

**Modificar/criar:** `app/(app)/challenge/[date].tsx`
- Chamar `startChallenge` no mount, armazenar `questions` no state local.
- Iterar pelas questões em blocos de 5 conforme PRD.
- Ao concluir, montar `answers[]` com `position`, `fact_id`, `child_answer`, etc., e chamar `completeChallenge`.
- Remover qualquer import de `seedrandom` ou geração local.

**Modificar:** `src/types/index.ts`
- Adicionar `ChallengeQuestion`, `ChallengeStartResponse`.

**Adicionar:** detecção de conexão.
- Instalar `@react-native-community/netinfo`.
- Hook `useNetworkStatus()` em `src/hooks/use-network-status.ts`.
- Em `challenge/[date].tsx`, se offline, mostrar tela "Sem internet — Milo precisa de conexão para preparar seu desafio".

**Critério de aceitação:**
- App não importa nenhuma biblioteca de PRNG/seed para o challenge.
- `startChallenge` retorna 20 questões; tela renderiza na ordem `position`.
- Conexão derrubada: tela de erro amigável aparece em vez de crash.
- Submissão de respostas envia `fact_id` e `position` para o servidor.

---

### Sprint 2.5.7 — Job de recompute (idempotente)

**Objetivo:** recompute completo de mastery a partir de `challenge_answers`. Permite recuperar de bugs no algoritmo sem perder histórico.

**Criar:** `backend/functions/recompute_mastery/index.ts`

- Aceita `{ child_id: string, fact_id?: string }` (fact_id opcional = recomputa todas as 100).
- Apaga rows de `child_fact_mastery` afetadas.
- Itera por `challenge_answers` ordenados por `created_at` para o(s) fact(s) e replica a lógica de `updateMastery` chamada-a-chamada.
- Retorna `{ recomputed: number }`.

**Criar:** `backend/functions/recompute_mastery/__tests__/idempotency.test.ts`
- Roda recompute 2× em sequência: estado final deve ser idêntico.

**Critério de aceitação:**
- Recompute de uma criança com 10 sessões históricas bate exatamente com `child_fact_mastery` calculado online.
- Função protegida por header `X-Admin-Token` ou role `service_role` (não exposta a `authenticated`).

---

### Sprint 2.5.8 — A/B harness

**Objetivo:** permitir duas versões do `adaptive-rules.json` coexistindo, com atribuição estável por `child_id`.

**Criar:** `backend/config/adaptive-rules-v2.json` (cópia de v1 com mudanças experimentais).

**Modificar:** `backend/functions/_shared/adaptive-rules.ts` para expor `getRulesForChild(childId: string): AdaptiveRules`:

```ts
import rulesV1 from '../../config/adaptive-rules.json' with { type: 'json' };
import rulesV2 from '../../config/adaptive-rules-v2.json' with { type: 'json' };

export function getRulesForChild(childId: string): AdaptiveRules {
  const expFlag = Deno.env.get('AB_TEST_ENABLED') === 'true';
  if (!expFlag) return rulesV1 as AdaptiveRules;
  // Hash do childId para atribuicao estavel 50/50
  const h = simpleHash(childId);
  return h % 2 === 0 ? rulesV1 : rulesV2 as AdaptiveRules;
}
```

**Criar:** `docs/ab-testing.md` documentando workflow.

**Critério de aceitação:**
- Mesma `child_id` sempre recebe a mesma versão.
- Flag `AB_TEST_ENABLED=false` força v1 para todos.
- `rules_version` salvo em `challenge_sessions` reflete a versão usada.

---

## 4. Arquivos de documentação a atualizar (após sprints)

Atualizar nos sprints finais ou em PR separado:

- `docs/MathHeroKids_PRD_v1.1.md` → remover seed determinístico, descrever server-side.
- `docs/architecture.md` → online-only para challenges + mastery model.
- `docs/database-schema.md` → adicionar `multiplication_facts`, `child_fact_mastery`, novas colunas.
- `docs/application-flows.md` → novo diagrama do challenge flow.
- `docs/implementation-phases.md` → inserir Phase 2.5 entre Phase 2 e 3.
- `CLAUDE.md` → seção "Challenge" atualizada (remover seed, mencionar payload server-side, online-only).
- `.ai/session-handoff.md` → marcar Phase 2.5 como em curso/concluída.

---

## 5. Workflow operacional (do CLAUDE.md)

Antes de iniciar cada sprint:

```bash
git fix-locks
git add .ai/session-handoff.md && git commit -m "chore: handoff — iniciando 2.5.X" && git push origin main
```

Durante o sprint, commit a cada arquivo concluído:

```bash
git add -A && git commit -m "wip(2.5.X): [arquivo concluido]" && git push origin main
```

Deploy de Edge Function (Phase 2.5 modifica `start_challenge` e `complete_challenge`):

```bash
# 1. Criar/editar em backend/functions/<nome>/index.ts (source of truth)
# 2. Copiar para supabase/functions/
cp -r backend/functions/<nome> supabase/functions/
# 3. Deploy (sem Docker)
.bin/supabase functions deploy <nome> --use-api
# 4. Commitar ambos os paths
git add backend/functions/<nome> supabase/functions/<nome>
```

Atenção: `_shared/` precisa estar em ambos os paths também.

---

## 6. Riscos e pegadinhas

| Risco | Mitigação |
|---|---|
| `import ... with { type: 'json' }` pode não funcionar em todas versões Deno | Testar localmente antes do deploy; fallback é `JSON.parse(await Deno.readTextFile(...))` |
| RLS bloqueia EF se usar `anon` key em vez de `service_role` | Confirmar que `start_challenge` e `complete_challenge` usam `SUPABASE_SERVICE_ROLE_KEY` |
| Timezone da criança não está populado em rows antigas | Migration 007 já define default `'America/Sao_Paulo'` |
| Sessão antiga (Phase 2) sem `questions_payload` chega no `complete_challenge` | Validar `payload != null`; retornar 409 `LEGACY_SESSION_UNSUPPORTED` se for null |
| Latência percebida no `start_challenge` | App deve chamar enquanto Milo apresenta o desafio (~1s de animação cobre o round-trip) |
| Cache desincronizado entre `child_fact_mastery` e `challenge_answers` | Sprint 2.5.7 entrega job de recompute |
| Mudança de regra no JSON sem subir `version` | Adicionar check em CI: se `adaptive-rules.json` muda, `version` precisa incrementar |

---

## 7. Checklist final antes de fechar a Phase 2.5

- [ ] Migrations 006 e 007 aplicadas em prod com sucesso.
- [ ] Seed das 100 questões validada (`COUNT(*) = 100`, distribuição por tier confere).
- [ ] `adaptive-rules.json` validado por `adaptive-rules.schema.json` em CI.
- [ ] `start_challenge` rodando em produção; `questions_payload` populado em novas sessões.
- [ ] `complete_challenge` atualizando `child_fact_mastery` corretamente.
- [ ] Comutatividade testada (acerto em `7x8` reflete em `8x7`).
- [ ] App consumindo payload server-side; sem geração local.
- [ ] Tela de erro de conexão funcional.
- [ ] Job de recompute deployado e testado idempotência.
- [ ] Docs atualizados (`PRD`, `architecture`, `database-schema`, `application-flows`, `implementation-phases`, `CLAUDE.md`).
- [ ] `.ai/session-handoff.md` marca Phase 2.5 como concluída.

---

## 8. Como começar (próximo agente)

```bash
# 1. Resumir contexto
bash /sessions/<session>/mnt/MathHeroKids-UI/.scripts/session-setup.sh

# 2. Ler este handoff
cat /sessions/<session>/mnt/MathHeroKids-UI/docs/phase-2.5-implementation-handoff.md

# 3. Ler design doc para contexto
cat /sessions/<session>/mnt/MathHeroKids-UI/docs/adaptive-multiplication-system.md

# 4. Conferir migrations existentes
ls /sessions/<session>/mnt/MathHeroKids-UI/backend/migrations/

# 5. Atualizar handoff sinalizando inicio do trabalho
# Editar .ai/session-handoff.md > "Em curso": Phase 2.5 — Sprint 2.5.1

# 6. Comecar pelo Sprint 2.5.1 (migration 006)
```

Boa sorte. Qualquer dúvida sobre **decisão de produto** já foi resolvida no documento de design (`adaptive-multiplication-system.md` seção 3). Decisões **técnicas** novas que aparecerem durante implementação: priorizar correção, confiabilidade, idiomatic Deno/TypeScript, e parar para perguntar ao usuário se for algo que muda o comportamento observável do sistema.
