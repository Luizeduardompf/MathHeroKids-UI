# Math Hero Kids — Open Questions & Inconsistencies

> Revisto em 2026-08-05 contra o código real — ver anotações "**Verificado 2026-08-05**" nos
> itens ainda abertos. Vários já estavam de facto resolvidos pela implementação sem o documento
> ter sido atualizado; isso está marcado explicitamente abaixo, distinto de "ainda em aberto".

---

## ✅ Resolved — Critical

### OQ-01: Login Screen — Username vs. Email

**Decision**: Login is parent-only (email + password). Children do not log in. The "Nome de usuário" placeholder in the original design was a design error. The login screen field must be updated to "E-mail do responsável". Child identity is established via the profile switcher under the parent's session.

**Impact on design**: Login screen needs to be updated — field label changed to "E-mail", placeholder changed to "responsavel@email.com".

---

### OQ-02: Child Password — Necessity and Security

**Decision**: Children have no password and cannot log in independently. The "Senha da criança" field visible in the registration designs is removed from the flow. A parent logs in once per device; the profile switcher handles child selection. Recovery of child data is always through the parent account.

**Impact on design**: Child registration Step 2 — remove "Senha da criança" field.

---

### OQ-03: Retroactive Challenge — XP Rules

**Decision**:
- Full XP awarded (identical to a same-day challenge).
- Available for past 7 calendar days only; older days are locked.
- Counts toward cumulative trophy progress (e.g. monthly_days_completed counter).
- Does NOT unlock "perfect week" or "perfect month" trophies for windows already closed.
- Does NOT update `current_streak` or `last_challenge_date`.
- Calendar day shows "Completed" after retroactive completion.

---

### OQ-04: Timer Settings Range Discrepancy

**Decision**: Discrete pill/chip selector (not slider). Options: 10s / 15s (default) / 20s / 30s / Unlimited. Removed 5s (too fast for 6–7 year olds). Removed 45s/60s (no challenge value). PRD §13 updated accordingly. Settings design (slider 10–60s) must be updated to pill selector.

---

### OQ-05: Multiplication Range — Custom Option

**Decision**: Deferred to Phase 2. MVP ships with 4 fixed options only: 1–10, 1–12, 1–15, 1–20. "Custom" removed from PRD §14 for v1.1. No UX design or implementation needed until Phase 2.

---

## 🟡 Important — Should Clarify Before Phase Starts

### OQ-06: Block System — Exact Definition ✅ Resolved

**Decision**:
- 4 blocks of 5 questions each (B1: Q1–5, B2: Q6–10, B3: Q11–15, B4: Q16–20).
- Block retry resets only the current block; previous blocks untouched.
- Block is NOT a gate — child can advance with "Continuar mesmo assim" regardless of score.
- XP paid once per unique `question_index`, even across multiple retry attempts. Anti-farm enforced server-side.
- `is_perfect = true` requires all 20 unique question indices to have at least one correct answer across all attempts.
- Schema impact: `challenge_answers` has no `UNIQUE (session_id, question_index)` — stores all attempts with `block_number` + `attempt_number` columns.

---

### OQ-07: Streak — Day Boundary and Timezone ✅ Resolvido (verificado 2026-08-05)

**Decisão implementada**: `child_profiles.timezone` (default `'America/Sao_Paulo'`, migration
007) guarda o timezone da criança; "sessão distinta"/dia calendário é sempre calculado nesse
timezone (`toLocalDate()` em `_shared/retest.ts` e equivalente em `mastery.ts`), não em UTC nem
no timezone do dispositivo no momento da chamada. Isto é DP-7 em
`docs/adaptive-multiplication-system.md`. Viajar de timezone não altera o cálculo — o timezone
é uma propriedade fixa da criança, não inferida do dispositivo a cada request.

---

### OQ-08: Challenge Generation — Randomness and Fairness ✅ Resolvido (verificado 2026-08-05)

