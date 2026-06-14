# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-14 (sessão 9)

### 🟢 Em curso
```
ESTADO: A MEIO — EAS Update setup (falta correr `eas update --branch main`)
ÚLTIMO COMMIT: d3e2d66 (via GitHub API)
```

---

### ✅ Concluído (sessão 9 — 2026-06-14) — EAS Update setup para Expo Go

**Objetivo:** publicar app no Expo Go via EAS Update (sem Apple Developer, sem build nativo)

**`package.json`:**
- Removido `expo-av` (incompatível com SDK 56 — crashava build nativo com `EXAV.h: EXEventEmitter.h not found`; não era usado no código, sons comentados)
- Removido `@react-native-community/netinfo` (não incluído no Expo Go runtime)
- Adicionado `expo-network` (primeiro-party Expo, incluído no Expo Go)

**`src/hooks/use-network-status.ts`:**
- Reescrito para usar `expo-network` em vez de `@react-native-community/netinfo`
- `useNetworkStatus`: usa `Network.getNetworkStateAsync()` + polling a cada 5s (expo-network não tem addEventListener)
- `checkNetworkOnce`: idem, one-shot

**`app.json`:**
- `extra.eas.projectId`: `"FILL_AFTER_EAS_INIT"` → `"c9e1ab66-bab6-4dbd-bdb7-990087d1f209"`
- Adicionado `updates.url`: `"https://u.expo.dev/c9e1ab66-bab6-4dbd-bdb7-990087d1f209"`
- Adicionado `runtimeVersion.policy`: `"appVersion"`

**`eas.json`:**
- Removido campo `"update"` inválido (causava `eas.json is not valid`)

**`npm install --legacy-peer-deps` + `npx expo install expo-network`** — concluídos sem erros

**`npx eas init`** — projeto já linkado, confirmado: ID `c9e1ab66-bab6-4dbd-bdb7-990087d1f209`

**⏳ Pendente:** correr `eas update --branch main --message "initial release"` para publicar o bundle

---

### ✅ Concluído (sessão 8 — 2026-06-12, cont.) — UI fixes

**`src/components/challenge/StatusScreens.tsx`:**
- Layout corrigido: `MiloBubble` movida para dentro do `EntranceView` (body `flex:1 justify:center`) nas 3 telas — eliminado gap vazio enorme entre subtitle e bubble
- `sc.title`: `fontFamily.bold` → `fontFamily.extraBold` + `lineHeight: 36` — corrige clipping do "T" renderizando como "I ime's up!"

**`app/(app)/challenge/[date].tsx` — fix React warning:**
- `useTimer`: `onExpireRef.current()` estava dentro do updater `setRemaining((prev) => ...)` → violação de pureza → "Cannot update a component while rendering"
- Fix: updater puro (só decrementa); `onExpire` disparado em `useEffect` separado com `firedRef` para evitar disparos duplos

**`src/locales/en.json` — chaves em falta:**
- Adicionado `challenge.timeout.miloMessage`, `challenge.wrong.miloMessage`, `challenge.wrong.continueAnyway`, `challenge.blockIncomplete.miloMessage` — sem estas o i18next fazia fallback para pt.json (texto em português na UI inglesa)

**`app/(app)/parent-area/child/[id].tsx`:**
- Removido `MiloMessage` da tela de edição do perfil da criança
- Card de stats movido para o fundo da tela como texto discreto (`statsFooter`) — ícone 13px + texto `colors.text.tertiary`, sem card/shadow

---

### ✅ Concluído (sessão 8 — 2026-06-12) — Bugs + UI polish

**Fix crítico — start_challenge EF (unique constraint ao retry):**
- EF falhava com 500 quando já existia row em `challenge_sessions` com `questions_payload = null` (sessão órfã de tentativa anterior)
- Idempotência corrigida: busca por `(child_id, challenge_date, module_id)` antes do upsert; reutiliza `id` da sessão órfã se encontrada; retorna direto se payload já existe
- `effectiveSessionId` usado em todo o upsert e response; EF re-deployada e testada

**Fix — botão "Try again" ia para tela de complete vazia:**
- `onPress` chamava `setPhase('completed')` em vez de re-iniciar (bug copy-paste)
- Fix: `storeActions.reset()` → volta a `phase: 'idle'`; `phase` adicionado às deps do `useEffect` de `init`

