# Math Hero Kids — Implementation Phases

Each phase produces a working, testable vertical slice. Phases are ordered by dependency and risk.

---

## Phase 0 — Foundation (Week 1–2)

**Goal**: Project scaffolding, design system, CI/CD.

Deliverables:
- Expo project with TypeScript strict mode
- Expo Router navigation skeleton (all routes, empty screens)
- Supabase project provisioned (dev + prod environments)
- All DB tables created with migrations (see `database-schema.md`)
- RLS policies active on all tables
- Edge Function scaffolding (empty handlers)
- Design system implemented: colors, typography, spacing tokens, base components (Button, Input, Card, Avatar)
- i18n setup: `pt`, `en`, `es`, `fr` skeleton files
- CI: lint, type-check, unit test runner (Jest + Testing Library)
- EAS Build configured

No app features. Only infrastructure.

---

## Phase 1 — Auth & Profiles (Week 3–4)

**Goal**: A parent can register, log in, and create child profiles. Profile switcher works.

Screens:
- Welcome, Login, Forgot Password
- Parent Registration (Step 1)
- Child Registration (Step 2)
- Profile Switcher ("Quem está jogando?")

Backend:
- Supabase Auth (email/password) for parents
- `parent_profiles` creation on auth signup (DB trigger)
- `child_profiles` CRUD (create, read, update — no delete in MVP)
- Child username uniqueness validation
- Child password hash (bcrypt via Edge Function — NOT client-side)
- Parent PIN: set + verify (bcrypt, Edge Function)
- RLS: verify parent isolation

State:
- `authStore` (Zustand): parent session
- `profileStore`: active child profile
- Persistence: auth token via Expo SecureStore; active child ID via AsyncStorage

Testing:
- Registration happy path
- Duplicate username rejection
- Wrong PIN lockout (after N attempts)
- RLS: parent cannot read another parent's children

---

## Phase 2 — Challenge Engine (Week 5–7)

**Goal**: A child can complete a daily challenge end-to-end with XP awarded.

Screens:
- Challenge screen (active gameplay)
- Correct/Wrong/TimeExpired/BlockIncomplete feedback overlays
- Milo milestone moments (Q5, Q10, Q15)
- Challenge Completed screen

Backend (Edge Functions):
- `start_challenge`: create/resume `challenge_sessions` row; idempotent
- `submit_answer`: validate answer, insert `challenge_answers`, award per-question XP, return next question
- `complete_challenge`: award completion XP, update `child_profiles.xp_total`, check level up, update `calendar_days`, update streak
- Question generator: multiplication `a × b` where a,b ∈ [1, multiplication_max], no repeat within session

Local:
- Offline queue: if `submit_answer` fails (no network), buffer locally and sync on reconnect
- Timer implemented client-side; server validates total session time on completion

State:
- `challengeStore`: current session, current question index, answers buffer, timer state

Testing:
- 20 questions flow, correct XP sum
- Time expiry handling
- Exit mid-challenge: progress preserved to last submitted question
- Offline: complete challenge offline → sync on reconnect → XP correctly awarded once
- Retroactive challenge: completing past day records correctly, does not restore streak

---

## Phase 3 — Gamification Core (Week 8–9)

**Goal**: XP, levels, streaks, trophies, achievements all update correctly after challenges.

Backend (Edge Functions / DB triggers):
- Level-up detection: compare `xp_total` against `level_thresholds`; update `child_profiles.level`
- Streak update: consecutive day check; update `current_streak`, `best_streak`, insert `child_streaks`
- Trophy progress: evaluate all trophy conditions after each challenge completion
- Achievement unlock: evaluate all achievement conditions after each challenge completion
- `child_xp_ledger` append for all XP events

Screens:
- Level Up Celebration modal (fires post-challenge if level changed)
- Trophy Room (full list, tap for detail)
- Trophy Detail
- Achievements screen
- Level Progression screen
- Level Rewards screen

Testing:
- Exact XP amounts per event type
- Level up fires at correct threshold
- Streak breaks on missed day, does NOT restore on retroactive
- Trophy: Daily awarded after 1 completion, weekly after 7/7, monthly after 30/30
- Achievement unlock is idempotent (only fires once)

---

## Phase 4 — Calendar (Week 10)

**Goal**: Calendar screen fully functional with all day states.

Screens:
- Calendar screen (infinite scroll month navigation)
- Tap past day → retroactive challenge flow