**Decisão implementada** (Phase 2.5, `start_challenge`): geração **server-side adaptativa**, não
aleatória num range fixo nem seeded por data global. Cada criança recebe questões selecionadas
por buckets de mastery (WEAK/LEARNING/REVIEWING/NEW/MASTERED, pesos em `adaptive-rules.json`),
sem repetição dentro da sessão, com cooldown cross-sessão (não repete um facto usado nos
últimos K desafios). A ordem final é reembaralhada com seed = `session_id` (aleatoriedade real
por sessão, não por dia/global) — evita agrupar as mais difíceis no fim. Ver
`docs/adaptive-multiplication-system.md` §7.

---

### OQ-09: Achievement Navigation Entry Point ✅ Resolved

**Decision**: Accessed via avatar tap in the dashboard header → Profile Menu bottom sheet → "Conquistas". No new tab required.

---

### OQ-10: Level Progression Entry Point ✅ Resolved

**Decision**: Accessed via avatar tap in the dashboard header → Profile Menu bottom sheet → "Progressão" or "Recompensas". The XP bar in the header is also tappable and navigates directly to Level Progression. No new tab required.

---

### OQ-11: "Madrugador" Trophy — Requirement Unknown 🟡 Ainda em aberto (verificado 2026-08-05)

**Observation**: The trophy room shows a "Madrugador" (early bird) trophy alongside the Troféu Diário. Its requirement is not documented in the PRD.

**Verificado 2026-08-05**: continua sem condição de desbloqueio implementada no backend. O nome
existe nas traduções (`src/locales/*.json`) e é mostrado na Sala de Troféus, mas não há lógica
de "hora do dia" em `complete_challenge` nem em nenhum `requirement_type` conhecido — é, na
prática, um troféu inalcançável hoje.

**Decision needed**: Is it for completing challenges before a specific time (e.g., before 8 AM)? If so, this introduces time-of-day logic not present in the rest of the system.

---

### OQ-12: Friend Suggestions Algorithm ✅ Resolvido (verificado 2026-08-05)

**Implementado** (`social.service.ts`): amigos-dos-amigos como fonte primária (via
`friendships`, excluindo já-amigos e o próprio), limitado a 10. **Sem nenhum amigo ainda**, cai
para sugestão por **nível próximo** (±2 níveis do nível atual da criança), também limitado a
10 — fallback diferente do que esta secção previa ("recently active"), mas resolve o mesmo
problema (lista vazia para quem acabou de se registar).

The "Add Friend" screen shows "Sugestões para você" with suggested friends. The algorithm is undefined.

**Options**: friends-of-friends, same level range, same school (future), recently active players.

**For MVP**: friends-of-friends with fallback to recently active, limited to 10 suggestions.

---

### OQ-13: Social Features — Scope for Children ✅ Resolved

**Decision**:
- Username search is global but **exact match only** — no autocomplete or partial results. Child must know the exact username, ensuring friendship is between real-world acquaintances.
- Friend suggestions ("Sugestões para você") are friends-of-friends only — no discovery of strangers.
- No parental approval per-friendship in MVP. `social_enabled` toggle on the child profile is sufficient: when disabled, child cannot send or receive friend requests.
- No block/report tools in MVP. Deferred to Phase 2+.
- Optional Phase 2 feature: push notification to parent when child receives a friend request.

---

## 🟢 Minor — Can Defer to Implementation

### OQ-14: Guest Mode — Definition and Scope 🟢 Ainda em aberto (verificado 2026-08-05)

**PRD §9**: Guest Mode allows local-only progress, no cloud sync, no social.

**Verificado 2026-08-05**: nenhum vestígio no código (`grep -r "guest"` não encontra nada em
`src/`/`app/`). Ou foi abandonado como conceito, ou continua genuinamente por fazer — decisão de
produto pendente, não uma questão técnica.

No guest mode designs exist. Is it:
- A "try before you register" flow?
- A parent-less operation mode?
- Still required for MVP?

### OQ-15: Push Notifications — Content and Schedule ✅ Resolvido de forma diferente (verificado 2026-08-05)

**Push nativo (`expo-notifications`) nunca foi implementado.** Em vez disso, as notificações do
produto são todas via **WhatsApp** (Evolution API self-hosted) — ver
`docs/WHATSAPP_INTEGRATION_ROADMAP.md`. 4 tipos configuráveis pelo pai (`daily_reminder`,
`unfinished_warning`, `completed_notice`, `weekly_summary`) + 2 pela própria criança
(`daily_reminder`, `unfinished_warning`), horários configuráveis por hora cheia (cron corre
1×/hora). Responde à pergunta original de forma completamente diferente do que se esperava.

