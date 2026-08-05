# Math Hero Kids — Application Flows

> Reescrito em 2026-08-05 a partir das rotas reais em `app/`. A versão anterior tinha um
> inventário de 32 ecrãs; a app real tem mais de 45 rotas, incluindo chat, WhatsApp e
> ferramentas de developer que não existiam no desenho original.

---

## 1. Onboarding & Authentication

### 1.1 Registo (2 passos)

```
Welcome Screen (app/(auth)/welcome.tsx)
  │
  ├─[Começar agora]──→ Passo 1: register/parent.tsx
  │                         Nome, E-mail, Senha
  │                         [Continuar] ──→ Passo 2: register/child.tsx
  │                                              Avatar (6), nome, username, data nasc.
  │                                              [Criar perfil] ──→ (profile-select) ou Home
  │
  └─[Já tenho uma conta]──→ login.tsx
```

⚠️ `mailer_autoconfirm: true` — o signup confirma a conta na hora, sem exigir clique num email
(ver `CLAUDE.md` Auth). Isto é uma troca deliberada para o MVP, não um bug.

### 1.2 Login

```
welcome.tsx ─[Já tenho uma conta]→ login.tsx
  Campos: E-mail do responsável, Senha
  [Esqueceu a senha?] → forgot-password.tsx → email de reset
  [Entrar] → (profile-select)/index.tsx ("Quem está jogando?")
```

### 1.3 Seleção de perfil

```
(profile-select)/index.tsx
  Lista de child_profiles do pai: avatar, nome, level, XP
  [Tap perfil] → profileStore.setActiveChild() → (app)/(tabs)/index (home)
  [+ Adicionar criança] → add-child.tsx (mesmo formulário do passo 2 do registo)
```

O guard em `(app)/_layout.tsx` redireciona para aqui sempre que `!authenticated ||
!activeChild`.

---

## 2. Home Dashboard (`(app)/(tabs)/index.tsx`)

```
Header: avatar + nome + nível, XP bar
Secção Milo: mensagem contextual (streak, desafio feito/não feito)
Secção Streak: current_streak (chama-flame) + best_streak (troféu)
Secção "Desafio de hoje":
  ├── Badge: HOJE / Concluído
  ├── "+N XP" badge — calculado: 2×question_count + 4 + 10 (ver architecture.md §5.1)
  ├── Título "Multiplication Mountain" ⚠️ TEXTO FIXO no código (não localizado, não reflete
  │     a operação real do desafio — pode ser adição/subtração/divisão e continua a mostrar
  │     este nome). Achado em 2026-08-05, nunca corrigido.
  ├── "X / N questões" (N = child_profiles.question_count, default 20)
  └── [Iniciar Desafio] → challenge/[date].tsx
Troféus recentes (preview) → trophy-room.tsx
```

---

## 3. Challenge Flow (`challenge/[date].tsx`)

### 3.1 Início

```
[Iniciar Desafio] → chama start_challenge (Edge Function)
  Se offline: ecrã de erro amigável (use-network-status), sem fallback local
  Se >1 operação ativa e mix_operations=false: seletor de operação antes de começar
    (module_id enviado no request)
  Resposta: questions_payload persistido — o cliente só renderiza, nunca gera localmente
```

### 3.2 Pergunta

```
Questão N de TOTAL (TOTAL = questions_payload.length, pode ser < question_count pedido
  se o pool de factos elegíveis esgotou — ver database-schema.md nota sobre
  selection_metadata.shortfall)
Operador exibido via OPERATION_SYMBOLS[operation] — nunca assumir '×'
Timer: manual (timer_seconds) ou automático por nível (timer_auto → resolveTimerSeconds)
Teclado numérico → [✓]
  ├─[Correto] → CorrectOverlay (confetti + spring + haptic, Reanimated) → próxima questão
  ├─[Errado]  → marca fact_id para child_fact_retest (+ par comutativo, se aplicável)
  └─[Timeout] → idem, sem resposta
```

### 3.3 Fim de bloco / conclusão

Blocos de 5 questões continuam a existir como agrupamento visual/milestone, mas não são um
gate — "Continuar mesmo assim" sempre disponível. Ao fim de todas as questões:

```
Respostas enviadas em batch → complete_challenge
  ├─→ XP real calculado server-side (não confiar na estimativa mostrada durante o jogo)
  ├─→ level_up? → Level Up Celebration
  ├─→ trophies_earned[] / achievements_earned[] → overlays sequenciais
  └─→ Home Dashboard (calendar_days atualizado, streak atualizado se não retroativo)
```

### 3.4 Saída a meio

```
[✕] → Confirmação "Sair do desafio?" → session fica 'abandoned'
```

---

## 4. Calendar Flow (`(app)/(tabs)/calendar.tsx`)

```
Grid mensal: estados completed/failed/in_progress vêm de calendar_days;
  'future'/'today' são inferidos client-side pela data
[Tap dia passado, ≤7 dias] → challenge/[date] retroativo (XP igual, streak NÃO atualiza,
  calendar_days.is_retroactive = true)
[Tap dia passado, >7 dias] → só mostra estado, sem retry
```

---

## 5. Friends Flow (`(app)/friends/`)

### 5.1 Lista (`list.tsx`) + pedidos

```
Pedidos pendentes (badge com contagem, Realtime via canal friend_requests_<childId>)
  [✓ Aceitar] → respond_friend_request → 2 linhas em friendships (bidirecional)
  [✗ Rejeitar] → respond_friend_request → cooldown 24h antes de reenviar
Lista de amigos ordenada por XP
```

