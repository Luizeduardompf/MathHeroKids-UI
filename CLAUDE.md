# CLAUDE.md — Math Hero Kids

Instruções para agentes de IA trabalhando neste repositório.
App mobile (iOS + Android) de matemática gamificada para crianças (6–12 anos).
**Sem versão web.**

---

## ⚡ Retomar sessão (lê isto primeiro)

Se estás a começar uma nova sessão, faz isto **em ordem, sem saltar passos**:

### Passo 1 — Pedir todas as permissões (PRIMEIRO, antes de tudo)
```
request_access(
  apps: ["Simulator", "Google Chrome", "Terminal"],
  clipboardRead: true,
  clipboardWrite: true,
  reason: "Trabalho no MathHeroKids: testar no Simulator, Supabase dashboard no Chrome."
)
```

### Passo 2 — Setup do ambiente
```bash
bash /sessions/wonderful-trusting-lamport/mnt/MathHeroKids-UI/.scripts/session-setup.sh
```

### Passo 3 — Ler o handoff
```bash
cat /sessions/wonderful-trusting-lamport/mnt/MathHeroKids-UI/.ai/session-handoff.md
```

Depois lê `.ai/project-mathhero.md` para contexto completo e continua.

**Se "Em curso" no handoff não estiver LIVRE:** há trabalho incompleto da sessão anterior.
Verificar o último commit (`git log --oneline -5`) e os ficheiros modificados (`git status`) para perceber o que ficou a meio.

---

## 📌 Protocolo obrigatório durante o trabalho

**ANTES de iniciar qualquer tarefa de implementação:**
```bash
# Actualizar "Em curso" no handoff + commit imediato
git fix-locks
git add .ai/session-handoff.md && git commit -m "chore: handoff — iniciando [tarefa]" && git push origin main
```

**Durante implementações longas** — commit a cada ficheiro concluído:
```bash
git add -A && git commit -m "wip: [o que foi feito]" && git push origin main
```

**Ao concluir** — marcar como LIVRE + commit final:
```bash
git add -A && git commit -m "feat: [descrição]" && git push origin main
```

Isto garante que se o contexto acabar a meio, o próximo chat sabe exactamente onde parou.

---

## 🚨 Problemas conhecidos do ambiente (sandbox)

### Git HEAD.lock — virtiofs não permite unlink

O virtiofs bloqueia `unlink()` de lock files criados por bash calls anteriores que falharam/expiraram. `rm`, `mv` e `python3 os.remove()` falham todos com "Operation not permitted".

**Workaround quando `git commit` falha com HEAD.lock:**
```bash
# 1. Criar commit object sem tocar no HEAD
TREE=$(git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(git commit-tree "$TREE" -p "$PARENT" -m "<mensagem>")

# 2. Clonar para /tmp (filesystem local, sem locks)
git clone /sessions/<session>/mnt/MathHeroKids-UI /tmp/push_tmp
cd /tmp/push_tmp
git remote set-url origin https://<token>@github.com/Luizeduardompf/MathHeroKids-UI.git
git fetch /sessions/<session>/mnt/MathHeroKids-UI "$COMMIT"
git reset --hard "$COMMIT"
git push origin master:main
```

### Supabase CLI — `.bin/supabase`, sem Docker, dois paths para EFs

- CLI em `.bin/supabase` (não no PATH global). Session-setup.sh faz login + link automaticamente.
- Deploy **sem Docker**: usar `--use-api` sempre.
- EFs devem existir em **dois locais**: `backend/functions/<nome>/` (source of truth) e `supabase/functions/<nome>/` (usado pelo CLI). Criar apenas em `backend/` faz o deploy falhar.

**Workflow para nova Edge Function:**
```bash
# 1. Criar ficheiro em backend/functions/<nome>/index.ts  (source of truth)
# 2. Copiar para supabase/functions/
cp -r backend/functions/<nome> supabase/functions/
# 3. Deploy
.bin/supabase functions deploy <nome> --use-api
# 4. Commitar ambos os paths
git add backend/functions/<nome> supabase/functions/<nome>
```

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| App | React Native + Expo (managed workflow) |
| Linguagem | TypeScript strict |
| Routing | Expo Router (file-based) |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions, Realtime) |
| Server state | TanStack Query (React Query) |
| Client state | Zustand (auth, activeChild, challenge UI) |
| i18n | i18next + expo-localization (pt, en, es, fr) |
| Offline | AsyncStorage apenas para: activeChild, idioma, tema, local completions (calendário). Challenges são online-only (Phase 2.5) |
| Animações | React Native Reanimated 3 |