**UI — headers Desafios e Amigos idênticos ao Settings:**
- `challenge.tsx`: adicionado `LinearGradient`, padding/gap/fontes alinhados
- `friends.tsx`: `gap: space.xs` no View interno, padding alinhado
- Ambos: `paddingHorizontal: space.md`, `paddingTop: space.sm`, `paddingBottom: space.lg`, `gap: space.xs`

**UI — Settings: botão editar pai removido + ChildrenInfoCard:**
- `TouchableOpacity create-outline` removido do `ParentCard` — edição só na Área dos Pais
- Novo `ChildrenInfoCard`: avatar + nome + idade + XP + Nível + "Desde / Acesso" (apenas informativo)

**UI — Settings: logout movido para dentro do ScrollView:**
- Saiu da barra fixa acima da tab bar; agora é último item da lista
- Borda sutil `#FECACA` adicionada para mais definição visual

**Nota git:** virtiofs locks → usada GitHub Contents API para commits de `challenge.tsx`, `friends.tsx`, `settings.tsx`.

---

### ✅ Concluído (sessão 8 — 2026-06-12) — Animação de conclusão de desafio

**Novos componentes:**
- `src/components/challenge/CompletedScreen.tsx`: substitui o `MilestoneScreen variant="completed"`. Fundo LinearGradient dourado, 8 elementos com stagger spring/fade (XP badge, Milo, título, subtítulo, progress, barra animada 0%→pct%, botão), float loop do Milo (±12px). 72 peças de confetti.
- `src/components/challenge/CelebrationTransition.tsx`: tela full-screen de 3s que corre entre "Continuar" e o submit. Background flash que escala, 12 raios de sol em rotação, burst ring, trophy card (scale 0→1.3→1 + rotate -180°→0° + wobble), 4 sparkles pulsantes, título/subtítulo spring in, 120 peças de confetti. Auto-avança após 3s.

**Alterações em `app/(app)/challenge/[date].tsx`:**
- Imports dos dois novos componentes
- Estado `showCelebration: boolean`
- Bloco `completed/submitting` agora usa `CompletedScreen` (Continuar → `setShowCelebration(true)`)
- Novo bloco `showCelebration` renderiza `CelebrationTransition` (onComplete → `handleComplete()`)
- Fluxo: `CompletedScreen` → (Continuar) → `CelebrationTransition` 3s → `handleComplete` → LevelUp/TrophyModals → navigate

**Config de teste (`src/constants/config.ts`):**
- `TOTAL_QUESTIONS: 5` (era 20) — marcado com `// DEV`
- `BLOCKS_PER_SESSION: 1` (era 4) — marcado com `// DEV`
- `DEFAULT_QUESTION_COUNT: 5` (era 20) — marcado com `// DEV`
- ⚠️ REVERTER para 20/4/20 antes de produção

**Padrão de imports Reanimated confirmado:**
- `withRepeat` e `withSequence` precisam do mesmo `@ts-expect-error` + import separado que `withDelay` e `Easing`
- `StyleSheet.absoluteFill`/`absoluteFillObject` não existem nesta versão do RN — usar spread manual `{ position:'absolute', top:0, left:0, right:0, bottom:0 }`
- `useAnimatedStyle` retorna tipo incompatível com `StyleProp<ViewStyle>` — cast `as any` no valor, não inline em JSX

---

### ✅ Concluído (sessão 7 — 2026-06-11) — Phase 3 completa

**Migrations aplicadas (Supabase Management API):**
- Migration 004: INSERT RLS em friend_requests
- Migration 005: last_seen_at em child_profiles
- Migration 006: multiplication_facts (100 questões, tiers T1–T5)
- Migration 007: child_fact_mastery + colunas Phase 2.5 em challenge_sessions/answers
  (bug fix: RLS usava user_id que não existia — corrigido para parent_id = auth.uid())

**Seed no DB:**
- 15 trophies (daily/weekly/monthly/streak/special, tiers bronze→diamond)
- 13 achievements (primeiros_passos/sequencias/habilidades/especiais)
- 7 level_rewards (frames, outfits, medals nos níveis 2,5,8,10,12,15,20)
- RPC: get_challenge_counts_for_gamification (week/month counts para EF)

