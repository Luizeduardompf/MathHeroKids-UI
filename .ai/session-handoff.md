# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-11 20:44 UTC

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: ab22820
```

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

**A — Aplicar migrations no Supabase Studio (BLOCKER para Phase 2.5 funcionar):**
- `006_multiplication_facts.sql` — catálogo 100 questões
- `007_child_fact_mastery.sql` — mastery table, timezone, colunas legacy

**B — Testar Phase 2.5 end-to-end:**
- Verificar `start_challenge` retorna 20 questões adaptativas
- Verificar `complete_challenge` atualiza `child_fact_mastery`
- Testar tela offline (desligar WiFi antes de abrir o challenge)

**C — Phase 3 — Gamification Core:**
- Level Up Celebration modal (disparar quando `level_up: true` na resposta de `complete_challenge`)
- Trophy/Achievement unlocks ligados ao retorno da EF
- Ver `docs/implementation-phases.md` para detalhes completos

**D — Migrations pendentes (de sessão anterior):**
- Migration 004: INSERT RLS em friend_requests
- Migration 005: last_seen_at em child_profiles

**E — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build Android (gratuito)

**F — Assets:**
- Avatares PNG ainda ~75 KB — ok para MVP