---

## Estrutura do repositório

```
MathHeroKids-UI/
│
├── app/                        # [FRONTEND] Expo Router — rotas file-based
│   ├── index.tsx               # Ponto de entrada — decide redirecionamento inicial
│   ├── _layout.tsx             # Root layout: fontes, i18n, QueryClient, SafeArea
│   ├── (auth)/                 # Grupo unauthenticated
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── forgot-password.tsx
│   │   └── register/
│   │       ├── parent.tsx      # Passo 1: conta do responsável
│   │       └── child.tsx       # Passo 2: perfil da criança
│   ├── (profile-select)/       # Seleção de filho pós-login
│   │   └── index.tsx
│   └── (app)/                  # Grupo autenticado + filho ativo
│       ├── _layout.tsx         # Guard: redireciona se !authenticated || !activeChild
│       ├── (tabs)/             # Bottom tabs: home, calendar, challenge, friends, settings
│       ├── challenge/[date].tsx
│       ├── trophy-room.tsx
│       ├── trophy/[id].tsx
│       ├── achievements.tsx
│       ├── progression.tsx
│       ├── rewards.tsx
│       ├── friends/
│       └── parent-area/        # PIN-gated
│
├── src/                        # [FRONTEND] Código fonte React Native
│   ├── components/
│   │   ├── layout/             # Screen wrapper
│   │   ├── milo/               # Mascote (MiloMessage)
│   │   └── ui/                 # Design system: Button, Input, Card, Avatar, Badge, Text, ProgressBar
│   ├── constants/
│   │   ├── config.ts           # CHALLENGE, TIMER_OPTIONS, AVATAR_IDS, LEVEL_THRESHOLDS, etc.
│   │   └── env.ts              # requireEnv() — variáveis de ambiente tipadas
│   ├── hooks/
│   │   ├── use-auth.ts         # useAuthListener — sincroniza Supabase session → authStore
│   │   └── use-theme.ts        # useTheme
│   ├── lib/
│   │   ├── supabase.ts         # Singleton Supabase client
│   │   ├── query-client.ts     # TanStack Query client
│   │   └── i18n.ts             # Setup i18next
│   ├── locales/                # Traduções: pt.json, en.json, es.json, fr.json
│   ├── services/               # Abstrações client-side sobre Supabase SDK
│   │   ├── auth.service.ts     # signUp, signIn, signOut, resetPassword
│   │   └── child.service.ts    # listChildren, createChild, updateChild, isUsernameAvailable
│   ├── stores/
│   │   ├── auth.store.ts       # Zustand: status, session, user, parentProfile
│   │   └── profile.store.ts    # Zustand + AsyncStorage persist: activeChild
│   ├── theme/                  # colors, typography, spacing, radius, shadows
│   └── types/
│       ├── database.types.ts   # Tipos das entidades do DB (manual; futuro: supabase gen types)
│       └── index.ts            # Re-exports + tipos de UI
│
├── backend/                    # [BACKEND] Supabase server-side
│   ├── functions/              # Edge Functions (Deno/TypeScript)
│   │   ├── complete_challenge/ # XP, level, streak, trophies, achievements — Phase 2
│   │   ├── start_challenge/    # Cria/retoma challenge_sessions — Phase 2
│   │   ├── verify_parent_pin/  # bcrypt PIN — Phase 7
│   │   ├── send_friend_request/      # Phase 5
│   │   └── respond_friend_request/   # Phase 5
│   ├── migrations/             # SQL migrations (ordem importa)
│   │   ├── 001_initial_schema.sql
│   │   └── 002_rls_policies.sql
│   └── seeds/                  # Dados estáticos
│       └── level_thresholds.sql
│
├── docs/                       # [DOCS] Documentação de produto e técnica
│   ├── MathHeroKids_PRD_v1.1.md
│   ├── architecture.md
│   ├── database-schema.md
│   ├── implementation-phases.md
│   ├── application-flows.md
│   └── open-questions.md
│
├── design/                     # [DESIGN] Mockups, exports, assets de design
│   ├── exports/
│   ├── screenshots/
│   └── images/
│
├── assets/                     # [ASSETS] Assets Expo (imagens, ícones, splash)
│   └── images/
│
├── .ai/                        # [IA] Memória e contexto do agente
│   ├── MEMORY.md               # Índice das memórias
│   ├── project-mathhero.md     # Estado do projeto (fases, arquitetura)
│   ├── user-luiz.md            # Perfil e preferências do utilizador
│   └── feedback-tech-approach.md # Decisões técnicas confirmadas
│
└── CLAUDE.md                   # [IA] Instruções para agentes (este ficheiro)
```