**complete_challenge EF (Phase 3 — deployed):**
- computeLevel: agora usa level_thresholds do DB (não fallback hardcoded)
- Avaliação completa de trophies por requirement_type (challenges_completed, challenges_in_week, challenges_in_month, current_streak, perfect_challenges)
- Avaliação completa de achievements por condition_type (challenges_total, perfect_challenges, streak_days, facts_mastered, level_reached)
- Ambos one-time safe (upsert com onConflict)

**Frontend Phase 3:**
- LevelUpModal: animações spring/bounce (react-native-reanimated), reward desbloqueada
- TrophyEarnedModal: fila N itens, avança um a um com animação
- challenge/[date].tsx: Level Up → Trophies/Achievements → navigate home (sequencial)
- trophy-room.tsx: dados reais TanStack Query (era mock estático)
- trophy/[id].tsx: screen completa com progresso (era placeholder 7 linhas)
- achievements.tsx: dados reais TanStack Query (era mock estático)
- rewards.tsx: level rewards com estado unlocked (era placeholder 8 linhas)
- gamification.service.ts: fetchTrophiesWithState, fetchAchievementsWithState, fetchLevelRewards, fetchLevelThresholds

**i18n:**
- 15 trophy keys (trophies.daily1.*...trophies.perfect30.*) × 4 locales
- 13 achievement keys (achievements.firstChallenge.*...achievements.level10.*) × 4 locales
- 7 reward keys (rewards.frame_star.name...rewards.frame_rainbow.name) × 4 locales

---

### ✅ Concluído (sessão 6 — 2026-06-11) — Phase 2.5 completa

**Tag git:**
- `v1.1-phase1-complete` criada e publicada no remote

**Sprint 2.5.1 — `backend/migrations/006_multiplication_facts.sql`:**
- Catálogo estático de 100 questões (1×1 .. 10×10), tiers T1–T5
- Distribuição validada: T1=19, T2=47, T3=14, T4=11, T5=9
- RLS: leitura pública para autenticados

**Sprint 2.5.2 — `backend/migrations/007_child_fact_mastery.sql`:**
- `child_fact_mastery`: mastery por (child_id, fact_id), estados NEW/LEARNING/REVIEWING/MASTERED/WEAK
- `child_profiles.timezone` adicionado (default 'America/Sao_Paulo')
- `challenge_sessions`: colunas `questions_payload`, `rules_version`, `selection_metadata`; `question_seed` tornado nullable (deprecated)
- `challenge_answers`: colunas `fact_id`, `response_time_ms`

**Sprint 2.5.3 — Config JSON + Schema + Loader:**
- `backend/config/adaptive-rules.json`: regras versionadas com pesos, thresholds, anti-repeat, progressão por tier
- `backend/config/adaptive-rules.schema.json`: JSON Schema 2020-12 — validado com ajv
- `backend/functions/_shared/adaptive-rules.ts`: loader com validação de invariantes no boot (soma pesos = 1.0)

**Sprint 2.5.4 — Refactor `start_challenge`:**
- Geração server-side via `selectQuestions()` em `_shared/question-selector.ts`
- Payload de 20 questões persistido em `questions_payload`; retornado ao cliente
- Cooldown cross-sessão (últimas 2 sessões excluídas), progressão de tiers, interleave por dificuldade
- `question_seed` = null para novas sessões (legacy deprecated)

**Sprint 2.5.5 — Refactor `complete_challenge`:**
- Valida respostas contra `questions_payload` armazenado (não regenera seed)
- `_shared/mastery.ts`: `updateMastery`, `computeStrength` (HLR decay), `nextState`, `applyCommutativity`
- Preserva toda a lógica de XP/streak/calendar_days/trophies/level_rewards do v1
- Sessões legacy sem payload retornam 409 `LEGACY_SESSION_UNSUPPORTED`

**Sprint 2.5.6 — App cliente:**
- `challenge.service.ts`: nova API sem seed, sem offline queue, `startChallenge` retorna `ChallengeStartResponse`
- `challenge/[date].tsx`: consome `questions_payload` server-side, remove PRNG local
- `src/hooks/use-network-status.ts`: hook + `checkNetworkOnce()`
- `Question.fact_id?: string` adicionado; `AnswerDraft.fact_id?` + `position?` propagados no `submitAnswer`
- `ChallengeQuestion`, `ChallengeStartResponse` em `src/types/index.ts`
- i18n: `offlineTitle` + `offlineMsg` em pt/en/es/fr
- `@react-native-community/netinfo` instalado
- `supabase/config/`: criado para resolver imports relativos do CLI de deploy
- EFs `start_challenge` + `complete_challenge` deployadas com sucesso

