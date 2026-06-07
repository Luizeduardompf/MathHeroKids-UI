# Math Hero Kids — Architecture

> **Revision note**: This document was reviewed and challenged after initial draft. Sections marked with ⚠️ were corrected or simplified from the first version.

---

## 1. Overview

Math Hero Kids is a mobile-first gamified mathematics learning platform for children aged 6–12. The system has two user roles (Parent and Child), supports multi-profile shared devices, offline play, four languages, and a social layer. MVP focuses on multiplication; the architecture must support future math modules without structural changes.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Mobile App | React Native + Expo (managed workflow) | Cross-platform, fast iteration, OTA updates |
| Language | TypeScript (strict) | Type safety across the entire codebase |
| Backend-as-a-Service | Supabase | Auth, DB, Storage, Edge Functions in one; avoids custom backend in early stage |
| Database | PostgreSQL (via Supabase) | Relational model fits the domain well |
| Auth | Supabase Auth | Parent email/password login; children are NOT Auth users |
| Realtime | Supabase Realtime | **Scoped to friend request badge only** — not rankings (see §8.2) |
| Storage | Supabase Storage | Avatar assets |
| Offline | AsyncStorage + sync queue | **Not SQLite** — see §4.3 |
| i18n | expo-localization + i18next | 4 languages from day one |
| Server state | TanStack Query (React Query) | Caching, background refresh, mutations with retry |
| Client state | Zustand | Auth session, active child profile, challenge UI state only |
| Navigation | Expo Router (file-based) | Aligned with Expo ecosystem |
| Animations | React Native Reanimated 3 | Required for celebration screens and XP animations |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Native / Expo App                 │
│                                                         │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth      │  │  Child Game  │  │  Parent Area   │  │
│  │  Screens   │  │  Screens     │  │  (PIN-gated)   │  │
│  └────────────┘  └──────────────┘  └────────────────┘  │
│                                                         │
│  ┌────────────────────┐  ┌──────────────────────────┐   │
│  │  TanStack Query    │  │  Zustand                 │   │
│  │  (server state)    │  │  (auth, active child,    │   │
│  │                    │  │   challenge UI)           │   │
│  └────────────────────┘  └──────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Offline Sync Queue (AsyncStorage)        │    │
│  │  Buffer challenge submissions → flush on reconnect│   │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Supabase                            │
│                                                         │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth      │  │  PostgreSQL  │  │  Storage       │  │
│  │  (parents  │  │  (all data)  │  │  (avatar imgs) │  │
│  │   only)    │  └──────────────┘  └────────────────┘  │
│  └────────────┘                                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Row Level Security — all tables                │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Edge Functions (Deno)                          │    │
│  │  - start_challenge                              │    │
│  │  - complete_challenge (batch, not per-answer)   │    │
│  │  - verify_parent_pin                            │    │
│  │  - send_friend_request / respond_friend_request │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Application Layers

### 4.1 Navigation Structure

```
Root
├── (auth)                  ← unauthenticated stack
│   ├── welcome
│   ├── login               ← parent email + password (see OQ-01)
│   ├── register
│   │   ├── step-1-parent
│   │   └── step-2-child
│   └── forgot-password
│
├── (profile-select)        ← after parent login, if multiple children
│   └── who-is-playing
│
└── (app)                   ← parent authenticated + child profile selected
    ├── (tabs)
    │   ├── home
    │   ├── calendar
    │   ├── challenge       ← center FAB tab
    │   ├── friends
    │   └── settings
    │
    ├── challenge/[date]    ← full-screen, no tab bar
    ├── profile-menu        ← bottom sheet, opened by tapping avatar in header
    │   ├── progression     ← Level Progression
    │   ├── achievements    ← Conquistas
    │   └── rewards         ← Recompensas de Nível
    ├── trophy-room
    ├── trophy/[id]
    ├── friends/ranking
    ├── friends/add
    └── parent-area
        ├── pin             ← PIN gate
        ├── controls
        ├── child/new
        └── child/[id]
```

### 4.2 Auth Model

**Parents** authenticate via Supabase Auth (email + password). Their `auth.users` row maps 1:1 to a `parent_profiles` row via a DB trigger on signup.

**Children** are NOT Supabase Auth users and do NOT log in. A child is a row in `child_profiles` linked to a parent. After the parent logs in, they select which child is playing via the profile switcher. All subsequent data reads/writes are scoped to that child by the app, under the parent's authenticated session. Children have no password.

**Parent PIN**: A 4-digit PIN (bcrypt hash in `parent_profiles`) gates access to the parent settings area within the app. Verified via Edge Function `verify_parent_pin`. Does not create a new session — it's a second-factor gate, not a login.