---

## Fase atual de implementação

**Phase 0 (Foundation)** ✅ Completo
**Phase 1 (Auth & Profiles)** ✅ Completo
**Phase 2.5 (Adaptive Multiplication System)** ✅ Completo
**Phase E (Motor de questões multi-operação)** ✅ Completo (sessão 15, 2026-07-17/18)

### O que está feito (Phase 0 + 1 + 2.5 + E)
- Expo Router + TypeScript strict + design system + i18n + tema
- Supabase client, TanStack Query, Zustand stores (auth + profile com persist)
- Auth completo: login, register, forgot-password, profile-select
- `arithmetic_facts` (400 questões: 100×multiplicação/adição/subtração/divisão, tiers T1–T5) +
  `child_fact_mastery` (mastery por criança, por facto — cruza operações)
- `adaptive-rules.json` versionado + JSON Schema + validação no boot da EF
- `start_challenge` EF: geração adaptativa server-side por operação (mastery/tiers não se
  misturam entre operações), combina + reembaralha (seed por sessão — aleatoriedade real,
  cross-session cooldown), persiste `questions_payload`
- `complete_challenge` EF: valida contra payload, atualiza mastery, XP, streak, calendar
- `recompute_mastery` EF: replay idempotente do histórico
- App cliente: consome payload server-side, sem geração local, tela offline, `use-network-status`
- Retest **persistente cross-challenge** (`child_fact_retest`, migration 017): erro num fato
  marca-o (+ par comutativo) para reteste garantido em desafios futuros até acumular acertos
  em sessões distintas — substitui o antigo `retestQueue` de fim-de-sessão (removido)
- `question_count`, `timer_auto` (reduz por nível), `enabled_operations`/`mix_operations` são
  configuráveis por criança via parent-area
- Settings globais do reteste (`retest_correct_threshold`, `retest_percentage`) editáveis em
  runtime na tela `parent-area/developers.tsx` (`app_config` table)
- A/B harness: `AB_TEST_ENABLED=true` para testar variantes de `adaptive-rules.json`

### WhatsApp / Notificações (2026-07-18/19) — completo, falta só emparelhar o QR
Ver `docs/WHATSAPP_INTEGRATION_ROADMAP.md` e secção "WhatsApp / Notificações" em
Regras críticas de arquitetura, mais abaixo. Schema + 4 Edge Functions + cron + infra Railway
(`mathhero-whatsapp`, isolado do LukaPsi) tudo deployado e testado ponta-a-ponta; UI completa
(Notificações do pai, por criança, Developer > Integração WhatsApp). **Falta só**: abrir a app
(Developer > Integração WhatsApp) e escanear o QR com o número real — a instância `mathhero-main`
já existe e está à espera (`status: close`). Não testado por toque na UI (acesso ao Simulator
recusado nesta sessão).

### Pendente (Phase 3+)
Consultar `docs/implementation-phases.md` para o roadmap completo.
⚠️ `docs/database-schema.md` e `docs/adaptive-multiplication-system.md` estão desatualizados
face ao estado actual (multi-operação, ranking realtime, WhatsApp) — tratar numa sessão de
docs dedicada.

---

## Regras críticas de arquitetura