**Sprint 2.5.7 — `recompute_mastery` EF:**
- Replay idempotente do histórico de `challenge_answers` em ordem cronológica
- Protegida por `X-Admin-Token` ou `service_role`
- Deployada em produção

**Sprint 2.5.8 — A/B harness:**
- `adaptive-rules-v2.json`: variante experimental (4 sessões para REVIEWING, WEAK weight 35%)
- `getRulesForChild(childId)`: atribuição estável 50/50 por hash(child_id) % 2
- Controlado por `AB_TEST_ENABLED=true` env var na EF
- `docs/ab-testing.md`: workflow completo, queries de análise SQL
- EFs re-deployadas com v1+v2

**Docs + CLAUDE.md:**
- `docs/implementation-phases.md`: Phase 2.5 inserida com tabela de sprints
- `CLAUDE.md`: seção Challenge atualizada (server-side, online-only, mastery), Fase atual atualizada, Offline atualizado

---

### ✅ Concluído (sessão 5 — 2026-06-11)

**i18n — auditoria completa de textos hardcoded PT:**
- `PlaceholderScreen.tsx`: 'Voltar' → t('common.back'), 'Em breve' → t('common.comingSoon')
- `+not-found.tsx`: 'Página não encontrada' + 'Voltar ao início' → t()
- `trophy-room.tsx`: title, miloMessage, 'PRÓXIMO TROFÉU', CATEGORY_LABELS → t()
- `trophy/[id].tsx`, `controls.tsx`, `rewards.tsx`, `parent-area/child/new.tsx` → t() nos títulos dos placeholders
- `pin.tsx`: 'Controle dos pais', 'Área dos pais', 'Digite o PIN', 'Esqueci o PIN' → t()
- `edit-profile.tsx`: todos os labels, placeholders, erros, alerts → t()
- `change-password.tsx`: erros de validação, labels, botões → t()
- `add-child.tsx` (profile-select): title, miloMessage, botão → t()
- `forgot-password.tsx`: mensagem de sucesso → t()
- `friends/chat`: 'Amigo' + 'Começa a conversa!' → t()
- `friends/add`: 'Sem sugestões' + 'Busca por username' → t()
- `home/index.tsx`: '+150 XP' badge → t('home.challenge.xpReward')
- Novas chaves adicionadas em pt/en/es/fr: 30+ chaves novas

---
### ✅ Concluído (sessão 4 — 2026-06-11)

**Fix complete_challenge EF — unique constraint collision:**
- EF falhava com 500 quando já existia uma session para (child_id, challenge_date, module_id) com UUID diferente
- Fix: verificar por (child_id, date, module_id) ANTES de upsert por id; usar effectiveSessionId em todos os inserts
- Deployed: complete_challenge v6

**Fix send_friend_request EF:**
- EF selecionava `expo_push_token` na query principal → 500 se migration 003 não aplicada
- Fix: expo_push_token em query separada, não bloqueia o pedido de amizade
- Deployed: send_friend_request v3
- Migration 004 criada: INSERT RLS policy para friend_requests (fallback client-side)

**i18n — datas hardcoded:**
- `calendar.tsx`: MONTH_NAMES_PT e DOW_LABELS → `t('calendar.months/weekdays', {returnObjects})`
- `calendar.tsx`: monthProgressMsg → chaves i18n; `toLocaleString('pt-BR')` → locale-neutral
- `challenge.tsx`: `formatDate` usa `i18n.language` (LANG_TO_LOCALE map)
- `friends/chat`: `toLocaleDateString('pt-PT')` → locale-aware
- `friends/list`: placeholder via `t('friends.searchPlaceholder')`
- Locales: adicionados `calendar.months`, `calendar.weekdays`, `challenge.errorSubmitMsg/Retry`, `parentArea.title/subtitle/accessBtn`

**PIN keypad — números distorcidos iOS 26:**
- `settings.tsx` pinStyles.keyText: adicionado `lineHeight: 34` (mesmo que challenge keypad)
- `parent-area/pin.tsx` kp.keyText: adicionado `lineHeight: 34` + `fontVariant: ['tabular-nums']`

