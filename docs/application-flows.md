# Math Hero Kids — Application Flows

---

## 1. Onboarding & Authentication

### 1.1 New User Registration (2-step)

```
Welcome Screen
  │
  ├─[Começar agora]──→ Step 1: Parent Account
  │                         Fields: Nome do responsável, E-mail, Senha (8+ chars)
  │                         Checkbox: accept terms (legal guardian)
  │                         [Continuar] ──→ Step 2: Child Profile
  │                                              Fields: Avatar (6 options), Nome da criança,
  │                                                      Nome de usuário, Data de nascimento
  │                                                      (no password — child does not log in)
  │                                              [Criar perfil] ──→ Profile Switcher / Home Dashboard
  │
  └─[Já tenho uma conta]──→ Login Screen
```

**Key observations from screens:**
- Registration is always 2 steps: parent first, child second. The child is created inline during onboarding.
- The Milo mascot appears in both steps providing contextual encouragement.
- Registration subtitle: "Você poderá adicionar mais crianças depois, na área dos pais."

---

### 1.2 Login Flow

```
Welcome Screen
  │
  └─[Já tenho uma conta]──→ Login Screen
                                Fields: E-mail do responsável, Senha
                                [Esqueceu a senha?] ──→ Forgot Password Screen
                                                            Field: E-mail do responsável
                                                            [Enviar instruções] ──→ Email sent confirmation
                                [Entrar] ──→ (if 1 child) Home Dashboard (child auto-selected)
                                         ──→ (if 2+ children) Profile Switcher
```

> **Decision (OQ-01/OQ-02)**: Login is parent-only (email + password via Supabase Auth). Children do not log in. The "Nome de usuário" placeholder in the original design was a design error — the field is the parent's email. The design must be updated to reflect this. Child identity is established solely via the profile switcher, under the parent's active session.

---

### 1.3 Profile Switcher (Multi-child)

```
Profile Switcher ("Quem está jogando?")
  Shows all child profiles: avatar, display name, level, XP bar
  [Tap profile] ──→ Home Dashboard (as selected child)
  Profile switcher is also accessible from the Header dropdown (chevron next to child name)
  [+ Add Child] ──→ Parent PIN Gate ──→ Child Profile Creation (same as Step 2)
```

---

## 2. Home Dashboard

The dashboard is a single scrollable screen with the following sections (top to bottom):

```
Header Bar
  ├── Child avatar + name + chevron
  │     ├── [Tap chevron] → Profile Switcher (full screen)
  │     └── [Tap avatar/name area] → Profile Menu (bottom sheet)
  │               ├── ⚡ Progressão  → Level Progression screen
  │               ├── 🏆 Conquistas  → Achievements screen
  │               └── 🎁 Recompensas → Level Rewards screen
  └── XP bar: current XP / next level XP  (tap → Level Progression)

Section 1: Milo Motivation
  └── Milo speech bubble with contextual message

Section 2: Streak Stats
  ├── Current Streak (fire icon + number + "Day Streak")
  └── Best Streak (trophy icon + number)

Section 3: Today's Challenge Card
  ├── Status badge: "IN PROGRESS" | "COMPLETED" | "NOT STARTED"
  ├── Challenge name: "Multiplication Mountain"
  ├── Progress: "X / 20 questions" + progress bar
  ├── +XP indicator
  └── CTA button: [Continue Challenge] | [Start Challenge] | [Completed ✓]

Section 4: Recent Trophies
  ├── [See all] → Trophy Room
  └── Trophy cards: Daily Trophy, Weekly Trophy, Monthly Trophy (earned/locked)

Section 5: Friends
  ├── "X Friends · Top players you follow"
  ├── [Requests N] → Friends screen
  └── Top 3 friends by XP (rank + avatar + name + level + XP)

Section 6: Ranking (Friends ranking preview)
  ├── Top 3 with position medals
  └── [View Full Ranking] → Friends Ranking Screen

Section 7: Your Statistics
  ├── Perfect Days
  ├── Perfect Weeks
  ├── Perfect Months
  └── Challenges Done
```

---

## 3. Challenge Flow

### 3.1 Challenge Start

