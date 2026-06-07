# Math Hero Kids — Open Questions & Inconsistencies

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

### OQ-07: Streak — Day Boundary and Timezone

**Questions**:
- What timezone is used for streak day boundaries? Device local time or UTC?
- If a family is traveling across timezones, can they "game" the streak?
- If a child completes a challenge at 11:59 PM local time, does it count for that day?

**Recommendation**: Use the device's local calendar date for day assignment, stored in UTC with the local date offset. Display in local time.

---

### OQ-08: Challenge Generation — Randomness and Fairness

**Questions**:
- Are multiplication pairs generated randomly within the configured range?
- Is there a guarantee of no repeats within a session (20 questions)?
- Is there seeding by date (same questions for everyone on a given day, like Wordle)?
- Does the generator avoid "easy" questions clustering at the start?

**Impact**: Question generator algorithm, `challenge_answers` schema (needs seed if date-based).

---

### OQ-09: Achievement Navigation Entry Point ✅ Resolved

**Decision**: Accessed via avatar tap in the dashboard header → Profile Menu bottom sheet → "Conquistas". No new tab required.

---

### OQ-10: Level Progression Entry Point ✅ Resolved

**Decision**: Accessed via avatar tap in the dashboard header → Profile Menu bottom sheet → "Progressão" or "Recompensas". The XP bar in the header is also tappable and navigates directly to Level Progression. No new tab required.

---

### OQ-11: "Madrugador" Trophy — Requirement Unknown

**Observation**: The trophy room shows a "Madrugador" (early bird) trophy alongside the Troféu Diário. Its requirement is not documented in the PRD.

**Decision needed**: Is it for completing challenges before a specific time (e.g., before 8 AM)? If so, this introduces time-of-day logic not present in the rest of the system.

---

### OQ-12: Friend Suggestions Algorithm

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

### OQ-14: Guest Mode — Definition and Scope

**PRD §9**: Guest Mode allows local-only progress, no cloud sync, no social.

No guest mode designs exist. Is it:
- A "try before you register" flow?
- A parent-less operation mode?
- Still required for MVP?

### OQ-15: Push Notifications — Content and Schedule

Notifications are mentioned in Parent Controls but not designed. What triggers a notification? Daily reminder at what time? Who controls the time?

### OQ-16: "Perfect Block" XP Source

**PRD §19**: "Perfect Blocks" are an XP source. But the designs only show milestone XP at Q5/Q10/Q15/Q20. Are these the same thing? Is a "perfect block" 5/5 correct with bonus XP on top of the milestone XP?

### OQ-17: Avatar — Fixed Set or Expandable

The designs show exactly 6 avatar options. The PRD mentions custom avatars as a future monetization feature. The current schema stores `avatar_id TEXT`. This is fine — ensure the avatar catalog is data-driven (not hardcoded), even if it only has 6 entries in MVP.

### OQ-18: Ranking Scope — Friends-only or Global?

**PRD §24**: Rankings display position, avatar, XP, streak. The designs show a "Friends Ranking" screen. Is there also a global ranking (all users)? The dashboard preview shows friends ranking only. Global ranking is not in the designs but may be implied by the PRD.

### OQ-19: Weekly Challenge Completion XP

**PRD §19**: "Weekly Completion" is an XP source. No design shows this being awarded. What constitutes a complete week (7/7 days)? When is it awarded (end of Sunday)? How much XP?

### OQ-20: Multiplication Configuration — Both Operands Configurable?

**PRD §14**: Ranges are described as "1–10", "1–12", etc. Does this mean both operands range from 1 to N, or is one operand fixed (e.g., "tabuada do 7")?

The settings screen shows "Multiplicar até: 10" (multiply up to 10), implying both operands are in [1, N]. Confirm this is correct.

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
| OQ-07 | 🟡 Important | Streak timezone handling | Engineering |
| OQ-08 | 🟡 Important | Question generation algorithm | Engineering/Product |
| OQ-09 | ✅ Resolved | Achievements: avatar tap → Profile Menu bottom sheet | — |
| OQ-10 | ✅ Resolved | Level Progression: avatar tap → Profile Menu; XP bar tap | — |
| OQ-11 | 🟡 Important | Madrugador trophy requirement | Product |
| OQ-12 | 🟡 Important | Friend suggestion algorithm | Engineering |
| OQ-13 | ✅ Resolved | Search: global + exact match; social_enabled toggle; no parental approval/MVP | — |
| OQ-14 | 🟢 Minor | Guest mode scope | Product |
| OQ-15 | 🟢 Minor | Push notification schedule | Product |
| OQ-16 | 🟢 Minor | Perfect block XP definition | Product |
| OQ-17 | 🟢 Minor | Avatar catalog extensibility | Engineering |
| OQ-18 | 🟢 Minor | Global vs. friends-only ranking | Product |
| OQ-19 | 🟢 Minor | Weekly completion XP amount | Product |
| OQ-20 | 🟢 Minor | Multiplication operand ranges | Product |
