# Math Hero Kids — Database Schema

> Reescrito em 2026-08-05 a partir das 19 migrations reais em `backend/migrations/` (001–019).
> Reflete o schema tal como existe hoje — não um plano. Fonte de verdade: os ficheiros de
> migration versionados (nunca o Studio/Management API diretamente — ver CLAUDE.md).

Todas as tabelas vivem em Supabase/PostgreSQL, schema `public`. RLS ativo em todas as tabelas
de dados de utilizador. `auth.users` é gerido pelo Supabase Auth.

---

## Entity Relationship Overview

```
auth.users (Supabase Auth)
    │
    └──< parent_profiles
              │
              ├──< notification_preferences (1:1 — settings WhatsApp/lembrete do pai)
              └──< child_profiles
                        │
                        ├──< challenge_sessions
                        │         └──< challenge_answers
                        ├──< child_xp_ledger
                        ├──< calendar_days
                        ├──< child_trophies
                        ├──< child_achievements
                        ├──< child_level_rewards
                        ├──< child_fact_mastery      (mastery adaptativo, por facto)
                        ├──< child_fact_retest       (reteste persistente cross-challenge)
                        ├──< child_notification_settings (1:1 — settings WhatsApp da criança)
                        ├──< friendships (child ←→ child, bidirecional)
                        ├──< friend_requests
                        └──< messages (chat entre amigos, from_id/to_id)

whatsapp_notification_log  — log de envios (dedup + auditoria), referencia parent_id/child_id
whatsapp_events            — eventos brutos do webhook Evolution API, só service_role
```

Catálogos estáticos (seed, sem escrita da app):
```
level_thresholds
trophies
achievements
level_rewards
arithmetic_facts       (400 questões: multiplicação/adição/subtração/divisão)
multiplication_facts   (DEPRECATED — ver nota abaixo)
app_config             (key/value, editável em runtime via EF update_app_config)
```

---

## Tables

### `parent_profiles`

