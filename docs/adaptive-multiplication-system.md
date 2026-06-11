# Sistema Adaptativo de Tabuadas — Design final

> Status: **Decisões fechadas em 2026-06-11.** Pronto para implementação na Phase 2.5.
> Documento companheiro: `docs/phase-2.5-implementation-handoff.md` (guia executável de implementação).

## 1. Resumo executivo

Módulo de multiplicação transformado em sistema de **mastery por questão**:

- Banco fixo de **100 questões** (1×1 até 10×10), cada uma com peso de dificuldade base.
- Tracking individual por `child × question`: acertos, erros, sessões distintas, último visto, força atual.
- Estados de mastery inspirados em **Duolingo Half-Life Regression (HLR)**: `NEW → LEARNING → REVIEWING → MASTERED → WEAK`.
- Seleção por **mix ponderado** server-side (Edge Function), com aleatoriedade real e sem repetição intra/inter-sessão.
- Regras parametrizadas via **JSON de configuração** versionado.
- **App online-only** — sem fila de sync offline para sessões de challenge.

## 2. Pesquisa de base

### 2.1 Duolingo Half-Life Regression

Duolingo modela cada item como tendo uma **meia-vida de memória** (h). Retrievability decai exponencialmente:

```
p(recall) = 2 ^ (-Δt / h)
```

Para nós: **modelo heurístico inspirado em HLR**, não ML. A "força" de uma questão combina três sinais: acertos totais, sessões distintas com acerto, e tempo desde o último acerto. Erros recentes pesam mais que erros antigos.

### 2.2 Dificuldade cognitiva das tabuadas

Pesquisa convergente aponta as 10 mais difíceis para crianças de 9–10 anos:
`6×9, 7×8, 7×6, 8×6, 4×8, 4×9, 7×9, 7×7, 6×7, 4×7`

Mais fáceis (>90% acerto em ≤3s): `1×n, 2×n, 5×n, 10×n, n×n pequenos`.

Padrão: produtos com **6, 7, 8, 9** sem ancoragem mnemônica são os mais custosos.

## 3. Decisões fechadas (DP-1 a DP-7)

| ID | Decisão | Justificativa |
|---|---|---|
| **DP-1** | 7×8 e 8×7 são **questões distintas** | Compartilham `fact_group_id`. Transferência configurável (default 50%) — mastery de uma reforça parcialmente a outra |
| **DP-2** | Geração **server-side** via Edge Function | Adaptativo exige mastery server-authoritative; permite A/B testing; remove duplicação client/server da lógica |
| **DP-3** | **10×10 = 100 questões** no MVP | Cobre 95% do uso esperado; expandir só com demanda real |
| **DP-4** | WEAK → recovery: **2 sessões distintas** com ≥1 acerto cada | Alinhado com curva de esquecimento; consolida apenas com revisão real entre dias |
| **DP-5** | **JSON** como formato de config | Parser nativo Deno, JSON Schema padrão da indústria, diff git mais limpo |
| **DP-6** | Edição via **PR no repo** (MVP) | Único dev; UI admin fica para Phase 6+ quando houver time pedagógico |
| **DP-7** | "Sessão distinta" = **por dia calendário** (timezone da criança) | Coerente com Ebbinghaus + PRD diário + anti-gaming |

**Decisão complementar:** App **online-only**. Remove `AsyncStorage sync queue` para challenges. Cache só para sessão, `activeChild`, idioma e tema.

## 4. Ranking inicial de dificuldade

Escala 1 (trivial) a 5 (muito difícil). Usado pelo algoritmo para ordenar a introdução e para o mix de seleção.

| Tier | Peso | Critério | Exemplos |
|---|---|---|---|
| T1 — Trivial | 1 | ×1, ×10 | 1×7, 10×4, 7×1 |
| T2 — Fácil | 2 | ×2, ×5, quadrados pequenos | 2×8, 5×6, 3×3, 4×4 |
| T3 — Médio | 3 | ×3, ×4 (não-quadrado), ×9 | 3×7, 4×6, 9×6 |
| T4 — Difícil | 4 | Pares com 6–8 sem padrão | 6×8, 8×4, 7×4 |
| T5 — Muito difícil | 5 | "Inferno dos 6/7/8" | 6×7, 7×8, 8×6, 7×7, 6×9, 8×9 |

