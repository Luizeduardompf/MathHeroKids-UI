# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-11 14:00

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: c304896
```

### ✅ Concluído nesta sessão (2026-06-11 — sessão 2)

**Deploy todas as Edge Functions (Supabase ACTIVE):**
- `send_friend_request` v1: valida, insere friend_request, envia push via Expo Push API
- `respond_friend_request` v1: aceita/rejeita, friendships bidirecionais, push ao remetente
- `verify_parent_pin` v1: bcrypt (verify/set/change/clear), rate limiting 5 tentativas/30min
- `start_challenge` v4 + `complete_challenge` v3: updated

**Migration 003 — aplicada no DB remoto:**
- Tabela `messages` (chat) com RLS + índices
- `child_profiles.expo_push_token TEXT`
- Realtime habilitado na tabela messages

**Push notifications (`notification.service.ts`):**
- Registo de token Expo na startup do app (ao selecionar filho)
- Graceful fallback: não crasha se expo-notifications não instalado
- `eas.json` + `app.json` configurados com expo-notifications plugin
- Para activar: correr `.scripts/setup-push-notifications.sh` do Mac Terminal

**Chat entre amigos:**
- `chat.service.ts`: getConversation, sendMessage, markRead, unreadCount, Realtime subscribe
- `app/(app)/friends/chat/[friendId].tsx`: tela de chat com bolhas, input, live updates
- `friends/list.tsx`: botão 💬 por amigo + badge de mensagens não lidas
- Stack screens registados em `(app)/_layout.tsx`

### ⚠️ Issues conhecidos

**Skill `context-checkpoint` criada:**
- Monitoriza contexto heuristicamente, salva handoff, faz commit ao git
- Packaged como `context-checkpoint.skill` — instalar via Cowork

**R1 — Tab label + challenge header X:**
- `tabLabelAccent`: `marginTop: 18` para alinhar label "Desafio"
- Challenge header X: `borderRadius: 12` (rounded square) + icon size 22

**R2 — Friends screen:**
- `Global` ranking filtra apenas amigos (igual a Semanal/Mensal)
- Header: dois botões — bell (notificações) + person-add (gerir amigos)

**R3 — Avatar picker:**
- Double ring azul + `Ionicons checkmark` badge no canto inferior direito

**R4 — PIN parental:**
- `pin.service.ts`: getPin, setPin, clearPin, verify, sendForgotPinEmail
- `settings.tsx` PinGate: keypad numérico completo com dots (usa pinService)
- `parent-area/edit-profile.tsx`: secção PIN + botão Change Password

**R5 — Redefinir senha inline:**
- `parent-area/change-password.tsx`: nova tela, `supabase.auth.updateUser({ password })`

**R6 — i18n global:**
- `nav.*` keys em todos os 4 locales; tab labels via `t()`
- Challenge milestones, MiloBox, friends screen, calendar legend via i18n

**R7 — Desafio retroativo:**
- `challenge.tsx` tab: mostra 7 dias passados se hoje já feito
- `challengeService.isDateCompleted()` + `LocalCompletion.isRetroactive`
- `[date].tsx`: param `?retroactive=1`, banner âmbar, flag a storeLocalCompletion
- Calendar: estado `'late'` (âmbar + clock icon), `LegendRow` i18n-aware

**R8 — Amigos + notificações in-app:**
- `socialService.getNotifications()`, blockUser/unblockUser/getBlockedProfiles()
- `friends/notifications.tsx`: accept/reject inline
- `friends/blocked.tsx`: lista de bloqueados com unblock
- `friends/list.tsx`: botão ⋮ → bloquear; footer → Notificações + Bloqueados

### ⚠️ Issues conhecidos

- `expo-av` incompatível com SDK — sons comentados com TODO
- Retroativo: flag `isRetroactive` guardado, `complete_challenge` precisa verificar essa flag
- **Push notifications em device real:** requer `npm install expo-notifications expo-device` (Mac Terminal) + EAS build
- **Push iOS (APNs):** requer Apple Developer Program ($99/ano)
- **Push Android (FCM):** gratuito via EAS, funciona após `setup-push-notifications.sh`
- **Block list:** AsyncStorage MVP — Phase 5+: migrar para tabela `blocked_users` Supabase
- Git locks virtiofs: fix com `mv` (ver CLAUDE.md)
- Avatares PNG ~1.2MB cada — optimizar antes de produção
- `complete_challenge` EF deployed mas XP/streak ainda não testados end-to-end com migration

### ⏭️ Próximos passos

**A (alta prioridade) — Gamification end-to-end:**
- Testar `start_challenge` + `complete_challenge` com DB real
- `complete_challenge`: verificar suporte a `is_retroactive` (sem streak/perfect week)
- XP/level/streak/trophies reais + Level Up modal no cliente

**B — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build: `eas build --profile development --platform android`
- Testar push de friend_request no device físico

**C — Optimização de assets:**
- Redimensionar avatares para ≤200KB

**D — EAS build iOS:**
- Requer Apple Developer Program ($99/ano)
- Depois: `eas credentials --platform ios` + `eas build --profile development --platform ios`