**Challenge phase='error' UI:**
- Antes: `phase='error'` caia no render do gameplay → "Question 6 of 5"
- Agora: tela dedicada com ícone, mensagem i18n, botão retry e botão sair

**Settings — restructure PIN flow:**
- Antes: settings abria com PIN gate bloqueante (full-screen)
- Agora: settings abre diretamente; PIN gate apenas ao tocar em "Área dos pais"
- `PinGate` aceita `onCancel` prop → back button no header (chevron circle)
- Sign out: barra fixa acima da tab bar (fora do ScrollView), tint vermelho #FEF2F2, modal confirmação
- `SettingsHeader` aceita `onBack` prop opcional

**last_seen_at + created_at no perfil da criança:**
- Migration 005: `last_seen_at timestamptz` em `child_profiles` + índice
- `childService.updateLastSeen()`: fire-and-forget, non-throwing
- Chamado ao selecionar filho (profile-select) e ao abrir a app (_layout.tsx, throttle 30 min)
- Card de stats em `parent-area/child/[id].tsx`: "Membro desde" + "Último acesso"
- Locales: `parentArea.child.registeredSince` + `lastAccess` (pt/en/es/fr)

**Header consistency — auditoria completa:**
- `parent-area/index.tsx`: SafeAreaView solid → LinearGradient + chevron-back + "Math Hero Kids" subtitle
- `parent-area/child/[id].tsx`: mesmo fix
- `friends/add.tsx`: adicionado headerCenter + headerSub "Math Hero Kids"
- `friends/ranking.tsx`: mesmo
- `friends/notifications.tsx`: mesmo + título "Notificações" → `t('friends.viewNotifications')`
- `friends/blocked.tsx`: mesmo + "Bloqueados" → `t('friends.blockedUsers')` + `useTranslation` adicionado
- Padrão universal: LinearGradient [primary→primaryDark], "Math Hero Kids" small subtitle, title extraBold white, chevron-back em circle button

---

### ✅ Concluído (sessão 3 — 2026-06-11)

**Fix crítico — Edge Functions (corsHeaders inline):**
- Re-deploy de todas as 5 EFs com corsHeaders inlined (Management API não resolve imports relativos)

**Fix fonte iOS 26 (Nunito ExtraBold stylistic alternates):**
- `Text.tsx`: `fontVariant: ['tabular-nums']` + `allowFontScaling={false}` globais
- challenge/[date].tsx e StatusScreens.tsx: fontVariant em todos os elementos numéricos

**Calendar — dias passados tappáveis, i18n, PIN keypad fixes**

**i18n global — 10 ficheiros corrigidos na sessão anterior**

---

### ⚠️ Issues conhecidos

- `expo-av` incompatível com SDK — sons comentados com TODO
- **Migrations pendentes (Supabase Studio):**
  - Migration 004: `backend/migrations/004_friend_requests_insert_rls.sql`
  - Migration 005: `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;` + índice
- **Push em device real:** `npm install expo-notifications expo-device` (Mac Terminal) + EAS build
- **Push iOS (APNs):** requer Apple Developer Program ($99/ano)
- **Block list:** AsyncStorage MVP — migrar para tabela `blocked_users` (Phase 5+)
- Git locks virtiofs: `mv` nunca `rm`
- Avatares PNG ~1.2 MB — optimizar para ≤200 KB antes de produção
- `friends/list.tsx`: "Nível X" nos sub-labels ainda hardcoded

---

### ⏭️ Próximos passos (por prioridade)

**A — Testar Phase 2.5 + Phase 3 end-to-end no Simulator:**
- Completar um challenge → verificar que `complete_challenge` atualiza mastery
- Verificar Level Up modal se XP suficiente
- Verificar TrophyEarnedModal (firstChallenge achievement deve disparar)
- Testar trophy-room, achievements, rewards screens com dados reais
- Testar tela offline (desligar WiFi)

**B — Phase 4 — Calendar:**
- Calendar screen com estados reais (completed, failed, in_progress, perfect)
- Retroactive challenge flow
- Ver `docs/implementation-phases.md`

**C — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build Android (gratuito)

**D — Issues conhecidos:**
- `expo-av` incompatível com SDK — sons comentados com TODO
- `friends/list.tsx`: "Nível X" nos sub-labels ainda hardcoded
- Git locks virtiofs: usar `/tmp` clone para commits (ver workaround em CLAUDE.md)