Distribuição completa: 19 T1, 30 T2, 25 T3, 16 T4, 10 T5. Seed SQL completa em `backend/migrations/006_multiplication_facts.sql` (ver handoff).

## 5. Estados de mastery

```
NEW         → criança nunca viu
LEARNING    → viu mas ainda não atingiu critério inicial
REVIEWING   → critério inicial atingido, em consolidação
MASTERED    → critério forte atingido, mostrar raramente
WEAK        → tinha mastery mas errou recentemente, volta com frequência
```

Transições governadas pelos parâmetros do JSON:

- `NEW → LEARNING`: primeira aparição.
- `LEARNING → REVIEWING`: ≥ **5 sessões distintas** com acerto (ponto A).
- `REVIEWING → MASTERED`: ≥ **8 acertos totais** (ponto B) **em ≥ 4 sessões distintas** (ponto C).
- `REVIEWING|MASTERED → WEAK`: erro após estabilidade.
- `WEAK → LEARNING`: ≥ 2 sessões distintas com ≥1 acerto cada (DP-4).

## 6. Schema de banco (resumo)

SQL completo em `backend/migrations/006_*.sql` e `007_*.sql` (ver handoff).

**Catálogo estático** — `multiplication_facts`:
- 100 rows, PK `text` (ex: `fact_7x8`), com `operand_a`, `operand_b`, `answer`, `fact_group_id`, `base_difficulty`.

**Mastery por criança** — `child_fact_mastery`:
- PK composta `(child_id, fact_id)`.
- Estado, contadores, `strength` (real 0..1), `next_review_at`, timestamps.
- Cache derivável de `challenge_answers` — em caso de bug, recomputa.

**Alterações em tabelas existentes:**
- `challenge_sessions`: adicionar `questions_payload jsonb`, `rules_version int`, `selection_metadata jsonb`. Tornar `question_seed` nullable (deprecado).
- `challenge_answers`: adicionar `fact_id text`, `response_time_ms int`.
- `child_profiles`: adicionar `timezone text` default `'America/Sao_Paulo'`.

## 7. Algoritmo de seleção

Edge Function `start_challenge` faz:

```
1. Carregar mastery das 100 questões para o child (1 query indexada).
2. Particionar em buckets: WEAK, LEARNING, REVIEWING, MASTERED, NEW.
3. Aplicar pesos do JSON:
   weak: 30%, learning: 35%, new: 15%, reviewing: 15%, mastered: 5%.
4. Sampleamento por bucket:
   - Sem reposição.
   - Excluir questões usadas nos últimos K=2 desafios (cooldown).
   - Para NEW, respeitar ordem de tier (T1 antes de T2).
5. Se bucket não tem itens suficientes, redistribuir para o próximo (ordem: WEAK→LEARNING→REVIEWING→NEW→MASTERED).
6. Intercalar dificuldades na ordem final (não agrupar T5 no fim).
7. Persistir lista em challenge_sessions.questions_payload.
8. Retornar payload + session_id para o cliente.
```

**Introdução progressiva (cold start):** criança nova começa só com T1+T2. T3 desbloqueia quando ≥60% das questões T2 atingirem `LEARNING+`. T4 desbloqueia em 50% de T3, T5 em 40% de T4. Configurável.

**Cálculo de strength:**

```ts
strength = clamp01(
  w_recency  * decay(now, last_correct_at, halfLifeDays) +
  w_accuracy * (times_correct / max(1, times_seen)) +
  w_sessions * min(1, distinct_sessions_correct / targetSessions)
) * exp(-wrongDecay * consecutive_wrong)
```

## 8. Configuração JSON

Arquivo: `backend/config/adaptive-rules.json` — versionado, bundled na Edge Function, validado por JSON Schema no boot.

