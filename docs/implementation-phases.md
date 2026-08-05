# Math Hero Kids — Implementation Phases

Each phase produces a working, testable vertical slice. Phases are ordered by dependency and risk.

> ⚠️ **Atualizado em 2026-08-05.** Este documento descreve o plano original — a implementação
> real avançou fora de ordem: Fases 3–7 já estão largamente feitas (gamificação, calendário,
> social incluindo chat, settings), enquanto Fase 8 (offline) foi **deliberadamente abandonada**
> (ver `architecture.md` §4.3) e Fase 9 (QA/launch) nunca começou. Cada fase abaixo tem agora uma
> nota "**Estado real**" — o resto do texto (goals/deliverables) fica como referência do desenho
> original, não reescrito linha a linha.

---

## Phase 0 — Foundation (Week 1–2)

**Goal**: Project scaffolding, design system, CI/CD.

Deliverables:
- Expo project with TypeScript strict mode
- Expo Router navigation skeleton (all routes, empty screens)
- Supabase project provisioned (dev + prod environments)
- All DB tables created with migrations (see `database-schema.md`)
- RLS policies active on all tables
- Edge Function scaffolding (empty handlers)
- Design system implemented: colors, typography, spacing tokens, base components (Button, Input, Card, Avatar)
- i18n setup: `pt`, `en`, `es`, `fr` skeleton files
- CI: lint, type-check, unit test runner (Jest + Testing Library)
- EAS Build configured

No app features. Only infrastructure.

---

## Phase 1 — Auth & Profiles (Week 3–4)

**Goal**: A parent can register, log in, and create child profiles. Profile switcher works.

Screens:
- Welcome, Login, Forgot Password
- Parent Registration (Step 1)
- Child Registration (Step 2)
- Profile Switcher ("Quem está jogando?")

Backend:
- Supabase Auth (email/password) for parents
- `parent_profiles` creation on auth signup (DB trigger)
- `child_profiles` CRUD (create, read, update — no delete in MVP)
- Child username uniqueness validation
- Child password hash (bcrypt via Edge Function — NOT client-side)
- Parent PIN: set + verify (bcrypt, Edge Function)
- RLS: verify parent isolation

State:
- `authStore` (Zustand): parent session
- `profileStore`: active child profile
- Persistence: auth token via Expo SecureStore; active child ID via AsyncStorage

Testing:
- Registration happy path
- Duplicate username rejection
- Wrong PIN lockout (after N attempts)
- RLS: parent cannot read another parent's children

---

## Phase 2 — Challenge Engine (Week 5–7) ✅ Completo

**Goal**: A child can complete a daily challenge end-to-end with XP awarded.

Screens:
- Challenge screen (active gameplay)
- Correct/Wrong/TimeExpired/BlockIncomplete feedback overlays
- Milo milestone moments (Q5, Q10, Q15)
- Challenge Completed screen

Backend (Edge Functions):
- `start_challenge`: create/resume `challenge_sessions`; idempotent
- `complete_challenge`: validate answers, award XP, update `child_profiles`, `calendar_days`, streak

---

## Phase 2.5 — Adaptive Multiplication System ✅ Completo

**Goal**: Substituir geração seed determinística por seleção adaptativa server-side com mastery por questão.

Decisões de design em `docs/adaptive-multiplication-system.md`. Implementação em `docs/phase-2.5-implementation-handoff.md`.

### Sprints entregues

| Sprint | Entregável | Estado |
|---|---|---|
| 2.5.1 | `006_multiplication_facts.sql` — 100 questões, tiers T1–T5 | ✅ |
| 2.5.2 | `007_child_fact_mastery.sql` — mastery, timezone, colunas legacy deprecated | ✅ |
| 2.5.3 | `adaptive-rules.json` + schema + `_shared/adaptive-rules.ts` | ✅ |
| 2.5.4 | Refactor `start_challenge` — geração adaptativa, persiste `questions_payload` | ✅ |
| 2.5.5 | Refactor `complete_challenge` — valida contra payload, atualiza mastery | ✅ |
| 2.5.6 | App cliente — consome payload server-side, `use-network-status`, offline screen | ✅ |
| 2.5.7 | `recompute_mastery` EF — idempotente, replay histórico | ✅ |
| 2.5.8 | A/B harness — `adaptive-rules-v2.json`, `getRulesForChild`, `docs/ab-testing.md` | ✅ |

### Arquitetura resultante

