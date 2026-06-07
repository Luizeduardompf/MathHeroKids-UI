# CLAUDE.md — Math Hero Kids

Instruções para agentes de IA trabalhando neste repositório.
App mobile (iOS + Android) de matemática gamificada para crianças (6–12 anos).
**Sem versão web.**

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
| Offline | AsyncStorage sync queue — NÃO SQLite |
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

### O que está feito (Phase 0 + 1)
- Expo Router + TypeScript strict + design system + i18n + tema
- Supabase client, TanStack Query, Zustand stores (auth + profile com persist)
- `useAuthListener`: sincroniza session Supabase → `authStore`, limpa `activeChild` no signout
- `app/index.tsx`: ponto de decisão de rota inicial (loading → welcome → profile-select → app)
- Guard em `app/(app)/_layout.tsx`: bloqueia acesso sem auth ou sem `activeChild`
- `src/services/auth.service.ts`: signUp, signIn, signOut, resetPassword (com error mapping)
- `src/services/child.service.ts`: listChildren, createChild, updateChild, deactivateChild, isUsernameAvailable
- Todas as telas de auth wired: login, register/parent, register/child, forgot-password
- `profile-select/index.tsx`: carrega filhos reais via TanStack Query, seta `activeChild`
- `backend/`: estrutura scaffolded (functions, migrations, seeds)

### Pendente (Phase 2+)
Consultar `docs/implementation-phases.md` para o roadmap completo.

---

## Regras críticas de arquitetura

### Auth
- **Parents** autenticam via Supabase Auth (email + password)
- **Children** NÃO são usuários Auth — são rows em `child_profiles` vinculadas ao parent
- Fluxo pós-login: parent seleciona filho → `profileStore.setActiveChild()` → navega para `(app)`
- `activeChild` persiste via Zustand persist + AsyncStorage (sobrevive restart)
- PIN parental: bcrypt via Edge Function `verify_parent_pin` — **nunca client-side**

### XP / Gamificação ⚠️ CRÍTICO
- XP, level, streak, trophies, achievements são **SEMPRE mutados por Edge Functions**
- O cliente **NUNCA escreve** diretamente em colunas de progressão de `child_profiles`
- Todos os updates de jogo passam pela Edge Function `complete_challenge`

### Challenge (Phase 2)
- Questões geradas client-side com seed determinístico: `${child_id}:${date}:${module_id}`
- Todas as 20 respostas enviadas em batch no fim da sessão (não por questão)
- Servidor valida regenerando as questões com o mesmo seed
- Checkpoint: salvar no AsyncStorage a cada bloco (4 blocos × 5 questões)
- Offline: payload salvo em AsyncStorage → sincronizado na reconexão

### Serviços vs. Telas
- Telas **não chamam `supabase` diretamente** — usam `src/services/` + TanStack Query
- Mutations: `useMutation` do TanStack Query para loading/error handling consistente
- Server state: TanStack Query. Client state: Zustand

### Rankings (Phase 5+)
- **Não usar tabelas pré-computadas** no MVP — queries indexadas on-demand
- Sem Supabase Realtime para rankings — pull-to-refresh via TanStack Query
- Realtime apenas para: badge de friend requests

### Offline (Phase 8)
- **NÃO usar SQLite** — overengineering para MVP
- Estratégia: AsyncStorage sync queue para challenge sessions pendentes
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

**Migrations**: executar em ordem no Supabase Studio ou via `supabase db push`.
**Edge Functions**: fazer deploy via `supabase functions deploy <nome>`.
**Seeds**: executar manualmente após migrations.

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