```json
{
  "version": 1,
  "lastUpdated": "2026-06-11",
  "mastery": {
    "_description": "Thresholds de transição entre estados (pontos A, B, C)",
    "learning": {
      "distinctSessionsRequired": 5,
      "_comment": "ponto A — sair de LEARNING"
    },
    "mastered": {
      "totalCorrectRequired": 8,
      "distinctSessionsRequired": 4,
      "_comment": "ponto B e C — chegar a MASTERED"
    },
    "weak": {
      "consecutiveWrongTrigger": 1,
      "recoveryDistinctSessions": 2,
      "recoveryCorrectPerSession": 1
    }
  },
  "selectionMix": {
    "_description": "Pesos por bucket — soma deve ser 1.0",
    "weights": {
      "WEAK":      0.30,
      "LEARNING":  0.35,
      "NEW":       0.15,
      "REVIEWING": 0.15,
      "MASTERED":  0.05
    },
    "fallbackOrder": ["WEAK", "LEARNING", "REVIEWING", "NEW", "MASTERED"]
  },
  "antiRepeat": {
    "intraSessionUnique": true,
    "crossSessionCooldown": 2,
    "introduceByDifficulty": true
  },
  "progression": {
    "_description": "Desbloqueio de tiers de dificuldade",
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
    "transferFactor": 0.5,
    "_comment": "acerto em 7x8 conta 50% para mastery de 8x7"
  },
  "sessionDistinctness": {
    "mode": "byCalendarDay",
    "_comment": "DP-7: sessões distintas contadas por dia calendário no timezone da criança"
  },
  "session": {
    "questionsPerChallenge": 20,
    "blockSize": 5,
    "maxWeakPerSession": 8,
    "_comment": "cap de WEAK evita frustração"
  }
}
```

JSON Schema em `backend/config/adaptive-rules.schema.json` valida estrutura e tipos no boot da Edge Function. Mudanças versionadas via PR.

## 9. Roadmap Phase 2.5

| Sprint | Entregável | Critério de aceitação |
|---|---|---|
| 2.5.1 | Migrations 006/007 + seed das 100 questões | Query retorna 100 rows; distribuição por tier validada |
| 2.5.2 | `adaptive-rules.json` + schema + loader em `_shared/` | Boot rejeita JSON inválido com erro claro |
| 2.5.3 | Refactor `start_challenge` — geração adaptativa | 100 desafios gerados; nenhum com questão repetida; mix respeita pesos ±10% |
| 2.5.4 | Refactor `complete_challenge` — atualiza mastery, computa strength, transição de estado | Integração: 5 sessões simuladas → mastery converge para REVIEWING |
| 2.5.5 | Job de recompute (idempotente) — recalcula mastery do log | Recompute bate com estado atual ±0 |
| 2.5.6 | Atualizar app: remover seed client-side, consumir `questions_payload` | Tela challenge renderiza payload server-side; sem regeneração local |
| 2.5.7 | Telemetria interna — distribuição de estados | Query SQL retorna histograma por criança |
| 2.5.8 | A/B harness — duas versões do JSON coexistindo via `rules_version` | Documentado em `docs/ab-testing.md` |

**Riscos e mitigações:**

| Risco | Mitigação |
|---|---|
| Desafios monótonos no cold start | `maxWeakPerSession` + introdução progressiva forçada |
| Crianças com muito WEAK frustram | Cap de WEAK por sessão (default 8/20) |
| Mastery cache dessincroniza | Job de recompute on-demand + recompute noturno |
| Edge Function latência percebida | Pré-fetch na tela anterior (Milo apresentando) |

## 10. Mudanças no app

- Tela `challenge/[date].tsx`: consome `questions_payload` retornado por `start_challenge`. Sem PRNG local.
- Service `src/services/challenge.service.ts`: novo, encapsula chamadas a `start_challenge` e `complete_challenge`.
- Detecção de conexão (`@react-native-community/netinfo`) com tela de erro amigável quando offline.
- Constants `src/constants/config.ts`: remover `multiplication_max` se for fixar em 10×10, ou manter para futuras expansões.

## 11. Pendências documentais

A Phase 2.5 exige atualizar:
- `docs/MathHeroKids_PRD_v1.1.md` — remover seção de seed determinístico, descrever fluxo server-side.
- `docs/architecture.md` — online-only, server-side selection, mastery model.
- `docs/database-schema.md` — adicionar `multiplication_facts`, `child_fact_mastery`, novas colunas.
- `docs/application-flows.md` — atualizar diagrama do challenge flow.
- `docs/implementation-phases.md` — inserir Phase 2.5 entre 2 e 3.
- `CLAUDE.md` — atualizar seção "Challenge" e remover menção a SQLite/offline sync para sessões.

## 12. O que vem agora

Implementação executável passo-a-passo está em **`docs/phase-2.5-implementation-handoff.md`**. Esse documento contém:
- SQL completo das migrations.
- JSON completo de configuração + schema.
- Skeletons das Edge Functions com tipagem.
- Lista exata de arquivos a criar/modificar.
- Ordem de execução por sprint.
- Critérios de aceitação por sprint.