```
Home Dashboard [Start/Continue Challenge]
  │
  └─→ Challenge Screen (full-screen, no tab bar)
        Header: [✕ Exit] | "Questão X de 20" | ⏱ timer
        Progress bar (green, fills as questions complete)
        Body: Question display (e.g. "7 × 8 = ?")
        Footer: Numeric keypad (1-9, 0, backspace, ✓ confirm)
```

### 3.2 Question Answer Flow

```
Question displayed + timer starts
  │
  ├─[Correct answer + ✓]──→ Correct Feedback Screen
  │                              "+10 XP" shown (if first correct for this question_index)
  │                              "Acertou!" + confetti
  │                              Auto-advance after ~1.5s OR tap to continue
  │                              → [Block boundary at Q5/Q10/Q15/Q20] → Block Milestone (§3.5)
  │
  └─[Wrong answer + ✓]──→ Wrong Answer Screen ("Quase lá!")
  │                              Shows correct answer, child's answer, hint
  │                              Milo encouragement
  │                              [Continuar →] → next question (advancing without retry)
  │                              [Tentar o bloco de novo] → Block Retry (§3.5)
  │
  └─[Timer expires]──→ Time Expired Screen ("Acabou o tempo!")
                             Milo: "Sem pressão! Respire fundo e tente outra vez."
                             [Tentar o bloco de novo] → Block Retry (§3.5)
                             [Voltar ao início] → Home Dashboard
```

### 3.3 Exit Mid-Challenge

```
[✕ Exit button]
  │
  └─→ Confirmation Modal: "Sair do desafio?"
        "Seu progresso desta questão não será salvo."
        [Continuar] → resume challenge
        [Sair] → Home Dashboard
                  Progress up to the last submitted block checkpoint is saved.
                  Session status set to 'abandoned'.
```

### 3.4 Block System

The 20 questions are divided into 4 blocks of 5 questions each (B1: Q1–5, B2: Q6–10, B3: Q11–15, B4: Q16–20).

**Milestone events** fire when the child reaches the end of each block (whether via normal flow or after retry):
- End of B1 (Q5) → Milo: "Mandou bem! Você já completou 5 questões." (+60 XP cumulative shown)
- End of B2 (Q10) → Milo: "Você está na metade!" (+100 XP cumulative shown)
- End of B3 (Q15) → Milo: "Faltam só algumas!" (+150 XP cumulative shown)
- End of B4 (Q20) → Challenge Completion screen (§3.5)

### 3.5 Block Retry

```
Block ends (child answered all 5 questions of the current block)
  │
  ├─[All 5 correct → Block Perfect]──→ Milestone screen → advance to next block
  │
  └─[< 5 correct → Block Incomplete screen]
        Shows: score (e.g. "18/20 respostas corretas"), target "Meta: 100%"
        Milo encouragement
        [Tentar o bloco de novo] → re-attempt the SAME 5 questions
        │    - attempt_number incremented in challenge_answers
        │    - XP NOT awarded again for questions already answered correctly
        │    - Progress of previous blocks is NOT reset
        │
        [Continuar mesmo assim] → advance to next block without perfection
              (no gate; child is never forced to retry)
```

**"Perfeito" rule**: `is_perfect = true` on the session requires all 20 unique `question_index` values to have at least one `is_correct = true` answer across all attempts. A child can achieve perfect by getting every question right eventually via retries.

### 3.6 Challenge Completion

```
Q20 answered
  │
  └─→ Challenge Completed Screen ("Desafio concluído!")
        Milo large celebration
        "+200 XP" awarded
        Stats: "20/20 questões · 100%"
        [Continuar] → Check for level-up
                        │
                        ├─[Level up]──→ Level Up Celebration Screen
                        │                   Shows new level number + title + Milo
                        │                   Shows unlocked reward (if any)
                        │                   [Continuar] → Home Dashboard
                        │
                        └─[No level up]──→ Home Dashboard
```

---

## 4. Calendar Flow