### OQ-16: "Perfect Block" XP Source ✅ Resolvido (verificado 2026-08-05)

**PRD §19**: "Perfect Blocks" are an XP source. But the designs only show milestone XP at Q5/Q10/Q15/Q20. Are these the same thing? Is a "perfect block" 5/5 correct with bonus XP on top of the milestone XP?

**Verificado 2026-08-05**: não existe XP por bloco perfeito nem por milestone (Q5/Q10/Q15)
separado — `src/constants/config.ts` `CHALLENGE` só define 3 fontes: `XP_PER_CORRECT_ANSWER`
(+2), `XP_COMPLETION_BONUS` (+4, uma vez por sessão), `XP_PERFECT_BONUS` (+10, uma vez, se
100%). Blocos de 5 continuam a existir como agrupamento visual/milestone de UI, mas sem XP
próprio — a ideia de "Perfect Blocks" como fonte de XP distinta do PRD original não foi
implementada assim.

### OQ-17: Avatar — Fixed Set or Expandable

The designs show exactly 6 avatar options. The PRD mentions custom avatars as a future monetization feature. The current schema stores `avatar_id TEXT`. This is fine — ensure the avatar catalog is data-driven (not hardcoded), even if it only has 6 entries in MVP.

**Verificado 2026-08-05**: continua com exatamente 6 (`AVATAR_IDS` em `config.ts`: sofia, lucas,
luna, mia, pedro, theo) — mas é uma constante hardcoded no cliente, não um catálogo em tabela
Supabase. "Data-driven" no sentido pretendido pelo doc original não foi implementado.

### OQ-18: Ranking Scope — Friends-only or Global? ✅ Resolvido (verificado 2026-08-05)

**PRD §24**: Rankings display position, avatar, XP, streak. The designs show a "Friends Ranking" screen. Is there also a global ranking (all users)? The dashboard preview shows friends ranking only. Global ranking is not in the designs but may be implied by the PRD.

**Verificado 2026-08-05**: só ranking de amigos, confirmado. Sem nenhum ranking global —
`friends/ranking.tsx` é a única tela de ranking, sempre filtrada a `friendships` do próprio
filho. Não há plano documentado para adicionar um global.

### OQ-19: Weekly Challenge Completion XP ✅ Confirmado como NÃO implementado (verificado 2026-08-05)

**PRD §19**: "Weekly Completion" is an XP source. No design shows this being awarded. What constitutes a complete week (7/7 days)? When is it awarded (end of Sunday)? How much XP?

**Verificado 2026-08-05**: `get_challenge_counts_for_gamification()` (migration 008) calcula
`week_count`/`month_count` para **progresso de troféus** (`challenges_in_week`,
`challenges_in_month` como `requirement_type`), não para XP. Não existe nenhuma fonte de XP
"semana completa" em `child_xp_ledger.source` (só `correct_answer`, `challenge_completion`,
`achievement`, `trophy`). Confirmado: nunca foi implementado como XP, só como condição de
troféu/achievement.

### OQ-20: Multiplication Configuration — Both Operands Configurable? ⚠️ Resolvido, mas revela um bug (verificado 2026-08-05)

**PRD §14**: Ranges are described as "1–10", "1–12", etc. Does this mean both operands range from 1 to N, or is one operand fixed (e.g., "tabuada do 7")?

The settings screen shows "Multiplicar até: 10" (multiply up to 10), implying both operands are in [1, N]. Confirm this is correct.

**Verificado 2026-08-05 — achado, não só resposta**: sim, ambos os operandos estariam em
`[1, N]` — mas isto ficou **morto** desde a Phase 2.5. `arithmetic_facts` (o catálogo real
usado pelo motor adaptativo) está fixo em `1..10` para todas as operações (`operand_a`/
`operand_b smallint`, seed só gera `1..10`). `start_challenge` **hardcodes**
`multiplication_max: 10` no payload de resposta (linha 317), independentemente do valor
guardado em `child_profiles.multiplication_max` (que ainda aceita 10/12/15/20 via CHECK e
continua editável na UI de settings). Ou seja: **o seletor "Multiplicar até: 12/15/20" na app
não tem efeito nenhum** desde que o motor passou a ser adaptativo — parece configurável mas não
é. Nunca corrigido nem removido da UI.