Backend:
- `calendar_days` populated by `complete_challenge` Edge Function
- Past days with no session row = "future" or "failed" depending on date

Testing:
- Calendar shows correct state for completed, failed, in_progress, perfect days
- Monthly progress % is accurate
- Weekly progress bar is accurate
- Retroactive challenge updates calendar day state correctly

---

## Phase 5 — Social (Week 11–12)

**Goal**: Friends system, friend requests, friend rankings.

Screens:
- Friends list (with pending requests)
- Add Friend / Search
- Friends Ranking (weekly + monthly toggle)

Backend:
- Friend request send/accept/reject/cancel (via Edge Functions; not direct writes to prevent abuse)
- Friend ranking: `weekly_rankings` populated by scheduled Edge Function (every midnight UTC)
- Friend suggestion algorithm (friends-of-friends, same level range) — simple implementation first
- Realtime: friend request badge via Supabase Realtime channel subscription

Testing:
- Can't friend self
- Duplicate request rejection
- Accept → bidirectional friendship rows created
- Reject → request closed, can re-send after 24h (anti-abuse)
- Ranking correctly sorted by weekly XP

---

## Phase 6 — Dashboard & Home Polish (Week 13)

**Goal**: Home dashboard fully assembled with all sections.

Screens:
- Home Dashboard (all 7 sections functional)
- Statistics section
- Friends activity preview

Polish:
- Milo motivation messages (contextual: streak ongoing, streak broken, challenge done today, challenge not done)
- Header profile switcher dropdown (quick switch without going to full switcher screen)

---

## Phase 7 — Settings & Parent Controls (Week 14)

**Goal**: Settings screen and parent area fully functional.

Screens:
- Settings (Ajustes) — language, timer, multiplication max
- Parent PIN gate
- Parent Controls (per-child settings)
- Add Child (from parent area)
- Edit Child Profile

Testing:
- Timer change takes effect on next challenge (not current)
- Language change re-renders all strings immediately
- Child profile edit: username uniqueness still validated
- PIN: brute-force protection (lockout after 5 wrong attempts, 30min timeout)

---

## Phase 8 — Offline Support & Sync (Week 15)

**Goal**: App works without internet; data syncs when reconnected.

Implementation:
- Expo SQLite local mirror for: `challenge_sessions`, `challenge_answers`, `child_profiles` (read cache)
- Sync queue: outbound mutations queued when offline
- Conflict resolution: server wins for XP and streaks (server-authoritative); local wins for abandoned sessions
- Network state hook: show offline banner
- Optimistic updates for challenge UI (XP animations fire immediately, reconciled on sync)

Testing:
- Full challenge offline → reconnect → data synced, XP correct, no duplicates
- Multiple offline challenges → all synced in order
- Server-side idempotency keys on Edge Functions (re-submitting same session is safe)

---

## Phase 9 — QA, Performance & Launch Prep (Week 16–17)

- E2E tests (Detox): registration → challenge → level up flow
- Performance: FlatList virtualization for calendar, friends list
- Bundle size audit (Expo bundle analyzer)
- Accessibility: VoiceOver / TalkBack basics
- Push notification setup (Expo Notifications): daily challenge reminder
- App Store / Play Store submission preparation
- Privacy policy, terms of service
- LGPD / COPPA compliance review

---

## Dependency Map

```
Phase 0 (Foundation)
  └─→ Phase 1 (Auth)
        └─→ Phase 2 (Challenge Engine)
              ├─→ Phase 3 (Gamification)
              │     ├─→ Phase 4 (Calendar)
              │     └─→ Phase 5 (Social)
              │           └─→ Phase 6 (Dashboard)
              └─→ Phase 7 (Settings)     ─→ Phase 8 (Offline)
                                                └─→ Phase 9 (QA/Launch)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Offline sync conflicts (double XP) | Medium | High | Idempotency keys on all Edge Functions |
| Streak calculation edge cases (timezone) | High | Medium | Store all dates in UTC; apply timezone offset client-side for display only |
| Child PIN brute-force | Medium | High | Server-side rate limiting + lockout on Edge Function |
| Supabase Realtime at scale (rankings) | Low | Medium | Pre-compute rankings in scheduled job; Realtime only for notifications |
| App Store rejection (child data) | Medium | High | COPPA/LGPD review before submission; parental consent checkbox at registration |
| XP manipulation via network interception | Medium | High | All XP mutations via Edge Functions; client never writes XP directly |