```
Tab: Calendário
  │
  └─→ Calendar Screen
        Header: Child avatar + XP bar (same as dashboard)
        Milo motivation message (streak-specific)
        Streak stats: current streak + record
        Month navigation: < Junho 2026 >
        Calendar grid (weeks × days):
          - Day states: future (grey), completed (trophy/green), failed (red), in_progress (blue), perfect (star)
          - Today: highlighted with "HOJE" label
        Legend: Perfeito ★ | Concluído ✓ | Perdido ✗ | Bloqueado 🔒

        [Tap past day, within 7 days] → Opens that day's challenge (retroactive, full XP)
        [Tap past day, older than 7 days] → Shows completion state only (locked, no retry)
        [Tap future day] → No action (blocked)
        [Tap today] → Navigates to challenge if not done, or shows completion state

        Below calendar: "Seu progresso"
          - Monthly progress ring (e.g. "82%")
          - This week: "5/7 dias" progress bar
          - Monthly trophy card: "14 de 30 dias"
          - "+1,650 XP no mês" stat card
```

---

## 5. Friends Flow

### 5.1 Friends List

```
Tab: Amigos
  │
  └─→ Friends Screen
        Header: "Amigos" + [person+ icon → Add Friend]
        Search bar: "Buscar por nome de usuário" (inline search in friend list)
        Pending Requests section (with count badge):
          - Each request: avatar initials + name + mutual friends count
          - [✓ Accept] [✗ Reject]
        Friends list (scrollable):
          - Ordered by XP (weekly ranking)
          - Each: avatar + name + level + XP
```

### 5.2 Add Friend

```
[person+ icon] → Add Friend Screen
  Search field: "Digite o nome de usuário"
    - Exact match only — no autocomplete, no results while typing
    - Search executes only on [Submit/Enter] or explicit search button tap
    - Returns single result if username exists, "Nenhum resultado" if not
    - Result shows: avatar initials + display name + @username + streak
    - [Adicionar] → sends friend request (if social_enabled = true on both sides)

  Below search (when field is empty): "Sugestões para você"
    - Friends-of-friends algorithm, max 10 suggestions
    - Shows: avatar initials + name + @username + streak
    - [Adicionar] button → sends friend request
```

> **Decision (OQ-13)**: Search is global but requires exact username match — no discovery by partial name. This ensures children only find people whose username they already know (i.e., real-world acquaintances). No parental approval per-friendship in MVP; `social_enabled` toggle on the child profile is the parent's control mechanism.

### 5.3 Rankings

```
From Friends section on Dashboard [View Full Ranking] or from Friends screen
  │
  └─→ Friends Ranking Screen
        Toggle: [Semanal] | [Mensal]
        Podium: 1st (large, crown), 2nd, 3rd
        List: position + avatar + name + XP
        Current user highlighted as "Você"
```

---

## 6. Trophy Room Flow

```
Dashboard [See all trophies] OR direct navigation
  │
  └─→ Trophy Room ("Sala de Troféus")
        Milo message
        Stats: "X Conquistados" | "Y Sequência"
        Next Trophy card: name + progress bar (e.g. "18/30")
        Sections (horizontal scroll or grid):
          - Diários: Troféu Diário (Bronze), Madrugador (Bronze)
          - Semanais: Troféu Semanal (Prata)
          - Mensais: Troféu Mensal (Ouro)
          - Sequência: Sequência de Fogo (Ouro)
          - Especiais: Semana Perfeita (Diamante), Mês Perfeito (Diamante), Campeão (Ouro)
        Locked trophies shown with padlock icon

        [Tap trophy] → Trophy Detail Screen
                          Shows: trophy icon + tier badge
                          "Como conquistar": requirement description
                          "CONQUISTADO · [date]" (if earned) OR progress bar (if in progress)
                          [CTA button if not earned]
```

---

## 7. Achievements Flow

```
Navigation (from where? — not shown in designs, likely accessible from dashboard or profile)
  │
  └─→ Achievements Screen ("Conquistas")
        Milo message
        "Coleção completa: X%" + progress bar
        "N de M conquistas desbloqueadas"
        Grid of achievement cards by category:
          - Primeiros Passos: Primeiro Dia Perfeito, Primeiro Acesso
          - Sequências: Sequência de 7 Dias, Sequência de 30 Dias
          - Habilidades: Mestre da Multiplicação, Campeão da Velocidade
          - Especiais: Semana Perfeita, Mês Perfeito
        Unlocked: colored icon + name
        Locked: padlock icon + grayed name
```