**Session state**:
- Parent JWT: `Expo SecureStore` (encrypted, persists across app restarts)
- Active child ID: `Zustand` + `AsyncStorage` (survives app restart so the family doesn't need to re-select the child every time)

### 4.3 Offline Strategy ⚠️

**Original draft used Expo SQLite. This is overengineering for MVP.**

SQLite mirroring requires:
- Schema migration tooling on the client
- Bi-directional sync conflict resolution
- Significant development time

**MVP offline approach (simpler)**:

During a challenge, all answers are accumulated **in memory** (Zustand `challengeStore`). Only one network call fires at the end: `complete_challenge` with the full answers array. If that call fails (no internet), the entire session payload is serialized to `AsyncStorage` as a pending sync item. On next app open or network reconnect, the queue is flushed.

This means:
- Zero local database needed
- Only challenge sessions can be "offline pending" (all other operations require connectivity)
- The UI shows an "offline indicator" during a challenge and a "syncing" indicator after reconnect
- The challenge itself runs fully client-side (question generation is deterministic from config)

**Trade-off**: If the app crashes mid-challenge, in-progress session data is lost. Mitigation: write the in-progress session to AsyncStorage after each block completion (4 checkpoints per challenge), not per question.

**Not offline**:
- Friend requests
- Rankings
- Trophy/achievement display (show cached data from last fetch)
- Profile switching

### 4.4 Security Model

- All DB tables use RLS. Parents can only read/write their own children's data.
- **XP, levels, streaks, trophies, achievements are mutated exclusively by Edge Functions**, never by direct client writes. This is the primary anti-cheat mechanism.
- `child_credentials.password_hash` is **never returned to the client** via a dedicated RLS policy that blocks all `SELECT` on that column.
- Parent PIN hash is in `parent_profiles.pin_hash` — same treatment: never returned.
- Social features are child-scoped. Parent data is never exposed in social contexts.
- Edge Functions must validate that the child_id in the request belongs to the authenticated parent session. Client-provided child_id is not trusted alone.

---

## 5. Gamification Engine

All gamification state changes happen atomically inside the `complete_challenge` Edge Function, which receives the full session answers array.

```
complete_challenge(child_id, challenge_date, answers[])
        │
        ├─→ Insert challenge_session record
        │
        ├─→ Insert all challenge_answers records
        │
        ├─→ Compute: correct_count, xp_earned
        │     - 10 XP per correct answer
        │     - +200 XP flat bonus for completing all 20 (regardless of correctness)
        │     - Milestone bonuses at Q5/Q10/Q15 (these are shown in UI, included in total)
        │
        ├─→ Update child_profiles: xp_total += xp_earned
        │
        ├─→ Check level threshold → if level up:
        │     - Update child_profiles.level
        │     - Insert child_level_rewards for any rewards unlocked at new level
        │     - Return level_up: true + new_level + reward in response
        │
        ├─→ Update streak:
        │     - If challenge_date = last_challenge_date + 1 day: increment current_streak
        │     - If challenge_date = last_challenge_date: same day (idempotent, no change)
        │     - Else: reset current_streak to 1
        │     - Update best_streak if current > best
        │     - Update last_challenge_date
        │
        ├─→ Upsert calendar_days: set state = 'completed', is_perfect = (correct_count == 20)
        │
        ├─→ Evaluate trophy progress:
        │     - Increment per-trophy progress counters
        │     - Award if threshold met → insert child_trophies
        │
        ├─→ Evaluate achievement conditions:
        │     - Check all conditions; award newly unlocked ones → insert child_achievements
        │
        └─→ Return: { xp_earned, level_up, new_level, reward, trophies_earned[], achievements_earned[] }
```

**Why one Edge Function, not per-question calls** ⚠️:
- Per-question server calls = 20 network round-trips per session on a mobile device
- A child on 3G in Brazil might experience 200–500ms latency per call → 4–10 seconds of network overhead per challenge
- The question generator is deterministic (seeded by config), so all questions can be generated client-side
- Security: the Edge Function validates all 20 answers against the same generator on the server side, preventing answer substitution

### 5.1 XP Values

| Event | XP |
|---|---|
| Correct answer | +10 |
| Block milestone (Q5, Q10, Q15) | +60, +100, +150 (cumulative shown, not additive bonuses) |
| Challenge completion (Q20) | +200 flat |
| Achievement unlock | TBD by product |
| Trophy unlock | TBD by product |

Note: Milestone XP shown in the UI (+60, +100, +150, +200) appears to be cumulative totals, not per-block additions. Needs confirmation — see OQ-16.

---

## 6. Rankings ⚠️

**Original draft had pre-computed `weekly_rankings` and `monthly_rankings` tables. These are premature optimization.**

For MVP scale (< 100k users, friend groups of ≤ 50 children), ranking queries are fast enough on-demand:

```sql
-- Friend ranking for a child, current week
SELECT cp.id, cp.display_name, cp.avatar_id, cp.level,
       COALESCE(SUM(l.amount), 0) AS xp_week
FROM friendships f
JOIN child_profiles cp ON cp.id = f.friend_id
LEFT JOIN child_xp_ledger l
  ON l.child_id = f.friend_id
  AND l.created_at >= date_trunc('week', now())
WHERE f.child_id = $current_child_id
GROUP BY cp.id
ORDER BY xp_week DESC;
```

This query with proper indexes on `child_xp_ledger(child_id, created_at)` and `friendships(child_id)` runs in < 50ms for typical friend group sizes.

**Pre-computed tables should be introduced only when query latency becomes a problem**, not preemptively. No scheduled Edge Functions needed for rankings in MVP.

Supabase Realtime is **not needed for rankings** — a pull-to-refresh or on-focus refetch via TanStack Query is sufficient. Rankings don't update in real-time in any meaningful way.

**Supabase Realtime is only used for**: friend request badge notifications (push a small event when a new friend request arrives so the badge updates without polling).

---

## 7. Module Extension Pattern

Future math modules must implement a `ChallengeModule` interface. The question generator runs client-side; the validator runs server-side in `complete_challenge`.

```typescript
interface ChallengeModule {
  id: string;                          // 'multiplication', 'division', etc.
  generateQuestions(config: ModuleConfig, seed: string): Question[];
  validateAnswer(question: Question, answer: string): boolean;
  getDefaultConfig(birthDate: Date): ModuleConfig;
}
```

The `seed` is `${child_id}:${challenge_date}:${module_id}` — deterministic, per-child-per-day, non-guessable. This ensures the server can regenerate and validate the exact same questions the client presented.

---

## 8. Key Architectural Decisions & Trade-offs

**Supabase over custom backend**
Reduces time-to-market significantly. Risk: Supabase vendor lock-in. Mitigation: all business logic in Edge Functions (Deno), not in Supabase-specific features, making migration feasible if needed.

**Expo managed workflow**
Pro: OTA updates, simplified builds, no native code to maintain. Con: cannot use arbitrary native modules. If we need specialized audio for sound effects or background streak notifications, we'll need to eject to bare workflow. This is a known risk for Phase 2+.

**Children as DB rows, not Auth users**
Children have no credentials and cannot log in independently. The parent authenticates once per device; children are selected via the profile switcher. This eliminates child password management, recovery flows, and independent session complexity. Simplifies LGPD/COPPA compliance (no child email collection). One-time parent login per device is acceptable UX for a family app.

**Batch challenge submission**
All 20 answers submitted at once at session end, not per-question. Pro: 1 network call vs 20, works better offline. Con: if session is abandoned, partial answers aren't saved until the next checkpoint. Mitigation: checkpoint writes to AsyncStorage at each block boundary.

**Client-side question generation**
Questions generated client-side from a deterministic seed. Server validates the seed during `complete_challenge`. Pro: zero latency between questions, works offline. Con: requires server-side re-implementation of the generator for validation. Mitigation: share the generator algorithm as a shared TS module (used in both app and Edge Function).

**Optimistic XP UI**
XP animations fire immediately on the client based on local calculation. The server response confirms or corrects. Pro: snappy UX. Con: if server rejects (e.g., duplicate session), the animation was "wrong". Mitigation: make `complete_challenge` idempotent with a session UUID; any retry returns the same XP amount.

---

## 9. Design System

From screenshots:

- **Primary**: Blue (`#2D4EF5` approx) — headers, primary buttons, active tab
- **Accent**: Orange (`#F56B2D` approx) — Challenge FAB, streak indicator, milestone highlights
- **Success**: Green — correct answer feedback, completed calendar days
- **Error/Fail**: Red — wrong answer indicator, failed calendar days
- **Tiers**: Bronze, Prata (Silver), Ouro (Gold), Diamante (Diamond)
- **Avatars**: 6 predefined 3D-style characters (data-driven catalog, not hardcoded)
- **Fonts**: Rounded sans-serif, child-friendly
- **Level reward types**: Frame (moldura), Outfit (roupa/capa), Medal (medalha), Trophy variant, Celebration effect

---

## 10. What This Architecture Does NOT Include (intentionally)

- No push notification service for MVP (can add Expo Notifications in Phase 9)
- No analytics SDK (Amplitude/Mixpanel) for MVP — Supabase logs + custom events table is enough
- No CDN for assets — Supabase Storage serves avatars directly (fine at MVP scale)
- No background sync process — foreground-only sync queue is sufficient
- No global leaderboard — friends-only ranking only in MVP
- No admin panel — Supabase Studio serves this purpose during early stage
