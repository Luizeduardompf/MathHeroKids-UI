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

### O que está feito (Phase 0 + 1 + 2.5)
- Expo Router + TypeScript strict + design system + i18n + tema
- Supabase client, TanStack Query, Zustand stores (auth + profile com persist)
- Auth completo: login, register, forgot-password, profile-select
- `multiplication_facts` (100 questões, tiers T1–T5) + `child_fact_mastery` (mastery por criança)
- `adaptive-rules.json` versionado + JSON Schema + validação no boot da EF
- `start_challenge` EF: geração adaptativa server-side, persiste `questions_payload`
- `complete_challenge` EF: valida contra payload, atualiza mastery, XP, streak, calendar
- `recompute_mastery` EF: replay idempotente do histórico
- App cliente: consome payload server-side, sem geração local, tela offline, `use-network-status`
- A/B harness: `AB_TEST_ENABLED=true` para testar variantes de `adaptive-rules.json`

### Pendente (Phase 3+)
Consultar `docs/implementation-phases.md` para o roadmap completo.

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

### Challenge (Phase 2.5 — adaptive engine) ⚠️ CRÍTICO
- **Online-only**: sem queue offline para challenge sessions. Se offline, tela de erro amigável.
- Questões geradas **server-side** por `start_challenge` EF de forma adaptativa.
- Payload persistido em `challenge_sessions.questions_payload` — cliente só renderiza.
- Mastery por questão em `child_fact_mastery`: NEW→LEARNING→REVIEWING→MASTERED←→WEAK.
- 20 respostas enviadas em batch via `complete_challenge` no fim da sessão.
- `complete_challenge` valida contra `questions_payload` (não regenera com seed).
- Cache local apenas: completions de calendário, activeChild, idioma, tema.
- A/B harness: `AB_TEST_ENABLED=true` ativa variante v2 das regras para 50% das crianças.
- Docs: `docs/adaptive-multiplication-system.md`, `docs/ab-testing.md`.

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
