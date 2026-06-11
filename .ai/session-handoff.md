# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-11 12:06 UTC

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: dc74fd5
```

---

### ✅ Concluído (sessão 2 — 2026-06-11)

**Deploy todas as Edge Functions (Supabase ACTIVE):**
- `send_friend_request` v1: valida, insere friend_request, envia push via Expo Push API
- `respond_friend_request` v1: aceita/rejeita, friendships bidirecionais, push ao remetente
- `verify_parent_pin` v1: bcrypt completo (verify/set/change/clear) + rate limiting 5 tentativas/30 min
- `start_challenge` v4 + `complete_challenge` v3: updated no Supabase

**Migration 003 — aplicada no DB remoto:**
- Tabela `messages` (chat) com RLS + índices de conversação + unread
- `child_profiles.expo_push_token TEXT`
- Realtime habilitado na tabela `messages` via `supabase_realtime` publication

**Push notifications (`src/services/notification.service.ts`):**
- Registo de token Expo ao selecionar filho (`registerPushToken` em `(app)/_layout.tsx`)
- Graceful fallback: não crasha se `expo-notifications` não instalado (try/require)
- `eas.json` criado (development/preview/production profiles)
- `app.json` actualizado: expo-notifications plugin + iOS background modes + Android FCM config
- Script `.scripts/setup-push-notifications.sh` para activar em device real (Mac Terminal)

**Chat entre amigos (Supabase Realtime):**
- `src/services/chat.service.ts`: getConversation, sendMessage, markRead, unreadCount, subscribeToConversation, subscribeToUnread
- `app/(app)/friends/chat/[friendId].tsx`: bolhas, input, live updates, date separators, empty state
- `app/(app)/friends/list.tsx`: botão 💬 por amigo + badge de mensagens não lidas
- `app/(app)/_layout.tsx`: Stack screens para chat e sub-rotas de friends

---

### ✅ Concluído (sessão 1 — 2026-06-11)

**Skill `context-checkpoint`:** monitoriza contexto, salva handoff, commit git, empacotada como `.skill`

**R1 — Tab label + challenge header:** `tabLabelAccent` marginTop 18, header X borderRadius 12

**R2 — Friends screen:** Global ranking filtra só amigos; header com bell + person-add

**R3 — Avatar picker:** double ring azul + checkmark badge

**R4 — PIN parental:** `pin.service.ts` completo; keypad numérico em settings; edit-profile com secção PIN

**R5 — Change password:** `parent-area/change-password.tsx` com `supabase.auth.updateUser`

**R6 — i18n global:** nav.* keys em 4 locales; challenge milestones, MiloBox, friends, calendar via i18n

**R7 — Desafio retroativo:** 7 dias passados no tab challenge; banner âmbar; estado `'late'` no calendar

**R8 — Amigos + notificações in-app:** getNotifications, blockUser/unblockUser; friends/notifications.tsx; friends/blocked.tsx

---

### ⚠️ Issues conhecidos

- `expo-av` incompatível com SDK — sons comentados com TODO
- `complete_challenge` EF: flag `is_retroactive` recebida mas lógica de "não actualizar streak" precisa de ser validada end-to-end
- **Push em device real:** requer `npm install expo-notifications expo-device` (Mac Terminal) + EAS build — ver `.scripts/setup-push-notifications.sh`
- **Push iOS (APNs):** requer Apple Developer Program ($99/ano)
- **Block list:** AsyncStorage MVP — migrar para tabela `blocked_users` no Supabase (Phase 5+)
- Git locks virtiofs: usar `mv` nunca `rm` (ver CLAUDE.md)
- Avatares PNG ~1.2 MB cada — optimizar para ≤200 KB antes de produção

---

### ⏭️ Próximos passos (por prioridade)

**A — Gamification end-to-end (alta):**
- Integrar `start_challenge` + `complete_challenge` EFs no `challengeStore` / challenge screen
- Verificar `is_retroactive`: complete_challenge não deve atribuir streak nem perfect-week bonus
- Level Up Celebration modal (dispara se `level` mudou na resposta da EF)
- Trophy/Achievement unlocks ligados ao retorno de `complete_challenge`

**B — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- `eas build --profile development --platform android`
- Testar push de friend_request em device físico

**C — Optimização de assets:**
- Redimensionar avatares para ≤200 KB (ImageMagick ou sharp)

**D — EAS build iOS:**
- Requer Apple Developer Program ($99/ano)
- `eas credentials --platform ios` → `eas build --profile development --platform ios`