### Auth
- **Parents** autenticam via Supabase Auth (email + password)
- **Children** NÃO são usuários Auth — são rows em `child_profiles` vinculadas ao parent
- Fluxo pós-login: parent seleciona filho → `profileStore.setActiveChild()` → navega para `(app)`
- `activeChild` persiste via Zustand persist + AsyncStorage (sobrevive restart)
- PIN parental: bcrypt via Edge Function `verify_parent_pin` — **nunca client-side**
- ⚠️ **`mailer_autoconfirm: true`** activado no projecto Supabase (2026-07-17) — signup confirma a
  conta na hora, sem email de confirmação. Motivo: sem SMTP próprio configurado, o mailer interno do
  Supabase limita a 2 emails/hora (`rate_limit_email_sent`), o que bloqueava qualquer registo real.
  Trade-off aceite para o MVP: qualquer email pode registar-se sem provar que é dono dele. **Antes de
  ir para produção com pais desconhecidos, reconsiderar** — configurar SMTP próprio (Resend/SendGrid/
  Postmark) e voltar a exigir confirmação (`PATCH /v1/projects/{ref}/config/auth` com
  `mailer_autoconfirm: false`).

### XP / Gamificação ⚠️ CRÍTICO
- XP, level, streak, trophies, achievements são **SEMPRE mutados por Edge Functions**
- O cliente **NUNCA escreve** diretamente em colunas de progressão de `child_profiles`
- Todos os updates de jogo passam pela Edge Function `complete_challenge`

### Challenge (Phase 2.5 + E — adaptive engine multi-operação) ⚠️ CRÍTICO
- **Online-only**: sem queue offline para challenge sessions. Se offline, tela de erro amigável.
- Questões geradas **server-side** por `start_challenge` EF de forma adaptativa, a partir de
  `arithmetic_facts` (coluna `operation`: multiplication/addition/subtraction/division).
- `child_profiles.enabled_operations` (mín. 1) + `mix_operations` decidem de que operações a
  sessão tira questões. Se >1 activada e não mistura, o cliente escolhe uma ao calhas
  (`Math.random()`, sem perguntar à criança) e manda-a como `module_id` do request — a EF
  persiste a escolha no payload da sessão, por isso fica estável ao reabrir o mesmo dia.
- Cada operação é seleccionada **independentemente** (mastery/tiers não fazem sentido
  misturados entre operações) e depois combinadas + reembaralhadas (seed = session_id —
  aleatoriedade real por sessão, resume estável).
- Payload persistido em `challenge_sessions.questions_payload` — cliente só renderiza. Cada
  questão tem `operation` — nunca assumir `×`/multiplicação a renderizar operador ou calcular
  resposta local (usar `computeAnswer`/`OPERATION_SYMBOLS` de `constants/config.ts`).
- Mastery por questão em `child_fact_mastery`: NEW→LEARNING→REVIEWING→MASTERED←→WEAK.
  `fact_group_id` só existe para operações comutativas (multiplicação/adição) — subtração e
  divisão não têm par comutativo.
- `question_count` (0=AUTO) e `timer_auto` (reduz por nível, ver `resolveTimerSeconds`) são
  configuráveis por criança — nunca assumir os valores fixos antigos de `adaptive-rules.json`.
- Respostas enviadas em batch via `complete_challenge` no fim da sessão.
- **Reteste persistente** (`child_fact_retest`, independente de `child_fact_mastery`/`WEAK`):
  erro em qualquer fato → `a_retestar=true` + streak=0 (par comutativo também, se mult/adição).
  `start_challenge` reserva `round(question_count × retest_percentage)` vagas para fatos
  `a_retestar=true` (mais antigos primeiro, até 2x cada) ANTES da seleção adaptativa normal —
  garantia, não peso probabilístico como o `WEAK`. Acerto em sessão/dia distinto avança o
  streak; ao atingir `retest_correct_threshold` (limiar global, `app_config`) a flag limpa
  (`cleared_at` preenchido, linha nunca apagada). Settings editáveis em
  `parent-area/developers.tsx`. Ver `backend/functions/_shared/retest.ts`.
- `complete_challenge` valida contra `questions_payload` (não regenera com seed). `is_perfect`
  compara contra `session.total_questions`, não o valor fixo da regra global.
- Cache local apenas: completions de calendário, activeChild, idioma, tema.
- A/B harness: `AB_TEST_ENABLED=true` ativa variante v2 das regras para 50% das crianças.
- Docs: `docs/adaptive-multiplication-system.md` (desatualizado pós-Fase E, ver nota acima),
  `docs/ab-testing.md`.