---

## 8. Level Progression Flow

```
Navigation (from header avatar/level, or from settings area)
  │
  └─→ Level Progression Screen ("Progressão")
        Current level circle (large, with star)
        "NÍVEL ATUAL · [Level Name]"
        XP bar: current / next level XP
        "Faltam X XP para o nível Y"
        Milo proximity message
        "Marcos e recompensas" timeline:
          - Each milestone: level number · level name · reward name · reward icon
          - Completed: green checkmark
          - Current: highlighted blue with level badge
          - Future: padlock

  └─→ Level Rewards Screen ("Recompensas")
        Milo: "Suba de nível para liberar roupas, molduras e muito mais!"
        Unlocked rewards grid (green checkmark badges)
        "Próximas recompensas" list (level, item name, levels remaining)
        Motivational footer: "Continue jogando todos os dias para liberar as recompensas mais raras!"
```

---

## 9. Parent Area Flow

```
[Any access point to parent area] → Parent PIN Screen ("Controle dos pais")
  Shows 4-dot PIN input + numeric keypad
  [Correct PIN] → Parent Settings
  [Wrong PIN] → Error state (retry limit TBD)

Parent Settings ("Ajustes") — accessible from Settings tab without PIN for child-level settings:
  - Idioma: PT | EN | ES | FR (pill selector)
  - Tempo por questão: pill selector — 10s | 15s (default) | 20s | 30s | Sem limite
  - Tabuada: pill selector — 1–10 | 1–12 | 1–15 | 1–20

Parent-gated area (after PIN):
  - Manage child profiles (add, edit, deactivate)
  - Per-child: timer, multiplication range, social features toggle
  - Notifications settings
```

---

## 10. Screen Inventory (Complete)

| # | Screen | Route | Auth Level |
|---|---|---|---|
| 1 | Welcome | `/welcome` | Public |
| 2 | Login | `/login` | Public |
| 3 | Forgot Password | `/forgot-password` | Public |
| 4 | Parent Registration (Step 1) | `/register/parent` | Public |
| 5 | Child Registration (Step 2) | `/register/child` | Parent auth |
| 6 | Profile Switcher | `/who-is-playing` | Parent auth |
| 7 | Home Dashboard | `/` | Child active |
| 8 | Calendar | `/calendar` | Child active |
| 9 | Challenge (active) | `/challenge/[date]` | Child active |
| 10 | Correct Answer Feedback | (modal/overlay) | Child active |
| 11 | Wrong Answer Feedback | (modal/overlay) | Child active |
| 12 | Time Expired Feedback | (modal/overlay) | Child active |
| 13 | Block Incomplete Feedback | (modal/overlay) | Child active |
| 14 | Challenge Completed | (modal/overlay) | Child active |
| 15 | Milo Milestone (Q5/Q10/Q15) | (overlay) | Child active |
| 16 | Level Up Celebration | (modal) | Child active |
| 17 | Friends List | `/friends` | Child active |
| 18 | Add Friend | `/friends/add` | Child active |
| 19 | Friends Ranking | `/friends/ranking` | Child active |
| 20 | Trophy Room | `/trophies` | Child active |
| 21 | Trophy Detail | `/trophies/[id]` | Child active |
| 22 | Profile Menu (bottom sheet) | (sheet, avatar tap) | Child active |
| 23 | Achievements | `/achievements` | Child active |
| 24 | Level Progression | `/progression` | Child active |
| 25 | Level Rewards | `/rewards` | Child active |
| 26 | Settings (child-level) | `/settings` | Child active |
| 27 | Parent PIN Gate | `/parent-area` | Child active |
| 28 | Parent Controls | `/parent-area/controls` | Parent PIN |
| 29 | Add Child Profile | `/parent-area/child/new` | Parent PIN |
| 30 | Edit Child Profile | `/parent-area/child/[id]` | Parent PIN |
| 31 | Exit Challenge Modal | (modal) | Child active |
| 32 | Block Retry Screen | (modal/overlay) | Child active |
