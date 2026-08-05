# Math Hero Kids — Architecture

> Reescrito em 2026-08-05 para refletir o estado real do código (a versão anterior descrevia o
> desenho pré-implementação — geração de questões client-side, oferta única de multiplicação,
> XP de 10/resposta, sem WhatsApp/chat — nada disso corresponde ao que existe hoje).

---

## 1. Overview

Math Hero Kids é uma app mobile de matemática gamificada para crianças (6–12 anos), iOS +
Android, **sem versão web**. Dois papéis (Pai e Criança, esta última sem login próprio),
múltiplos perfis de criança por conta, quatro idiomas, camada social (amigos + chat + ranking),
e um motor adaptativo multi-operação (multiplicação/adição/subtração/divisão) com mastery por
questão. Challenges são **online-only** por decisão deliberada — ver §4.3.

---

## 2. Tech Stack (real)

| Camada | Tecnologia | Notas |
|---|---|---|
| App | React Native + Expo (managed workflow) | `expo ~54.0.35`, SDK 54 |
| Linguagem | TypeScript strict | Sem `any` |
| Routing | Expo Router (file-based) | `expo-router ~5.0.7` — fixado propositadamente abaixo do que o SDK 54 espera (~6.x); ver nota |
| Backend | Supabase | Auth, PostgreSQL, Edge Functions (Deno), Realtime, Vault |
| Server state | TanStack Query | Cache + mutations |
| Client state | Zustand | `authStore`, `profileStore` (persist AsyncStorage) |
| i18n | i18next + expo-localization | pt, en, es, fr |
| Animações | React Native Reanimated **4.1** (`react-native-reanimated ~4.1.1`) | Migrado de 3.17 em 2026-06-16 (commit `1ad6fdb`) para alinhar com o bundle nativo do SDK 54; depende de `react-native-worklets` |
| Offline | AsyncStorage apenas | `activeChild`, idioma, tema, completions locais de calendário — nunca challenges (§4.3) |

**Nota — `expo-router` fixado em v5**: `npx expo install --check` assinala que o SDK 54 espera
`~6.0.24`; o projeto está deliberadamente em `~5.0.0` desde uma sessão de debug em junho/2026
("fix: expo-router 5 no plugin") que resolveu um problema de compatibilidade com o Expo Go.
Este drift é intencional, não um esquecimento — não fazer upgrade sem re-testar em Expo Go real.

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    React Native / Expo App (Expo Go)              │
│                                                                    │
│  (auth) → (profile-select) → (app)/(tabs): home, calendar,        │
│           challenge, friends, settings  +  parent-area (PIN)      │
│                                                                    │
│  TanStack Query (server state)   │   Zustand (auth, activeChild)  │
└──────────────────────────────────────────────────────────────────┘
                          │  HTTPS (Supabase client)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                           Supabase                                │
│  Auth (só pais)  │  PostgreSQL (RLS em todas as tabelas)  │       │
│  Realtime: friend_requests badge, ranking overtake, chat  │       │
│  Vault: segredos Evolution API                              │     │
│                                                                    │
│  Edge Functions (Deno):                                          │
│  start_challenge · complete_challenge · recompute_mastery        │
│  verify_parent_pin · send/respond/cancel_friend_request           │
│  delete_child · update_app_config                                 │
│  evolution-dev · evolution-webhook · test-whatsapp-message         │
│  send-whatsapp-notifications (cron pg_cron, 1x/hora)              │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              Railway — mathhero-whatsapp (Evolution API self-hosted)
```

Distribuição atual: sem build nativo iOS bem-sucedido ainda (3 tentativas erradas em
2026-06-12) — os dispositivos reais correm a app via **Expo Go** consumindo updates OTA
publicados no branch `main` (`eas update --branch main`). Ver `CLAUDE.md`.

---

## 4. Application Layers

### 4.1 Navigation Structure (real, `app/`)

```
Root (app/_layout.tsx)
├── (auth)
│   ├── welcome, login, forgot-password
│   └── register/parent, register/child
│
├── (profile-select)
│   ├── index            ← "Quem está jogando?"
│   └── add-child
│
└── (app)                ← pai autenticado + criança ativa
    ├── (tabs): index (home), calendar, challenge, friends, settings
    ├── challenge/[date]
    ├── achievements, progression, rewards
    ├── trophy-room, trophy/[id]
    ├── friends/
    │   ├── add, list, blocked, ranking, notifications
    │   └── chat/[friendId]           ← chat 1:1 entre amigos (messages)
    └── parent-area/                  ← PIN-gated
        ├── index, pin, controls, change-password, edit-profile
        ├── child/[id], child/new
        ├── notifications             ← WhatsApp: definições do pai
        └── developers, developer-whatsapp   ← PIN 120380, ferramentas internas