```sql
create table parent_profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text not null,
  pin_hash            text,                 -- bcrypt; null = PIN não definido
  language            text not null default 'pt' check (language in ('pt','en','es','fr')),
  whatsapp_phone      text,                 -- migration 018
  whatsapp_phone_ddi  text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

**RLS**: `id = auth.uid()` — pai lê/escreve só a própria linha.

**Trigger**: `handle_new_user()` cria a linha automaticamente no `insert` em `auth.users`
(migration 001).

---

### `child_profiles`

```sql
create table child_profiles (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid not null references parent_profiles(id) on delete cascade,
  username            text not null unique,
  display_name        text not null,
  birth_date          date,
  avatar_id           text not null,
  -- Progressão (server-authoritative — só Edge Functions escrevem)
  xp_total            integer not null default 0 check (xp_total >= 0),
  level               integer not null default 1 check (level >= 1),
  current_streak      integer not null default 0 check (current_streak >= 0),
  best_streak         integer not null default 0 check (best_streak >= 0),
  last_challenge_date date,
  -- Definições configuráveis pelo pai
  timer_seconds       integer not null default 15 check (timer_seconds in (10, 15, 20, 30, 0)),
  timer_auto          boolean not null default false,   -- migration 012 — tempo desce por nível
  multiplication_max  integer not null default 10 check (multiplication_max in (10, 12, 15, 20)),
  question_count      smallint not null default 20      -- migration 011; 0 = AUTO
                        check (question_count in (5, 10, 15, 20, 25, 0)),
  enabled_operations  text[] not null default array['multiplication']  -- migration 016
                        check (
                          array_length(enabled_operations, 1) >= 1
                          and enabled_operations <@ array['multiplication','addition','subtraction','division']
                        ),
  mix_operations      boolean not null default false,    -- migration 016
  social_enabled      boolean not null default true,
  timezone            text not null default 'America/Sao_Paulo',  -- migration 007
  expo_push_token     text,                               -- migration 003
  whatsapp_phone      text,                               -- migration 018
  whatsapp_phone_ddi  text not null default '',
  -- Gestão de perfil
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_child_profiles_parent_id on child_profiles (parent_id, is_active, sort_order);
create index idx_child_profiles_username  on child_profiles (username);
```

**Segurança**: as colunas de progressão (`xp_total`, `level`, `current_streak`, `best_streak`,
`last_challenge_date`) só são escritas por `complete_challenge`. `child_fact_mastery` e
`child_fact_retest` seguem a mesma regra (só `service_role`, via Edge Functions).

**RLS**: pai lê/atualiza as próprias crianças (`parent_id = auth.uid()`); ver também a policy
de amigos abaixo (`friendships`/migration 010) que permite a um pai ler `child_profiles` de
um amigo do filho (colunas públicas — nome, avatar, level, xp, streak).

---

### `notification_preferences`

Definições de notificação do **pai**. A tabela nasceu na 001 só com `daily_reminder`/
`reminder_time`/`push_token` (nunca usada por nenhuma UI até à integração WhatsApp); a
migration 018 estendeu-a em vez de criar tabela nova.

```sql
create table notification_preferences (
  id                            uuid primary key default gen_random_uuid(),
  parent_id                     uuid not null unique references parent_profiles(id) on delete cascade,
  daily_reminder                boolean not null default true,   -- também gatilho WhatsApp
  reminder_time                 time not null default '18:00:00',
  push_token                    text,                             -- nunca implementado (push nativo)
  whatsapp_enabled              boolean not null default false,
  unfinished_warning_enabled    boolean not null default true,
  unfinished_warning_time       time not null default '19:00:00',
  completed_notice_enabled      boolean not null default false,
  completed_notice_time         time not null default '20:00:00',
  weekly_summary_enabled        boolean not null default false,
  weekly_summary_weekday        smallint not null default 0 check (weekly_summary_weekday between 0 and 6),
  weekly_summary_time           time not null default '19:00:00',
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
```

**RLS**: pai lê/escreve a própria linha.

---

### `child_notification_settings` (migration 018)

Definições de notificação **por criança** — só 2 tipos, enviados para o número da própria
criança (não do pai).

```sql
create table child_notification_settings (
  child_id                    uuid primary key references child_profiles(id) on delete cascade,
  whatsapp_enabled             boolean not null default false,
  daily_reminder_enabled       boolean not null default false,
  daily_reminder_time          time not null default '16:00:00',
  unfinished_warning_enabled   boolean not null default false,
  unfinished_warning_time      time not null default '19:00:00',
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);
```

**RLS**: pai lê/escreve definições dos próprios filhos; `service_role` lê tudo (cron de envio).

---

### `challenge_sessions`

```sql
create table challenge_sessions (
  id                  uuid primary key,   -- gerado pelo cliente, chave de idempotência
  child_id            uuid not null references child_profiles(id) on delete cascade,
  challenge_date      date not null,
  module_id           text not null default 'multiplication',  -- operação única, ou 'mixed'
  question_seed       text,               -- DEPRECATED (Phase 2.5) — nullable, legacy
  status              text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  total_questions     integer not null default 20,   -- entregue de facto, não o pedido (ver nota)
  correct_count       integer not null default 0,
  xp_awarded          integer not null default 0,
  is_retroactive      boolean not null default false,
  is_perfect          boolean not null default false,
  timer_seconds       integer not null,
  multiplication_max  integer not null,
  questions_payload   jsonb,              -- lista de questões gerada server-side (Phase 2.5+)
  rules_version       integer,            -- A/B harness — ver docs/ab-testing.md
  selection_metadata  jsonb,              -- diagnóstico (buckets usados, shortfall, etc.)
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  unique (child_id, challenge_date, module_id)
);

create index idx_sessions_child_date on challenge_sessions (child_id, challenge_date desc);
```

**Notas**:
- `question_seed` é legacy — sessões desde a Phase 2.5 são geradas server-side e persistidas em
  `questions_payload`; o cliente nunca gera nem regenera localmente.
- `total_questions` grava a quantidade **realmente entregue**, não a pedida — se o pool de
  factos elegíveis esgotar (operação com poucos factos + `question_count` alto + cooldown
  cross-sessão), pode ser menor que `child_profiles.question_count`. Bug corrigido no commit
  `eb1ac22` (antes gravava o valor pedido, o que quebrava `is_perfect` para quem esgotava o pool
  mas acertava tudo o que recebeu). `selection_metadata.shortfall` regista quando isto acontece.
- Regras de desafio retroativo (janela de 7 dias, XP igual, não atualiza streak) continuam a
  aplicar-se — enforced em `start_challenge`.

---

### `challenge_answers`

```sql
create table challenge_answers (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references challenge_sessions(id) on delete cascade,
  block_number      integer not null check (block_number >= 1),
  attempt_number    integer not null default 1,
  question_index    integer not null check (question_index >= 0),
  operand_a         integer not null,
  operand_b         integer not null,
  correct_answer    integer not null,
  child_answer      integer,             -- null = timeout
  is_correct        boolean not null,
  time_taken_ms     integer,
  xp_awarded        integer not null default 0,
  fact_id           text references arithmetic_facts(id),   -- migration 007 (era multiplication_facts), repontado na 013
  response_time_ms  integer
);

create index idx_answers_session on challenge_answers (session_id);
create index idx_answers_child_fact on challenge_answers (fact_id, id) where fact_id is not null;
```

`question_index`/`block_number` deixaram de ter CHECK de limite superior fixo (0–19 / 1–4) desde
a migration 011, para suportar `question_count` configurável (até 25). `UNIQUE(session_id,
question_index)` continua ausente de propósito — permite múltiplas tentativas por retry de bloco,
`xp_awarded` só na primeira correta.

---

### `child_xp_ledger`

```sql
create table child_xp_ledger (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references child_profiles(id) on delete cascade,
  source        text not null check (source in ('correct_answer','challenge_completion','achievement','trophy')),
  amount        integer not null,
  reference_id  uuid,
  created_at    timestamptz not null default now()
);

create index idx_xp_ledger_child_created on child_xp_ledger (child_id, created_at desc);
```

Append-only. Serve também de fonte de dados para o ranking de amigos (ver `architecture.md`).

---

### `calendar_days`

```sql
create table calendar_days (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references child_profiles(id) on delete cascade,
  day_date        date not null,
  state           text not null check (state in ('completed','failed','in_progress')),
  is_perfect      boolean not null default false,
  session_id      uuid references challenge_sessions(id),
  is_retroactive  boolean not null default false,   -- migration 009
  unique (child_id, day_date)
);

create index idx_calendar_child_date on calendar_days (child_id, day_date desc);
```

`is_retroactive` (migration 009) corrige um bug: sem esta coluna o calendário "esquecia" que um
dia tinha sido recuperado assim que a sessão terminava.

---

### Catálogos estáticos: `trophies`, `achievements`, `level_rewards`, `level_thresholds`

```sql
create table trophies (
  id                  uuid primary key default gen_random_uuid(),
  name_key            text not null,           -- unique index (migration 008) — chave natural p/ seeds idempotentes
  description_key     text not null,
  category            text not null check (category in ('daily','weekly','monthly','streak','special')),
  tier                text not null check (tier in ('bronze','silver','gold','diamond')),
  requirement_type    text not null,
  requirement_value   integer not null,
  icon_asset          text not null,
  sort_order          integer not null default 0
);

create table achievements (
  id                uuid primary key default gen_random_uuid(),
  name_key          text not null,             -- unique index (migration 008)
  description_key   text not null,
  category          text not null check (category in ('primeiros_passos','sequencias','habilidades','especiais')),
  condition_type    text not null,
  condition_value   integer,
  icon_asset        text not null,
  sort_order        integer not null default 0
);

create table level_rewards (
  id            uuid primary key default gen_random_uuid(),
  name_key      text not null,                 -- unique index (migration 008)
  reward_type   text not null check (reward_type in ('frame','outfit','medal','trophy_variant','celebration')),
  unlock_level  integer not null,
  icon_asset    text not null,
  sort_order    integer not null default 0
);

create table level_thresholds (
  level         integer primary key,
  xp_required   integer not null,
  name_key      text not null
);
```

⚠️ **Achado (2026-08-05)**: o troféu "Madrugador" existe nas traduções (`src/locales/*.json`)
e é mostrado na Sala de Troféus, mas **não tem nenhuma linha correspondente confirmada no seed**
com `requirement_type` definido — condição de desbloqueio por hora do dia nunca foi
implementada no backend (ver `docs/open-questions.md` OQ-11, ainda aberta).

**RLS**: leitura pública para `authenticated`, sem escrita pelo cliente (só seeds em
`backend/seeds/`).

---

### `child_trophies`, `child_achievements`, `child_level_rewards`

```sql
create table child_trophies (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references child_profiles(id) on delete cascade,
  trophy_id   uuid not null references trophies(id),
  earned_at   timestamptz not null default now(),
  progress    integer not null default 0,
  unique (child_id, trophy_id)
);

create table child_achievements (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references child_profiles(id) on delete cascade,
  achievement_id  uuid not null references achievements(id),
  earned_at       timestamptz not null default now(),
  progress        integer not null default 0,
  unique (child_id, achievement_id)
);

create table child_level_rewards (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references child_profiles(id) on delete cascade,
  reward_id   uuid not null references level_rewards(id),
  unlocked_at timestamptz not null default now(),
  unique (child_id, reward_id)
);
```

---

### `arithmetic_facts` (migration 013 — substitui `multiplication_facts`)

Catálogo estático de **400 questões**: 100 por operação (multiplicação, adição, subtração,
divisão), tiers de dificuldade T1–T5.

```sql
create table arithmetic_facts (
  id              text primary key,   -- ex: 'fact_7x8', 'fact_add_3_9', 'fact_sub_12_4', 'fact_div_56_7'
  operation       text not null check (operation in ('multiplication','addition','subtraction','division')),
  operand_a       smallint not null,
  operand_b       smallint not null,
  answer          smallint not null,
  fact_group_id   text,      -- null = sem par comutativo (subtração/divisão)
  base_difficulty smallint not null check (base_difficulty between 1 and 5),
  created_at      timestamptz not null default now()
);

create index idx_arith_facts_operation on arithmetic_facts (operation);
create index idx_arith_facts_difficulty on arithmetic_facts (operation, base_difficulty);
create index idx_arith_facts_group on arithmetic_facts (fact_group_id) where fact_group_id is not null;
```

- **Multiplicação/adição**: comutativas — `fact_group_id` partilhado entre `a×b`/`b×a` (ou
  `a+b`/`b+a`), transferência de 50% de mastery entre o par (`commutativity.transferFactor`
  em `adaptive-rules.json`).
- **Subtração/divisão**: não comutativas — `fact_group_id` sempre `null`, sem transferência.
  Subtração deriva de adição (`c-a=b` para cada facto `a+b=c`); divisão deriva de multiplicação
  do mesmo modo. Herdam a `base_difficulty` do facto de origem.
- RLS: leitura pública para `authenticated`.

**`multiplication_facts` (DEPRECATED)**: mantida só para rollback seguro (100 rows, só
multiplicação). Não apagada, não usada por nenhuma Edge Function desde a migration 013 — todas
as FKs (`child_fact_mastery.fact_id`, `challenge_answers.fact_id`) apontam para
`arithmetic_facts`. Remover numa migration futura depois de confirmar produção estável.

---

### `child_fact_mastery`

Mastery por criança × facto — estado NEW→LEARNING→REVIEWING→MASTERED←→WEAK. Ver
`docs/adaptive-multiplication-system.md` para o algoritmo completo.

```sql
create table child_fact_mastery (
  child_id                  uuid not null references child_profiles(id) on delete cascade,
  fact_id                   text not null references arithmetic_facts(id),  -- repontado na 013
  state                     text not null default 'NEW' check (state in ('NEW','LEARNING','REVIEWING','MASTERED','WEAK')),
  times_seen                integer not null default 0,
  times_correct             integer not null default 0,
  times_wrong               integer not null default 0,
  distinct_sessions_correct integer not null default 0,
  consecutive_correct       integer not null default 0,
  consecutive_wrong         integer not null default 0,
  last_seen_at              timestamptz,
  last_correct_at           timestamptz,
  last_wrong_at             timestamptz,
  last_correct_local_date   date,     -- timezone da criança (DP-7)
  strength                  real not null default 0 check (strength between 0 and 1),
  next_review_at            timestamptz,
  updated_at                timestamptz not null default now(),
  primary key (child_id, fact_id)
);

create index idx_mastery_state on child_fact_mastery (child_id, state);
create index idx_mastery_next_review on child_fact_mastery (child_id, next_review_at) where next_review_at is not null;
```

**RLS**: pai lê mastery dos próprios filhos; só `service_role` escreve (via `start_challenge`/
`complete_challenge`/`recompute_mastery`).

---

### `child_fact_retest` (migration 017)

Reteste **persistente e cross-challenge** — independente de `child_fact_mastery`/`WEAK`. Um
erro marca o facto (+ par comutativo, se aplicável) para reteste obrigatório em desafios
futuros, até acumular acertos em sessões/dias distintos.

```sql
create table child_fact_retest (
  child_id                uuid not null references child_profiles(id) on delete cascade,
  fact_id                 text not null references arithmetic_facts(id),
  a_retestar              boolean not null default true,
  retest_correct_streak   integer not null default 0,
  retest_wrong_count      integer not null default 0,
  last_correct_local_date date,
  first_flagged_at        timestamptz not null default now(),
  cleared_at              timestamptz,     -- preenchido ao atingir o limiar; linha nunca apagada
  updated_at              timestamptz not null default now(),
  primary key (child_id, fact_id)
);

create index idx_retest_active on child_fact_retest (child_id, first_flagged_at) where a_retestar = true;
```

`start_challenge` reserva `round(question_count × retest_percentage)` vagas para factos
`a_retestar=true` (mais antigos primeiro) **antes** da seleção adaptativa normal — garantia, não
peso probabilístico. Ao atingir `retest_correct_threshold` (config global, ver `app_config`), a
flag limpa. **Achado de QA não corrigido**: a injeção de reteste ignora se o tier do facto está
desbloqueado para a criança — na prática só ocorre via regressão de mastery (`WEAK`), portanto
raro, mas é um gap de design conhecido.

**RLS**: pai lê retestes dos próprios filhos; só `service_role` escreve.

---

### `app_config` (migration 017)

Configuração global key/value, editável em runtime pela tela Developer (`parent-area/developers.tsx`).

```sql
create table app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
```

Seeds: `retest_correct_threshold` (5), `retest_percentage` (0.25). Leitura pública para
`authenticated` (não é dado sensível); escrita só via Edge Function `update_app_config`
(`service_role`), chamada por um pai autenticado atrás do PIN 120380 no cliente.

---

### `friendships`

```sql
create table friendships (
  child_id    uuid not null references child_profiles(id) on delete cascade,
  friend_id   uuid not null references child_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (child_id, friend_id),
  check (child_id <> friend_id)
);

create index idx_friendships_child  on friendships (child_id);
create index idx_friendships_friend on friendships (friend_id);
```

Bidirecional: aceitar um pedido insere duas linhas (`A→B` e `B→A`).

**RLS relevante (migration 010)**: além de "pai lê as próprias amizades", existe
`friend_ids_of()`/`my_child_ids()` (funções `security definer`, evita recursão RLS) que
permitem a um pai ler o `child_profiles` (colunas públicas) de um **amigo** do filho — necessário
para o embed `friendships → friend:friend_id(...)` no ranking.

---

### `friend_requests`

```sql
create table friend_requests (
  id              uuid primary key default gen_random_uuid(),
  from_child_id   uuid not null references child_profiles(id) on delete cascade,
  to_child_id     uuid not null references child_profiles(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  check (from_child_id <> to_child_id)
);

create index idx_friend_requests_to on friend_requests (to_child_id, status);
```

Escrita só via Edge Functions `send_friend_request` / `respond_friend_request` /
`cancel_friend_request` (nunca insert/update direto do cliente).

---

### `messages` (chat entre amigos — migration 003)

⚠️ Não documentado em nenhuma versão anterior deste ficheiro nem em `architecture.md` —
existe e está ativo (`app/(app)/friends/chat/[friendId].tsx`, `src/services/chat.service.ts`).

```sql
create table messages (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references child_profiles(id) on delete cascade,
  to_id       uuid not null references child_profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 500),
  read        boolean not null default false,
  created_at  timestamptz not null default now(),
  check (from_id <> to_id)
);

create index idx_messages_conversation on messages (least(from_id, to_id), greatest(from_id, to_id), created_at desc);
create index idx_messages_to_unread on messages (to_id, read) where read = false;
```

**RLS**: pai lê mensagens onde o próprio filho é remetente OU destinatário; só o pai do
remetente pode inserir; só o pai do destinatário pode marcar como lida (`with check (read = true)`
— a única mutação permitida). **Realtime ativo** (`supabase_realtime` publication).

---

### WhatsApp — `whatsapp_notification_log`, `whatsapp_events`

Ver `docs/WHATSAPP_INTEGRATION_ROADMAP.md` e a secção WhatsApp em `CLAUDE.md` para o desenho
completo (Evolution API self-hosted, Vault, cron horário).

```sql
create table whatsapp_notification_log (
  id                    uuid primary key default gen_random_uuid(),
  parent_id             uuid not null references parent_profiles(id) on delete cascade,
  child_id              uuid references child_profiles(id) on delete cascade,
  target                text not null check (target in ('parent', 'child')),
  notification_type     text not null check (notification_type in ('daily_reminder', 'unfinished_warning', 'completed_notice', 'weekly_summary')),
  recipient_phone       text not null,
  send_date             date not null,
  status                text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  evolution_message_id  text,
  error_detail          text,
  created_at            timestamptz not null default now()
);
-- unique parcial por (parent, child, target, tipo, dia) quando child_id not null,
-- e por (parent, target, tipo, dia) quando child_id is null — dedup de envios.

create table whatsapp_events (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,          -- connection.update, qrcode.updated, messages.upsert, ...
  instance    text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
```

`whatsapp_events`: só `service_role` (nunca exposta ao cliente — o ecrã Developer lê
status/QR sempre via proxy `evolution-dev`, nunca esta tabela diretamente).

**Vault**: segredos da Evolution API (`evolution_api_url`, `evolution_api_key`,
`evolution_instance_name`) vivem em `supabase_vault`, lidos só por `get_evolution_config()`/
`get_vault_secrets()` — funções `security definer` com `execute` restrito a `service_role`
desde a criação (ao contrário do projeto LukaPsi, que teve um leak deste tipo e corrigiu depois).

---

## RPCs / funções auxiliares

| Função | Definida em | Uso |
|---|---|---|
| `handle_new_user()` | 001 | Trigger — cria `parent_profiles` no signup |
| `get_challenge_counts_for_gamification(child_id, date)` | 008 | Contagens semana/mês para trophies em `complete_challenge` |
| `my_child_ids()` / `friend_ids_of(ids)` | 010 | RLS de `child_profiles` — evita recursão 42P17 |
| `get_evolution_config()` / `get_vault_secrets(names)` | 018 | Vault, só `service_role` |

---

## Edge Functions que escrevem nestas tabelas

| Edge Function | Tabelas principais |
|---|---|
| `start_challenge` | `challenge_sessions` (insert/resume), lê `child_fact_mastery`/`child_fact_retest`/`arithmetic_facts` |
| `complete_challenge` | `challenge_sessions`, `challenge_answers`, `child_profiles` (progressão), `child_xp_ledger`, `calendar_days`, `child_trophies`, `child_achievements`, `child_level_rewards`, `child_fact_mastery`, `child_fact_retest` |
| `recompute_mastery` | `child_fact_mastery` (replay idempotente a partir de `challenge_answers`) |
| `verify_parent_pin` | `parent_profiles.pin_hash` |
| `send_friend_request` / `respond_friend_request` / `cancel_friend_request` | `friend_requests`, `friendships` |
| `delete_child` | `child_profiles` + cascade em todas as tabelas relacionadas (irreversível) |
| `update_app_config` | `app_config` |
| `send-whatsapp-notifications` (cron) | `whatsapp_notification_log`, lê `notification_preferences`/`child_notification_settings`/`calendar_days` |
| `evolution-dev` / `evolution-webhook` / `test-whatsapp-message` | `whatsapp_events`, Vault |

---

## Removido / nunca existiu

- **`weekly_rankings` / `monthly_rankings`**: nunca criadas. Ranking é sempre query on-demand
  (ver `architecture.md`).
- **`child_streaks` (tabela de histórico)**: nunca criada. `last_challenge_date` em
  `child_profiles` basta para a lógica de streak.
- **`child_credentials`**: nunca existiu. Crianças não têm login nem password — ver `Auth` em
  `CLAUDE.md`.

## Segurança — resumo

| Risco | Mitigação |
|---|---|
| Manipulação de XP | `xp_total`/`level`/`current_streak`/mastery/retest só escritos por Edge Functions (`service_role`) |
| Replay em `complete_challenge` | `session_id` é chave de idempotência |
| Acesso cross-parent | Todas as policies filtram por `auth.uid() → parent_profiles.id → child_profiles.parent_id` |
| Segredos WhatsApp | Vault + RPCs `security definer` restritas a `service_role` desde o dia 1 |
| Spam de pedidos de amizade | Cooldown de 24h após rejeição, enforced na Edge Function |

## Migration Strategy

Todas as alterações de schema vivem em `backend/migrations/*.sql`, numeradas sequencialmente,
aplicadas via `supabase db push` ou `--use-api` (sem Docker — ver CLAUDE.md). Nunca aplicar SQL
diretamente via Studio/Management API sem versionar o ficheiro — os catálogos de gamificação
foram perdidos assim uma vez (sessão 7, projeto antigo apagado).