- **Online-only**: challenges requerem conexão. Sem offline queue para sessões.
- **Server-authoritative**: questões geradas pelo servidor, payload persistido em `challenge_sessions.questions_payload`.
- **Mastery por questão**: estados NEW→LEARNING→REVIEWING→MASTERED←→WEAK por `(child_id, fact_id)`.
- **Progressão de tiers**: T1+T2 na cold start; T3–T5 desbloqueados por mastery.
- **Comutatividade**: acerto em 7×8 transfere 50% de crédito para 8×7.
- **A/B harness**: `AB_TEST_ENABLED=true` ativa distribuição estável 50/50 por `child_id`.

---

## Phase 3 — Gamification Core (Week 8–9)

**Estado real: ✅ Feito**, com valores de XP diferentes do estimado aqui (2/resposta + 4
conclusão + 10 perfeito, não 10/resposta — ver `architecture.md` §5.1) e níveis até 100 (não
até 20). Troféu "Madrugador" continua sem condição de desbloqueio definida (OQ-11).

**Goal**: XP, levels, streaks, trophies, achievements all update correctly after challenges.

Backend (Edge Functions / DB triggers):
- Level-up detection: compare `xp_total` against `level_thresholds`; update `child_profiles.level`
- Streak update: consecutive day check; update `current_streak`, `best_streak`, insert `child_streaks`
- Trophy progress: evaluate all trophy conditions after each challenge completion
- Achievement unlock: evaluate all achievement conditions after each challenge completion
- `child_xp_ledger` append for all XP events

Screens:
- Level Up Celebration modal (fires post-challenge if level changed)
- Trophy Room (full list, tap for detail)
- Trophy Detail
- Achievements screen
- Level Progression screen
- Level Rewards screen

Testing:
- Exact XP amounts per event type
- Level up fires at correct threshold
- Streak breaks on missed day, does NOT restore on retroactive
- Trophy: Daily awarded after 1 completion, weekly after 7/7, monthly after 30/30
- Achievement unlock is idempotent (only fires once)

---

## Phase 4 — Calendar (Week 10)

**Estado real: ✅ Feito**, incluindo `is_retroactive` (migration 009, correção de um bug de
estado que não estava previsto aqui).

**Goal**: Calendar screen fully functional with all day states.

Screens:
- Calendar screen (infinite scroll month navigation)
- Tap past day → retroactive challenge flow

Backend:
- `calendar_days` populated by `complete_challenge` Edge Function
- Past days with no session row = "future" or "failed" depending on date

Testing:
- Calendar shows correct state for completed, failed, in_progress, perfect days
- Monthly progress % is accurate
- Weekly progress bar is accurate
- Retroactive challenge updates calendar day state correctly

---

## Phase 5 — Social (Week 11–12)

**Estado real: ✅ Feito, e mais do que o planeado aqui.** Além de amigos/pedidos/ranking, existe
**chat 1:1** entre amigos (`messages`, migration 003 — nunca previsto neste doc) e **bloqueio de
amigos** (`friends/blocked.tsx` — mas guardado em `AsyncStorage`, não numa tabela Supabase; ver
`application-flows.md` §5.3). Ranking usa Realtime para deteção de ultrapassagem (migration
010) — o plano abaixo assumia só uma tabela `weekly_rankings` pré-computada, que **nunca foi
criada** (fica como query on-demand, ver `architecture.md` §6).

**Goal**: Friends system, friend requests, friend rankings.

Screens:
- Friends list (with pending requests)
- Add Friend / Search
- Friends Ranking (weekly + monthly toggle)

Backend:
- Friend request send/accept/reject/cancel (via Edge Functions; not direct writes to prevent abuse)
- Friend ranking: `weekly_rankings` populated by scheduled Edge Function (every midnight UTC)
- Friend suggestion algorithm (friends-of-friends, same level range) — simple implementation first
- Realtime: friend request badge via Supabase Realtime channel subscription

Testing:
- Can't friend self
- Duplicate request rejection
- Accept → bidirectional friendship rows created
- Reject → request closed, can re-send after 24h (anti-abuse)
- Ranking correctly sorted by weekly XP

---

## Phase 6 — Dashboard & Home Polish (Week 13)

**Estado real: ✅ Feito.** Nota: o título do cartão de desafio ("Multiplication Mountain") ficou
como texto fixo no código, não reflete a operação real do desafio nem é traduzido — ver
`application-flows.md` §2.

**Goal**: Home dashboard fully assembled with all sections.