---

### OQ-21: Bloqueio de amigos vive em AsyncStorage, não em Supabase 🟡 Achado novo (2026-08-05)

`friends/blocked.tsx` tem uma lista de bloqueados totalmente funcional na UI, mas persistida
localmente (`AsyncStorage`), com uma migração para tabela `blocked_users` já prevista em
comentário no próprio ficheiro mas nunca feita. Consequência real: bloqueios não sincronizam
entre dispositivos da mesma família, e `send_friend_request` (Edge Function) não sabe de
bloqueios — nada impede um pedido de amizade de alguém bloqueado localmente chegar à criança
noutro aparelho.

### OQ-22: `multiplication_max` é um seletor morto desde a Phase 2.5 🟡 Achado novo (2026-08-05)

Ver OQ-20 acima — `start_challenge` hardcoda `multiplication_max: 10` na resposta,
independentemente do que está guardado em `child_profiles.multiplication_max`. O seletor
"Tabuada: 1–10 / 1–12 / 1–15 / 1–20" continua na UI de settings e continua a gravar na DB, mas
não tem efeito nenhum na geração de questões — o catálogo `arithmetic_facts` está fixo em
`1..10`. Ou remover o seletor da UI, ou expandir o catálogo para suportar os outros ranges.

---

## Summary Table

| # | Severity | Topic | Decision Owner |
|---|---|---|---|
| OQ-01 | ✅ Resolved | Login: parent email only, no child login | — |
| OQ-02 | ✅ Resolved | No child password, no independent login | — |
| OQ-03 | ✅ Resolved | Retroactive: full XP, 7-day window, closed windows not rewritten | — |
| OQ-04 | ✅ Resolved | Timer: discrete pills 10/15/20/30/∞; PRD updated | — |
| OQ-05 | ✅ Resolved | Custom range deferred to Phase 2 | — |
| OQ-06 | ✅ Resolved | Block retry: current block only; XP once per question; no gate | — |
| OQ-07 | ✅ Resolved | Streak timezone: `child_profiles.timezone`, DP-7 | — |
| OQ-08 | ✅ Resolved | Question generation: server-side adaptativo (Phase 2.5) | — |
| OQ-09 | ✅ Resolved | Achievements: avatar tap → Profile Menu bottom sheet | — |
| OQ-10 | ✅ Resolved | Level Progression: avatar tap → Profile Menu; XP bar tap | — |
| OQ-11 | 🟡 Important | Madrugador trophy — ainda sem condição implementada | Product |
| OQ-12 | ✅ Resolved | Friend suggestions: amigos-de-amigos + fallback por nível | — |
| OQ-13 | ✅ Resolved | Search: global + exact match; social_enabled toggle; no parental approval/MVP | — |
| OQ-14 | 🟢 Minor | Guest mode — sem nenhum vestígio no código | Product |
| OQ-15 | ✅ Resolved (diferente) | Notificações são via WhatsApp, não push nativo | — |
| OQ-16 | ✅ Resolved | Sem XP de "perfect block"; só 3 fontes de XP (2/4/10) | — |
| OQ-17 | ✅ Resolved | 6 avatares hardcoded no cliente (não data-driven) | — |
| OQ-18 | ✅ Resolved | Só ranking de amigos, sem global | — |
| OQ-19 | ✅ Confirmed not implemented | Sem XP de "semana completa"; só conta p/ troféus | — |
| OQ-20 | ⚠️ Bug achado | `multiplication_max` é um seletor morto — ver OQ-22 | Engineering |
| OQ-21 | 🟡 Achado novo | Bloqueio de amigos em AsyncStorage, não sincroniza | Engineering |
| OQ-22 | 🟡 Achado novo | `multiplication_max` sem efeito desde Phase 2.5 | Engineering |
