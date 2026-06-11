# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-11 17:10 UTC

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: a797b58
```

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

**A — Aplicar migrations pendentes no Supabase:**
- Migration 004: INSERT RLS em friend_requests
- Migration 005: last_seen_at em child_profiles

**B — Gamification end-to-end:**
- Integrar `start_challenge` + `complete_challenge` EFs no challengeStore / challenge screen
- Level Up Celebration modal (disparar quando `level_up: true` na resposta)
- Trophy/Achievement unlocks ligados ao retorno da EF

**C — Avatar real em sugestões/amigos:**
- `FriendAvatar` usa iniciais; mostrar imagem real quando `avatar_id` disponível

**D — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build Android (gratuito)

**E — Optimização de assets:**
- Redimensionar avatares para ≤200 KB