### Serviços vs. Telas
- Telas **não chamam `supabase` diretamente** — usam `src/services/` + TanStack Query
- Mutations: `useMutation` do TanStack Query para loading/error handling consistente
- Server state: TanStack Query. Client state: Zustand

### Rankings (Phase 5+)
- **Não usar tabelas pré-computadas** no MVP — queries indexadas on-demand
- Sem Supabase Realtime para rankings — pull-to-refresh via TanStack Query
- Realtime apenas para: badge de friend requests

### Offline
- **NÃO usar SQLite** — overengineering para MVP
- Challenges são **online-only** (Phase 2.5): sem queue de sync para sessões
- AsyncStorage apenas para: completions locais (calendário), activeChild, idioma, tema
- Todas as outras operações exigem conectividade

### WhatsApp / Notificações (Evolution API) ⚠️ CRÍTICO
Ver `docs/WHATSAPP_INTEGRATION_ROADMAP.md` para o desenho completo. Padrão replicado do
LukaPsi (`Luka/Luka`), com hardening de segurança desde o dia 1 (RPCs de Vault já nascem
restritas a `service_role`, ao contrário do LukaPsi que teve de corrigir isto depois).

- **Instância única partilhada**: `mathhero-main`, self-hosted no Railway — projeto
  `mathhero-whatsapp` (id `a0bb1f57-d4ad-4b28-8e01-7f7b7e7ee84a`), **isolado do LukaPsi**
  (`luka-whatsapp`, nunca tocado). Imagem **`evoapicloud/evolution-api:v2.3.7`** — **não**
  `atendai/evolution-api` (namespace descontinuado, deploy falha sem logs no Railway; ver nota
  no roadmap). Motor `WHATSAPP-BAILEYS`, com Postgres dedicado (`DATABASE_ENABLED=true` — a
  v2.x da Evolution API exige Postgres para arrancar, ao contrário da v1.x do LukaPsi; isto
  elimina a limitação de "perde sessão em restart" que o LukaPsi tem). URL:
  `https://evolution-api-production-1246.up.railway.app`.
- **Segredos nunca no cliente nem em env var das Edge Functions** — vivem no Supabase Vault
  (`evolution_api_url`, `evolution_api_key`, `evolution_instance_name`), lidos só por
  `get_evolution_config()`/`get_vault_secrets()` (RPCs `SECURITY DEFINER`, `EXECUTE` restrito
  a `service_role`). O cliente fala sempre através do proxy `evolution-dev` — nunca chama a
  Evolution API diretamente.
- **Schema**: `parent_profiles.whatsapp_phone`/`whatsapp_phone_ddi` (pai),
  `child_profiles.whatsapp_phone`/`whatsapp_phone_ddi` (criança, opcional). Definições do pai
  em `notification_preferences` (extensão da tabela original da 001 — `daily_reminder`/
  `reminder_time` já eram o tipo "lembrete diário", agora também gatilho WhatsApp; +
  `unfinished_warning_*`, `completed_notice_*`, `weekly_summary_*`). Definições da criança em
  `child_notification_settings` (só 2 tipos: `daily_reminder`, `unfinished_warning`).
  `whatsapp_notification_log` faz dedup (1 envio por tipo/dia/destinatário) e auditoria.
  `whatsapp_events` guarda o log bruto do webhook — só `service_role` lê.
- **Cron horário** (`pg_cron`, job `whatsapp-notifications-hourly`) invoca
  `send-whatsapp-notifications`, que varre as definições e decide enviar consultando
  `calendar_days` no momento do trigger (não outbox event-driven — mais simples, notificações
  não precisam da garantia de entrega que XP/gamificação precisa). `daily_reminder`/
  `unfinished_warning` disparam se o dia **ainda não** está `completed`; `completed_notice` só
  se **já** está. Só a **hora** da coluna `time` importa (cron corre 1×/hora, minutos ignorados
  — ver `NOTIFICATION_HOURS` em `constants/config.ts`, os pickers da UI só oferecem horas).
- **Edge Functions**: `evolution-dev` (proxy status/QR/reset, JWT do pai), `evolution-webhook`
  (público, `verify_jwt=false`, log de eventos + reconciliação de entrega falhada — a Evolution
  API responde 2xx ao aceitar a mensagem, não quando é entregue; erro real chega depois via
  `messages.update`), `send-whatsapp-notifications` (cron, service_role),
  `test-whatsapp-message` (envio manual, ecrã Developer).
