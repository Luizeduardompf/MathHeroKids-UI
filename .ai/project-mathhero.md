# Math Hero Kids UI — Estado do Projeto

Repositório: `/Users/claudecode/Documents/Claude/Projects/MathHeroKids-UI`
App mobile **iOS + Android** (sem web). Matemática gamificada para crianças (6–12 anos).

---

## Stack

React Native + Expo managed (SDK 54) + TypeScript strict + Supabase + Expo Router 6 + TanStack Query + Zustand + i18next (pt/en/es/fr) + Reanimated 4.

**⚠️ SDK: 54.0.0 (NÃO upgradar sem verificar Expo Go App Store)**
Expo Go no iPhone do Luiz = SDK 54 (v54.0.2). Tag `v1.1-sdk56-backup` preserva estado SDK 56.
Versões actuais: expo@~54.0.0, react@19.1.0, react-native@0.81.5, expo-router@~6.0.24, reanimated@~4.1.1, worklets@0.5.1

---

## Estrutura de pastas

```
app/          → Expo Router (frontend — telas)
src/          → Código React Native (frontend — services, stores, components, hooks, theme, types)
backend/      → Supabase server-side (Edge Functions Deno, migrations SQL, seeds)
docs/         → Documentação de produto e técnica (PRD, architecture, schema, phases, flows)
design/       → Mockups, exports, screenshots de design
assets/       → Assets Expo (ícones, splash, imagens estáticas)
.ai/          → Memória e contexto do agente IA (este directório)
CLAUDE.md     → Instruções para agentes IA (root do projecto)
```

---

## Status de Implementação (2026-06-11)

### Phase 0 — Foundation ✅ COMPLETO
Design system, Expo Router skeleton, i18n, Supabase client, Zustand stores, tema.

### Phase 1 — Auth & Profiles ✅ COMPLETO

- `src/services/auth.service.ts` — signUp, signIn, signOut, resetPassword
- `src/services/child.service.ts` — CRUD completo + isUsernameAvailable
- `src/stores/profile.store.ts` — Zustand + AsyncStorage persist para activeChild
- Telas wired: login, register/parent, register/child, forgot-password, profile-select
- Tag: `v1.1-phase1-complete`

### Phase 2.5 — Adaptive Multiplication System ✅ COMPLETO (2026-06-11)

**Backend:**
- `backend/migrations/006_multiplication_facts.sql` — 100 questões, tiers T1–T5
- `backend/migrations/007_child_fact_mastery.sql` — mastery por (child_id, fact_id), timezone, colunas legacy deprecated
- `backend/config/adaptive-rules.json` + schema — regras versionadas
- `backend/functions/_shared/adaptive-rules.ts` — loader + A/B harness
- `backend/functions/_shared/question-selector.ts` — algoritmo de seleção adaptativa
- `backend/functions/_shared/mastery.ts` — updateMastery, computeStrength, nextState, comutatividade
- `start_challenge` EF — geração server-side, persiste questions_payload (deployada)
- `complete_challenge` EF — valida contra payload, atualiza mastery (deployada)
- `recompute_mastery` EF — replay idempotente do histórico (deployada)
- `adaptive-rules-v2.json` — variante experimental para A/B test

**App cliente:**
- `src/services/challenge.service.ts` — nova API: sem seed, sem offline queue, retorna ChallengeStartResponse
- `src/hooks/use-network-status.ts` — hook de conectividade
- `app/(app)/challenge/[date].tsx` — consome payload server-side, tela offline, sem PRNG local
- `src/types/index.ts` — ChallengeQuestion, ChallengeStartResponse, MasteryState
- `AnswerDraft.fact_id?` + `position?` propagados via submitAnswer

**Migrations PENDENTES (aplicar no Supabase Studio):**
- `006_multiplication_facts.sql`
- `007_child_fact_mastery.sql`

### Phase 2 — Challenge Engine ⚠️ CÓDIGO COMPLETO (substituído por Phase 2.5)

**Implementado (commit f04109e + cb58193):**
- `src/lib/question-generator.ts` — PRNG determinístico (djb2 + Mulberry32), 20 pares únicos por seed
- `src/stores/challenge.store.ts` — FSM completa: idle → loading → playing → correct/wrong/timeout/milestone → completed → submitting
- `src/services/challenge.service.ts` — startChallenge, completeChallenge, offline queue + flush
- `app/(app)/challenge/[date].tsx` — gameplay completo (keypad, timer, overlays, milestones Q5/Q10/Q15, conclusão)
- `app/(app)/(tabs)/challenge.tsx` — redireciona para challenge/[hoje]
- `backend/functions/start_challenge/index.ts` — cria/retoma sessão, idempotente
- `backend/functions/complete_challenge/index.ts` — valida respostas, XP, level, streak, calendar, ledger
- `backend/functions/_shared/cors.ts` — CORS headers partilhados

**Decisão arquitectural (vs spec original):**
- `submit_answer` por questão → removido; batch de 20 respostas via `complete_challenge` (documentado no CLAUDE.md)

**Gaps conhecidos:**
- `block_end` overlay (BlockIncomplete) — fase existe no store mas UI não tem tela dedicada; erros de bloco vão para wrong/timeout
- Testes automatizados — zero ficheiros `.test.` no repo
- Trophy/achievement logic — placeholder no `complete_challenge` ("simplified for Phase 2"); full logic delegada para Phase 3

**Status deploy:**
- Edge Functions `start_challenge` e `complete_challenge` — **não deployadas ainda**
- Teste E2E — **não realizado ainda**

### Phases 3–9 — Pendentes

Ver `docs/implementation-phases.md` para roadmap completo.

---

## Regras Críticas de Arquitetura

- **XP / progressão**: NUNCA mutados client-side — sempre via Edge Functions (`complete_challenge`)
- **Children**: NÃO são Auth users — autenticação = parent session + profile switcher client-side
- **Challenge**: 20 questões geradas client-side (seed determinístico), enviadas em batch no fim
- **Serviços**: telas não chamam `supabase` directamente — usam `src/services/` + TanStack Query
- **PIN parental**: bcrypt via Edge Function `verify_parent_pin` — nunca client-side
- **Rankings**: queries on-demand indexadas, não tabelas pré-computadas
- **Offline**: AsyncStorage sync queue — não SQLite (overengineering para MVP)
