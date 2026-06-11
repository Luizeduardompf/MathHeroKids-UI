# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-11 08:00

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: 1fd2dd0
```

### ✅ Concluído nesta sessão (2026-06-11)

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
- Edge Functions não deployadas — XP/streak não actualizam
- Retroativo: flag `isRetroactive` guardado, EF precisa de suportar quando deployada
- **Push notifications (WhatsApp-style):** requer EAS build + FCM/APNs — NÃO funciona em Expo Go
- **Chat/mensagens:** Phase 5+ (Supabase Realtime)
- **Block list:** AsyncStorage MVP — Phase 5+: migrar para tabela `blocked_users` Supabase
- Git locks virtiofs: fix com `mv` (ver CLAUDE.md)
- Avatares PNG ~1.2MB cada — optimizar antes de produção

### ⏭️ Próximos passos

**A (alta prioridade) — Edge Functions + Gamification:**
- Deploy `start_challenge` + `complete_challenge`
- `complete_challenge`: suportar `is_retroactive` (sem streak/perfect week)
- XP/level/streak/trophies reais + Level Up modal

**B — Push notifications (EAS build):**
- `expo-notifications` + FCM + APNs
- Edge Function para push quando `friend_request` criado

**C — Chat entre amigos:**
- Supabase Realtime + tabela `messages`

**D — 2 simuladores iOS + Android:**
- `npx expo run:ios` + `npx expo run:android`
- Testar invite cross-device após EAS build

**E — Optimização de assets:**
- Redimensionar avatares para ≤200KB