- **UI**: Definições > Notificações (pai, 4 tipos) em `app/(app)/parent-area/notifications.tsx`;
  campo WhatsApp do pai em `edit-profile.tsx`; campo WhatsApp + 2 tipos por criança em
  `child/[id].tsx`; Developer (PIN 120380, `developers.tsx`, **pré-existente** — não confundir
  com uma área nova) > Integração WhatsApp (`developer-whatsapp.tsx`) — QR, status, reset, teste.

---

## Convenções de código

- TypeScript strict. Sem `any`. Sem `!` desnecessário.
- Imports com alias `@/` (configurado no tsconfig e babel)
- Componentes de UI: importar de `@/components/ui` (barrel export)
- Tema: tokens de `@/theme` — nunca valores hardcoded
- i18n: strings visíveis ao usuário via `useTranslation()` + chaves em `src/locales/`
- Estilos: `StyleSheet.create()` no final do arquivo; inline só para overrides dinâmicos
- Nomes: telas `NomeScreen`, hooks `useNome`, services `nome.service.ts`

---

## Comandos

```bash
npm start          # Expo dev server (iOS/Android)
npm run type-check # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier
```

---

## Versionamento

Após qualquer alteração de código, antes de commitar:

```bash
bash scripts/bump-version.sh
```

Incrementa o patch de `APP_VERSION` em `src/constants/version.ts`. Esta versão é mostrada no fim
do ecrã de início (Math Hero Kids v0.1.x) para identificar facilmente qual build está em cada
dispositivo.

---

## Variáveis de ambiente

Copiar `.env.example` → `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_ENV=development
```

---

## Backend

### Conta Supabase ⚠️

O Supabase deste projecto está na conta **`luizeduardompf2@gmail.com`** — org `LuizEduardoMPF2`,
projecto `MathHeroKids`, ref `pelhtuspcofmejzqtibx`, região `eu-west-1`.

**Não é a mesma conta do outro projecto do user (Luka)**, que vive em `luizeduardompf.lixo@gmail.com`.
O CLI guarda **um só token global** — se `supabase projects list` mostrar os projectos do Luka
(`luka-psi`, `luka-psi-dev-localfirst`), ou se aparecer 403 "account does not have the necessary
privileges", é o token errado, não um projecto em falta. Trocar com `supabase login` (interactivo:
correr no Terminal, é o user que autoriza no browser).

Usar o `supabase` do Homebrew. O `.bin/supabase` do repo é um ELF Linux do sandbox antigo e não
corre no Mac (`exec format error`).

⚠️ O projecto anterior (ref `lrwlmxyafvmxqyfpawzg`) foi **apagado** em Jul 2026 — ver
`.ai/session-handoff.md`.

### Workflow

**Migrations**: executar em ordem no Supabase Studio ou via `supabase db push`.
**Edge Functions**: fazer deploy via `supabase functions deploy <nome>`.
**Seeds**: executar manualmente após migrations.

⚠️ **Nunca aplicar SQL directamente via Studio/Management API sem versionar o ficheiro em `backend/`.**
Os catálogos de gamificação foram aplicados assim na sessão 7, nunca chegaram ao repo, e perderam-se
com o projecto antigo.

Tabelas principais — schema completo em `docs/database-schema.md`:
- `parent_profiles` — criada por DB trigger no signup (ver migration 001)
- `child_profiles` — CRUD pelo app; progressão só por Edge Functions
- `challenge_sessions` + `challenge_answers` — escritas por `complete_challenge` EF
- `child_xp_ledger` — append-only, escrita por Edge Functions
- `calendar_days` — upsertada por `complete_challenge` EF
- Catálogos estáticos: `trophies`, `achievements`, `level_rewards`, `level_thresholds`

---

## Docs de referência

- `docs/MathHeroKids_PRD_v1.1.md` — requisitos de produto
- `docs/architecture.md` — decisões arquiteturais + trade-offs
- `docs/database-schema.md` — schema PostgreSQL completo
- `docs/implementation-phases.md` — roadmap com entregáveis por fase
- `docs/application-flows.md` — fluxos de navegação
- `docs/open-questions.md` — questões abertas pendentes de decisão
