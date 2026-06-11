# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-11 12:31 UTC

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: 67a8d1c
```

---

### ✅ Concluído (sessão 3 — 2026-06-11)

**Fix crítico — Edge Functions (corsHeaders inline):**
- Todas as 5 EFs importavam `../\_shared/cors.ts` — o Management API deploy (body string único) não resolve imports relativos
- Fix: corsHeaders inlined em cada EF; re-deploy de todas (start_challenge v5, complete_challenge v5, send_friend_request v2, respond_friend_request v2, verify_parent_pin v2)
- `complete_challenge` v5: upsert da session antes de inserir answers (FK fix quando start_challenge falha offline)

**Fix fonte iOS 26 (Nunito ExtraBold stylistic alternates):**
- `src/components/ui/Text.tsx`: `fontVariant: ['tabular-nums']` + `allowFontScaling={false}` globais
- `challenge/[date].tsx`: `operandText`, `operatorText`, `answerBoxText` com `fontVariant: ['tabular-nums']`
- `src/components/challenge/StatusScreens.tsx`: `wa.num`, `wa.correct`, `be.num` com fontVariant; `sc.title` → `bold` (evita alternates do extraBold)

**Calendar — dias passados tappáveis:**
- `DayCell` convertido para Pressable; variantes `failed`/`missed` nos últimos 7 dias abrem `/(app)/challenge/{date}?retroactive=1`
- `today` também é pressable (abre desafio directo)
- `getPastCutoff()` helper para limitar janela de 7 dias

**PIN keypad fixes:**
- Keypad: grid com `flex: 1` em vez de `width: '30%'` (botões não cortam com gap no iOS)
- Footer: `paddingBottom: insets.bottom + 16` (Forgot PIN + Sign out acima da tab bar)
- Font: `fontFamily.bold` + `fontVariant: ['tabular-nums']` nos dígitos

**i18n global — 10 ficheiros corrigidos:**
- `settings.tsx`: logoutTitle, logoutMessage, logoutConfirm, questionsTitle, Editar, Esqueci o PIN, Sair da conta
- `achievements.tsx`: Coleção completa, Conquistas, milo.achievements
- `trophy-room.tsx`: Conquistados, Sequência
- `calendar.tsx`: Sequência, Recorde, Seu progresso, Progresso do mês, Esta semana, Troféu mensal, XP no mês
- `friends/list.tsx`: Bloquear, Nenhum amigo ainda, Adicionar amigo, Amigos, Pedidos pendentes, Nenhum amigo encontrado, Ver notificações, Utilizadores bloqueados
- `friends/add.tsx`: Amigo, Enviado, Adicionar, Adicionar amigo, Nenhum utilizador encontrado, Resultado, Sugestões para você
- `friends/ranking.tsx`: Sem dados de ranking, Ranking de amigos
- `friends/notifications.tsx`: Sem notificações
- `parent-area/edit-profile.tsx`: PIN parental, Senha
- `StatusScreens.tsx`: respostas corretas, acertos, Meta: 100%
- Locales (pt/en/es/fr): keys adicionadas para todas as novas strings

**app.json fix:**
- Removido plugin `expo-notifications` (não instalado → Metro crashava na inicialização)

---

### ✅ Concluído (sessão 2 — 2026-06-11)

**Deploy todas as Edge Functions (Supabase ACTIVE):**
`send_friend_request`, `respond_friend_request`, `verify_parent_pin` (bcrypt), `start_challenge`, `complete_challenge`

**Migration 003:** tabela `messages` + `child_profiles.expo_push_token` + RLS + Realtime

**Push notifications:** `notification.service.ts`, `eas.json`, app.json config, script setup

**Chat entre amigos:** `chat.service.ts` (Realtime), `friends/chat/[friendId].tsx`, badge unread em friends/list

---

### ⚠️ Issues conhecidos

- `expo-av` incompatível com SDK — sons comentados com TODO
- `complete_challenge` EF: `is_retroactive` detectado via data (challenge_date !== today) — flag do cliente ignorada, lógica correcta
- **Push em device real:** `npm install expo-notifications expo-device` (Mac Terminal) + EAS build
- **Push iOS (APNs):** requer Apple Developer Program ($99/ano)
- **Block list:** AsyncStorage MVP — migrar para tabela `blocked_users` (Phase 5+)
- Git locks virtiofs: `mv` nunca `rm`
- Avatares PNG ~1.2 MB — optimizar para ≤200 KB antes de produção
- `friends/list.tsx`: "Nível X" nos sub-labels ainda hardcoded (usa `common.level` se key existir)
- Tela de amigos (friends/list): pesquisa está fora do header azul (no design está dentro) — redesign pendente

---

### ⏭️ Próximos passos (por prioridade)

**A — Gamification end-to-end:**
- Integrar `start_challenge` + `complete_challenge` EFs no `challengeStore` / challenge screen
- Level Up Celebration modal (disparar quando `level_up: true` na resposta)
- Trophy/Achievement unlocks ligados ao retorno da EF

**B — Friends list redesign:**
- Search bar dentro do header azul (pixel-faithful ao design)
- Remover footer text links; mover para ícones no header

**C — Avatar em sugestões/amigos:**
- `FriendAvatar` usa iniciais; mostrar imagem real do avatar quando `avatar_id` disponível

**D — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build Android (gratuito)

**E — Optimização de assets:**
- Redimensionar avatares para ≤200 KB