### 5.2 Adicionar (`add.tsx`)

```
Busca por username exato (sem autocomplete) → send_friend_request
"Sugestões para você" — friends-of-friends, máx. 10 (ver open-questions.md OQ-12)
```

### 5.3 Bloqueados (`blocked.tsx`) ⚠️

Existe e funciona, mas **a lista de bloqueados vive em `AsyncStorage`, não numa tabela
Supabase** — é um placeholder de MVP com migração para uma tabela `blocked_users` já prevista
em comentário no próprio ficheiro, nunca feita. Isto significa que bloqueios não sincronizam
entre dispositivos nem são visíveis ao backend (ex.: `send_friend_request` não os impede
server-side).

### 5.4 Chat (`chat/[friendId].tsx`) — não existia no desenho original

Chat de texto 1:1 entre amigos, tabela `messages` (migration 003), Realtime ativo. Mensagens
1–500 caracteres. Só o pai do remetente pode inserir; só o pai do destinatário pode marcar como
lida.

### 5.5 Notificações de amigo (`notifications.tsx`)

Ecrã de notificações relacionadas com pedidos de amizade (distinto das notificações WhatsApp
em `parent-area/notifications.tsx`).

### 5.6 Ranking (`ranking.tsx`)

```
Toggle Semanal/Mensal — sempre entre amigos, nunca global
Realtime: subscribeToRankingUpdates ouve xp_total de próprio filho + amigos para detetar
  ultrapassagem (canal ranking_<childId>) — não é só pull-to-refresh, ver architecture.md §6
```

---

## 6. Trophy Room / Achievements / Progression

```
trophy-room.tsx → trophy/[id].tsx (detalhe, progresso ou data de conquista)
achievements.tsx → grid por categoria (primeiros_passos, sequencias, habilidades, especiais)
progression.tsx → nível atual, XP bar, timeline de marcos (1..100, tabela esparsa)
rewards.tsx → recompensas de nível desbloqueadas/próximas
```

⚠️ O troféu "Madrugador" aparece na Sala de Troféus mas não tem condição de desbloqueio
confirmada no backend — ver `open-questions.md` OQ-11.

---

## 7. Parent Area (`(app)/parent-area/`)

```
[Qualquer ponto de acesso] → pin.tsx (PIN 4 dígitos, bcrypt via verify_parent_pin)
  │
  └─→ index.tsx (menu)
        ├── controls.tsx           — definições por criança (timer, question_count,
        │                             enabled_operations, mix_operations, multiplication_max)
        ├── child/new.tsx, child/[id].tsx — CRUD de perfis + WhatsApp da criança
        ├── edit-profile.tsx       — dados do pai + WhatsApp do pai
        ├── change-password.tsx
        ├── notifications.tsx      — definições WhatsApp do pai (4 tipos: daily_reminder,
        │                             unfinished_warning, completed_notice, weekly_summary)
        └── developers.tsx         — 2º gate: password fixa "120380" (hardcoded no cliente,
              │                        ver ficheiro), ferramentas internas (settings do reteste
              │                        em runtime, editáveis via update_app_config)
              └── developer-whatsapp.tsx — QR code, status da instância Evolution API, teste
                    de envio manual, reset de instância
```

Definições child-level "leves" (idioma, tema) ficam na tab Settings (`(tabs)/settings.tsx`),
acessíveis sem PIN — distinto da parent-area.

---

## 8. Screen Inventory (real, `app/`)

| Grupo | Rota | Nota |
|---|---|---|
| Auth | `(auth)/welcome`, `login`, `forgot-password` | |
| Auth | `(auth)/register/parent`, `register/child` | |
| Profile | `(profile-select)/index`, `add-child` | |
| Tabs | `(app)/(tabs)/index` (home), `calendar`, `challenge`, `friends`, `settings` | |
| Challenge | `(app)/challenge/[date]` | Full-screen, sem tab bar |
| Gamificação | `achievements`, `progression`, `rewards`, `trophy-room`, `trophy/[id]` | |
| Amigos | `friends/add`, `friends/list`, `friends/blocked`, `friends/ranking`, `friends/notifications` | |
| Amigos | `friends/chat/[friendId]` | Não existia no desenho original |
| Parent area | `parent-area/index`, `pin`, `controls`, `change-password`, `edit-profile` | |
| Parent area | `parent-area/child/[id]`, `child/new` | |
| Parent area | `parent-area/notifications` | WhatsApp do pai |
| Parent area | `parent-area/developers`, `developer-whatsapp` | 2º gate PIN "120380" |
| Erro | `+not-found` | |

---

## 9. O que mudou vs. o desenho original

- **Sem oferta única de multiplicação** — 4 operações configuráveis por criança.
- **Sem geração local de questões** — sempre server-side desde a Phase 2.5.
- **Chat entre amigos** — funcionalidade inteira ausente do desenho original.
- **WhatsApp** — substitui completamente o conceito de "push notifications" do desenho
  original, que nunca chegou a ser implementado.
- **Ferramentas de developer** (`developers.tsx`, `developer-whatsapp.tsx`) — não previstas.
- **Bloqueio de amigos** existe, mas em AsyncStorage, não Supabase.
- **XP e níveis** têm valores muito diferentes dos estimados no desenho original (ver
  `architecture.md` §5.1–5.2).