```

### 4.2 Auth Model

Igual ao desenhado originalmente: **pais** autenticam via Supabase Auth (email+password);
**crianças** são rows em `child_profiles`, sem login próprio. `handle_new_user()` (trigger)
cria `parent_profiles` no signup. PIN parental (`verify_parent_pin`, bcrypt) é um segundo gate,
não uma sessão nova.

⚠️ `mailer_autoconfirm: true` está ativo no projeto Supabase (sem SMTP próprio configurado —
ver CLAUDE.md) — qualquer email pode registar-se sem confirmar posse. Reconsiderar antes de
produção com pais desconhecidos.

**Sessão**: JWT do pai persiste via Supabase (`AsyncStorage` internamente); criança ativa via
Zustand `profileStore` + persist AsyncStorage.

### 4.3 Offline Strategy — decisão real, diferente do desenho original ⚠️

**Não existe fila de sync para challenges.** O desenho original (SQLite + fila de sync
offline-first) foi abandonado — ver `docs/adaptive-multiplication-system.md` §3 e
`CLAUDE.md`: "**app online-only** — sem fila de sync offline para sessões de challenge".

Motivo: as questões são geradas **server-side** de forma adaptativa (`start_challenge`),
dependendo de mastery/reteste que só o servidor tem — não é possível gerar localmente para
depois validar, como o desenho original propunha (`ChallengeModule.generateQuestions` client-
side nunca foi implementado).

Comportamento real: `use-network-status` deteta desconexão e mostra um ecrã de erro amigável.
Nada de challenge acontece sem rede. Cache local (AsyncStorage) é usada só para:
`activeChild`, idioma, tema, e completions de calendário já confirmadas pelo servidor.

### 4.4 Security Model

Igual ao original: RLS em todas as tabelas; XP/level/streak/mastery/retest **só** escritos por
Edge Functions (`service_role`); `parent_profiles.pin_hash` nunca devolvido ao cliente; Edge
Functions validam que `child_id` pertence ao pai autenticado. Ver `database-schema.md` para o
detalhe tabela a tabela.

---

## 5. Motor Adaptativo (challenge engine)

Ver `docs/adaptive-multiplication-system.md` (algoritmo base + extensão multi-operação Phase E)
para o detalhe completo. Resumo:

```
start_challenge(child_id, module_id?)
  ├─→ Lê enabled_operations/mix_operations/question_count/timer_auto de child_profiles
  ├─→ Para cada operação ativa: seleciona questões por mastery (buckets WEAK/LEARNING/
  │     REVIEWING/NEW/MASTERED, pesos de adaptive-rules.json) + reserva de reteste
  │     (child_fact_retest, garantida antes da seleção adaptativa)
  ├─→ Combina + reembaralha (seed = session_id) as questões de todas as operações ativas
  ├─→ Persiste em challenge_sessions.questions_payload (total_questions = entregue, não pedido)
  └─→ Devolve payload ao cliente — sem geração local, sem regeneração com seed

complete_challenge(session_id, answers[])
  ├─→ Idempotente (session_id já completada? devolve resultado em cache)
  ├─→ Valida respostas contra questions_payload persistido (não regenera)
  ├─→ Computa XP: 2/resposta correta + 4 bónus de conclusão + 10 bónus perfeito
  │     (CHALLENGE.XP_PER_CORRECT_ANSWER/XP_COMPLETION_BONUS/XP_PERFECT_BONUS —
  │     valores de exibição no cliente; fonte autoritativa é sempre a Edge Function)
  ├─→ Atualiza child_profiles: xp_total, level (LEVEL_THRESHOLDS, 1..100), streak
  ├─→ Upsert calendar_days
  ├─→ Avalia trophies/achievements
  ├─→ Atualiza child_fact_mastery (por questão, com comutatividade) + child_fact_retest
  └─→ Devolve xp_earned, level_up, trophies_earned[], achievements_earned[]