Screens:
- Home Dashboard (all 7 sections functional)
- Statistics section
- Friends activity preview

Polish:
- Milo motivation messages (contextual: streak ongoing, streak broken, challenge done today, challenge not done)
- Header profile switcher dropdown (quick switch without going to full switcher screen)

---

## Phase 7 — Settings & Parent Controls (Week 14)

**Estado real: ✅ Feito, e expandido.** Além do previsto: `question_count`,
`enabled_operations`/`mix_operations`, `timer_auto` são todos configuráveis por criança; existe
uma 2ª camada "Developer" (`developers.tsx`, password fixa `120380` hardcoded no cliente) com
ferramentas internas (settings do reteste em runtime) e a integração WhatsApp
(`developer-whatsapp.tsx`) que não existiam neste plano.

**Goal**: Settings screen and parent area fully functional.

Screens:
- Settings (Ajustes) — language, timer, multiplication max
- Parent PIN gate
- Parent Controls (per-child settings)
- Add Child (from parent area)
- Edit Child Profile

Testing:
- Timer change takes effect on next challenge (not current)
- Language change re-renders all strings immediately
- Child profile edit: username uniqueness still validated
- PIN: brute-force protection (lockout after 5 wrong attempts, 30min timeout)

---

## Phase 8 — Offline Support & Sync (Week 15)

**Estado real: ❌ Deliberadamente abandonada, não "pendente".** A geração de questões é
server-side e adaptativa (depende de mastery, que só existe no servidor) desde a Phase 2.5 —
não é possível gerar localmente para sincronizar depois, como este plano assumia. Decisão:
challenges são **online-only**; sem SQLite, sem fila de sync. Ver `architecture.md` §4.3 e
`docs/adaptive-multiplication-system.md` §3. Não reconsiderar sem mudar a arquitetura do motor
adaptativo primeiro.

**Goal**: App works without internet; data syncs when reconnected.

Implementation:
- Expo SQLite local mirror for: `challenge_sessions`, `challenge_answers`, `child_profiles` (read cache)
- Sync queue: outbound mutations queued when offline
- Conflict resolution: server wins for XP and streaks (server-authoritative); local wins for abandoned sessions
- Network state hook: show offline banner
- Optimistic updates for challenge UI (XP animations fire immediately, reconciled on sync)

Testing:
- Full challenge offline → reconnect → data synced, XP correct, no duplicates
- Multiple offline challenges → all synced in order
- Server-side idempotency keys on Edge Functions (re-submitting same session is safe)

---

## Phase 9 — QA, Performance & Launch Prep (Week 16–17)

**Estado real: ❌ Não iniciada.** Nenhum item desta lista foi feito. Nenhum build nativo iOS
foi bem-sucedido até hoje (3 tentativas erradas, 2026-06-12); a distribuição atual é via Expo Go
+ EAS Update OTA, não builds instalados (ver `CLAUDE.md`). QA feito até agora foi manual, por
sessão (ver handoffs), não automatizado.

- E2E tests (Detox): registration → challenge → level up flow
- Performance: FlatList virtualization for calendar, friends list
- Bundle size audit (Expo bundle analyzer)
- Accessibility: VoiceOver / TalkBack basics
- Push notification setup (Expo Notifications): daily challenge reminder
- App Store / Play Store submission preparation
- Privacy policy, terms of service
- LGPD / COPPA compliance review

---

## Dependency Map

```
Phase 0 (Foundation)
  └─→ Phase 1 (Auth)
        └─→ Phase 2 (Challenge Engine)
              ├─→ Phase 3 (Gamification)
              │     ├─→ Phase 4 (Calendar)
              │     └─→ Phase 5 (Social)
              │           └─→ Phase 6 (Dashboard)
              └─→ Phase 7 (Settings)     ─→ Phase 8 (Offline)
                                                └─→ Phase 9 (QA/Launch)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Offline sync conflicts (double XP) | Medium | High | Idempotency keys on all Edge Functions |
| Streak calculation edge cases (timezone) | High | Medium | Store all dates in UTC; apply timezone offset client-side for display only |
| Child PIN brute-force | Medium | High | Server-side rate limiting + lockout on Edge Function |
| Supabase Realtime at scale (rankings) | Low | Medium | Pre-compute rankings in scheduled job; Realtime only for notifications |
| App Store rejection (child data) | Medium | High | COPPA/LGPD review before submission; parental consent checkbox at registration |
| XP manipulation via network interception | Medium | High | All XP mutations via Edge Functions; client never writes XP directly |
