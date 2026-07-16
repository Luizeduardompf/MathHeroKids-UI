# Math Hero Kids UI — Estado do Projeto

Repositório: `/Users/claudecode/Documents/Claude/Projects/MathHeroKids-UI`
App mobile **iOS + Android** (sem web). Matemática gamificada para crianças (6–12 anos).

---

## Stack

React Native + Expo managed + TypeScript strict + Supabase + Expo Router + TanStack Query + Zustand + i18next (pt/en/es/fr) + **Reanimated 4.1** (+ react-native-worklets, SDK 54 / RN 0.81).

---

## Supabase — conta e projecto ⚠️

| | |
|---|---|
| **Conta** | `luizeduardompf2@gmail.com` |
| **Org** | `LuizEduardoMPF2` (`bqwqzagkqaqxnmnrfbdz`) |
| **Projecto** | `MathHeroKids` — ref `pelhtuspcofmejzqtibx` |
| **Região** | `eu-west-1` (Irlanda) |
| **Dashboard** | https://supabase.com/dashboard/project/pelhtuspcofmejzqtibx |

**Conta diferente da do Luka** (`luizeduardompf.lixo@gmail.com`, org `LuizEduardoMPF`, sa-east-1).
O CLI guarda um só token global — alternar com `supabase login` (interactivo, corre o user).
Confirmar sempre com `supabase projects list` antes de concluir que algo desapareceu: ver
projectos do Luka ou um 403 significa token errado, não projecto em falta.

Usar o `supabase` do Homebrew — o `.bin/supabase` do repo é um binário Linux e não corre no Mac.

⚠️ **O projecto original (`lrwlmxyafvmxqyfpawzg`, org `jcbuwtthpcyexkikrawv`) foi apagado**
(detectado 2026-07-16: NXDOMAIN no DNS — um projecto pausado mantinha o DNS). Perderam-se as contas
de pais e o progresso das crianças; o código estava todo versionado. Recriação em curso.

---

## Como testar (confirmado a funcionar — 2026-07-16)

**Simulador (dev, com hot reload):**
```bash
npx expo start --dev-client --port 8082   # depois premir "i"
```
- `--dev-client` é obrigatório: o projecto tem pasta `ios/` (build nativo), não corre em Expo Go a partir do Mac.
- `--port 8082` porque a 8081 costuma estar ocupada por outro dev server.
- Build nativo já instalado no simulador iPhone 17. Só é preciso `npx expo run:ios` se mexer em
  código nativo, `app.json` ou dependências.

**iPhone 16 Pro físico (standalone, Release):** ✅ confirmado 2026-07-16
```bash
npx expo run:ios --device 00008140-001A45E80CEA801C --configuration Release --no-bundler
```
- Requer: iPhone desbloqueado + cabo + Developer Mode on. 1ª abertura: confiar no Apple ID em
  Definições → Geral → VPN e Gestão de Dispositivos.
- **NÃO exige Apple Developer Program.** Personal Team gratuita chega. Custo: app **caduca a 7 dias**,
  sem push, máx. 3 apps. Bundle ID: `com.luizeduardompf.mathherokids`.
- O Apple Developer Program ($99/ano) só é preciso para TestFlight, distribuição OTA/sem cabo e push.

**iPhone via Expo Go:** `npx expo start --tunnel` → ler QR. (`--tunnel` necessário; LAN não funcionou.)
Expo Go SDK 54 já inclui Reanimated 4.1 + worklets.

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