```

**Por que uma única chamada, não por-questão**: evita 20+ round-trips por sessão numa rede
móvel; a Edge Function valida tudo de uma vez contra o payload persistido (não há geração
determinística re-executável no cliente para validar contra — o payload É a fonte de verdade).

### 5.1 XP — valores reais

| Evento | XP |
|---|---|
| Resposta correta | +2 |
| Bónus de conclusão do desafio | +4 |
| Bónus de desafio perfeito (100%) | +10 |

Exemplo: desafio de 20 questões, 100% correto = `2×20 + 4 + 10 = 54 XP` (valor real mostrado
no cartão "Desafio de hoje" do dashboard). Fonte: `src/constants/config.ts` `CHALLENGE`.

### 5.2 Níveis

`LEVEL_THRESHOLDS` em `src/constants/config.ts` (espelhado em `level_thresholds` via
`backend/seeds/level_thresholds.sql`) vai de nível 1 (0 XP) a nível 100 (200.000 XP), tabela
esparsa (nem todo nível tem entrada — o cliente interpola entre o threshold anterior e o
seguinte). Bem mais extenso que o rascunho original (que ia só até nível 20).

---

## 6. Rankings — Realtime está ativo (ao contrário do desenho original) ⚠️

O desenho original dizia explicitamente "Realtime não é necessário para rankings... só pull-to-
refresh". **Isto já não é verdade**: a migration 010 (`friends_realtime_ranking.sql`) ativa
Realtime em `child_profiles` especificamente para detetar "ultrapassagem" no ranking
(`social.service.ts:subscribeToRankingUpdates`, canal `ranking_<childId>`, escuta `UPDATE` em
`xp_total` do próprio filho e dos amigos).

Continua a não haver tabelas pré-computadas (`weekly_rankings`/`monthly_rankings`) — o ranking
em si é sempre query on-demand sobre `child_xp_ledger`/`child_profiles.xp_total`, filtrado a
amigos (não é global). Realtime aqui não substitui a query, só dispara um refetch/toast quando
alguém ultrapassa.

**Realtime está ativo em três canais, não só um**:
1. `friend_requests` — badge de pedidos pendentes (como no desenho original)
2. `child_profiles.xp_total` — deteção de ultrapassagem no ranking (migration 010, **não
   estava no desenho original**)
3. `messages` — chat entre amigos (migration 003, funcionalidade inteira ausente do desenho
   original)

---

## 7. Extensão multi-operação (Phase E)

O motor foi generalizado de "só multiplicação" para 4 operações (multiplicação, adição,
subtração, divisão) sem mudar a arquitetura de seleção — ver §5 acima e
`docs/adaptive-multiplication-system.md`. Cada operação corre o algoritmo de seleção
independentemente (mastery não faz sentido misturado entre operações) e o resultado é
combinado + reembaralhado. `child_profiles.enabled_operations`/`mix_operations` controlam a
oferta por criança.

---

## 8. Integração WhatsApp

Ver `docs/WHATSAPP_INTEGRATION_ROADMAP.md` e a secção "WhatsApp / Notificações" em `CLAUDE.md`
para o desenho completo (Evolution API self-hosted no Railway, Vault, cron horário,
`whatsapp_notification_log` para dedup). Backend + UI completos; falta só o utilizador
emparelhar o QR com o número real dentro da app.

---

## 9. Key Architectural Decisions & Trade-offs (atualizado)

**Supabase sobre backend próprio** — mantido, sem mudanças.

**Expo managed workflow** — mantido, mas com um risco concretizado: **3 tentativas de build
nativo iOS falharam** (jun/2026). A app real corre via Expo Go + EAS Update OTA, não via build
standalone instalado. Nenhum build Android/iOS de produção existe ainda.

**Crianças como rows na DB, não Auth users** — mantido, sem mudanças.

**Submissão em batch no fim do desafio** — mantido, mas a razão mudou: não é mais sobre
funcionar offline (challenges são online-only agora), é sobre reduzir round-trips e permitir
validação server-side contra um payload persistido único.

**Geração de questões server-side, não client-side** ⚠️ — o desenho original assumia geração
determinística client-side validada contra seed no servidor. Isto **nunca foi implementado
assim**: desde a Phase 2.5, a geração é sempre server-side e adaptativa (depende de mastery
por criança, que só existe no servidor). O cliente é puramente um consumidor de
`questions_payload`.

**Realtime além do previsto** — ver §6. Ranking overtake e chat usam Realtime; o desenho
original previa só o badge de pedidos de amizade.

---

## 10. O que esta arquitetura genuinamente NÃO inclui

- Push notifications nativas (`expo-notifications`) — nunca implementado; as "notificações" do
  produto são todas via WhatsApp (Evolution API), não push do sistema.
- Analytics SDK (Amplitude/Mixpanel) — nada implementado.
- CDN para assets — Supabase serve os avatares diretamente.
- Ranking global (todos os jogadores) — só ranking entre amigos.
- Guest mode — nenhum vestígio no código; ver `docs/open-questions.md` OQ-14.
- Testes E2E (Detox), auditoria de acessibilidade, submissão às lojas — Phase 9 do roadmap
  original, nunca iniciada.

---

## 11. Design System

Ver `src/theme/` (colors, typography, spacing, radius, shadows) para os tokens reais — nunca
hardcode valores. 6 avatares (`AVATAR_IDS` em `config.ts`): sofia, lucas, luna, mia, pedro, theo.
Tiers de troféu: bronze/silver/gold/diamond. i18n: pt/en/es/fr via `src/locales/*.json`.
