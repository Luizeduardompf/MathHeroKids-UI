# Math Hero Kids
## Product Requirements Document (PRD)
### Version 1.1 – Official Project Specification

> ⚠️ **Nota de estado (2026-08-05)**: este PRD é o documento de intenção original — mantido
> como está, não reescrito para bater certo com o código. A implementação real diverge em
> vários pontos concretos; para o estado atual, ver `architecture.md`, `database-schema.md`,
> `application-flows.md` e `open-questions.md` (que agora marca explicitamente o que já foi
> resolvido, resolvido-de-forma-diferente, ou confirmado como nunca implementado). Divergências
> mais relevantes: §11–14 (motor de questões — hoje é multi-operação e 100% server-side, não só
> multiplicação client-side), §19 (valores de XP são 2/resposta+4+10, não os descritos aqui),
> §20 (níveis vão até 100, não os valores exemplificados), §23–24 (existe chat entre amigos,
> ranking é só entre amigos, não global), §25 (notificações são via WhatsApp, não push nativo),
> §27 (offline foi abandonado — app é online-only para challenges).

# 1. Product Vision

Math Hero Kids is a gamified mathematics learning platform designed for children aged 6–12.

The goal is to transform mathematics practice into a daily habit through:
- Gamification
- Progression systems
- Achievements
- Trophies
- Streaks
- Friendly competition
- Social interaction
- Long-term engagement

Inspirations:
- Duolingo
- Pokémon
- Nintendo Games
- Khan Academy Kids

---

# 2. MVP Scope

Version 1.1 MVP includes:

- Parent Accounts
- Child Profiles
- Authentication
- Home Dashboard
- Daily Challenges
- Multiplication
- Calendar System
- XP System
- Levels
- Trophies
- Achievements
- Milo Mascot
- Friends System
- Weekly Ranking
- Monthly Ranking
- Parent Controls
- Offline Support
- Multi-language Support

---

# 3. Future Modules

Architecture must support:

- Division
- Addition
- Subtraction
- Fractions
- Decimals
- Mental Math
- Algebra Basics

All future modules must reuse the same progression framework.

---

# 4. Target Audience

Primary:
- Children aged 6–12

Secondary:
- Parents and Guardians

Future:
- Teachers
- Schools

---

# 5. Core Principles

The application must:

- Encourage daily practice
- Reward consistency
- Reward effort
- Make mistakes safe
- Promote confidence
- Promote social learning
- Create long-term engagement

The app must never punish children harshly.

---

# 6. Parent Account

Fields:

- Parent Name
- Parent Email
- Password

One parent account can manage multiple child profiles.

---

# 7. Child Profile

Fields:

- Username
- Display Name
- Birth Date
- Avatar

Each child has independent:

- XP
- Level
- Progress
- Statistics
- Friends
- Achievements
- Trophies
- Calendar

---

# 8. Multi Child Profile System

A single device may be shared by multiple children.

Examples:

- Family iPad
- Shared Android Tablet
- Parent Phone

Requirements:

- One-tap profile switching
- Netflix-inspired profile selector
- Fast child switching
- Individual progress per child

---

# 9. Authentication

Parent:

- Registration (email + password)
- Login (email + password)
- Forgot Password (email link)

Child:

- Created under parent account
- No independent login — always accessed via parent session + profile switcher
- No child password required; child identity is the profile selection, not an auth credential

Guest Mode:

- Local-only progress
- No cloud synchronization
- No social features

> **v1.1 decision**: Children do not log in independently. A parent logs in once per device (email + password via Supabase Auth); the family then uses the profile switcher to select which child is playing. Child does not need a password. Recovery of child profile data is always done through the parent account.

---

# 10. Dashboard

Main Dashboard includes:

- Child Avatar
- Current Level
- XP Progress
- Current Streak
- Best Streak
- Daily Challenge
- Weekly Progress
- Trophy Summary
- Friend Activity
- Milo Motivation Area

---

# 11. Daily Challenge System

Children are encouraged to complete one challenge per day.

Daily completion grants:

- XP
- Trophy Progress
- Achievement Progress
- Streak Progress

Focus:

Consistency over intensity.

---

# 12. Challenge Gameplay

Core challenge structure:

- 20 questions per challenge
- One question visible at a time
- Numeric keypad always visible
- No scrolling required
- Optimized for mobile devices

Screen Elements:

- Exit Button
- Question Counter
- Progress Bar
- Small Timer
- Question Area
- Numeric Keypad

No footer navigation during gameplay.

---

# 13. Timer System

Configurable by parent.

Options:

- 10 seconds (advanced / older children)
- 15 seconds (default)
- 20 seconds (beginner)
- 30 seconds (very young, ages 6–7)
- Unlimited (learning mode / first week)

Default:

15 seconds

> **v1.1 change**: Removed 5-second option (too short for children aged 6–7). Removed 45s and 60s options (too slow to have challenge value). Implemented as discrete pill/chip selector, not a slider.

---

# 14. Multiplication Configuration

Configurable by parent.

Ranges:

- 1–10
- 1–12
- 1–15
- 1–20

> **v1.1 change**: "Custom" range deferred to Phase 2. Not in MVP scope.

---

# 15. Feedback System

Correct Answer:

- Sound Effect
- Celebration Animation
- XP Reward
- Automatic Next Question

Incorrect Answer:

- Friendly Feedback
- Encouragement
- Retry Flow

Time Expired:

- Friendly Failure State
- Retry Option

---

# 16. Milo Mascot

Milo is the primary mascot.

Responsibilities:

- Motivation
- Celebration
- Emotional Engagement

Milo appears:

- Between questions
- During milestones
- During achievements
- During level ups

Milo should not occupy gameplay space during active answering.

---

# 17. Calendar System

Infinite scroll calendar.

Day States:

- Future
- Today
- Completed
- Failed
- In Progress

Visual Indicators:

- Trophy
- Completion
- Failure
- Perfect Week

---

# 18. Retroactive Challenges

Past days may be replayed.

Rules:

- Full XP awarded (same as a regular daily challenge)
- Available for the past 7 days only; older days are locked
- Historical completion is recorded in the calendar
- Lost streaks are NOT restored
- Counts toward cumulative trophy progress (e.g. monthly trophy "days completed")
- Does NOT unlock "perfect week" or "perfect month" trophies for windows that have already closed
- Does NOT count for friend ranking of past weeks

> **v1.1 decision**: 7-day retroactive window balances generosity (illness, travel) with preventing abuse (mass-completing months of challenges in one session).

---

# 19. XP System

XP Sources:

- Correct Answers
- Perfect Blocks
- Daily Completion
- Weekly Completion
- Achievements
- Trophies

---

# 20. Levels

Example Levels:

- Level 1 – Math Explorer
- Level 5 – Math Adventurer
- Level 10 – Math Champion
- Level 20 – Math Master
- Level 50 – Math Legend

---

# 21. Trophy System

Categories:

- Daily Trophy
- Weekly Trophy
- Monthly Trophy
- Champion Trophy

Trophies appear:

- Dashboard
- Calendar
- Trophy Room

---

# 22. Achievement System

Examples:

- First Victory
- 7-Day Streak
- 30-Day Streak
- 100 Correct Answers
- 1000 Correct Answers
- Perfect Week
- Perfect Month
- Speed Master

---

# 23. Friends System

Features:

- Search by Username
- Add Friend
- Accept Request
- Reject Request
- Remove Friend

Friend Profile:

- Avatar
- Level
- XP
- Trophy Count

---

# 24. Rankings

Weekly Ranking

Monthly Ranking

Ranking displays:

- Position
- Avatar
- XP
- Streak

---

# 25. Parent Controls

Protected by Parent PIN.

Parents can configure:

- Timer
- Multiplication Range
- Child Profiles
- Notifications
- Social Features

---

# 26. Internationalization

Supported Languages:

- English
- Portuguese
- Spanish
- French

All text must come from translation files.

---

# 27. Offline Support

Guest Mode:

- Local Storage

Authenticated Users:

- Cloud Synchronization

Application must continue working whenever possible without internet.

---

# 28. Technical Stack

Frontend:

- React Native
- Expo
- TypeScript

Backend:

- Supabase

Database:

- PostgreSQL

Authentication:

- Supabase Auth

---

# 29. Future Monetization

Potential Premium Features:

- Custom Avatars
- Special Themes
- Parent Reports
- Advanced Statistics
- School Mode

No pay-to-win mechanics.

---

# 30. Success Metrics

- Daily Active Users
- Weekly Active Users
- Monthly Retention
- Average Streak Length
- Completed Challenges
- Friend Participation

---

# 31. Long-Term Vision

Become the most engaging mathematics learning platform for children, combining educational effectiveness with game-quality engagement.
