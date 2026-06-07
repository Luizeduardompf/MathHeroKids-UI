# Math Hero Kids
## Product Requirements Document (PRD)
### Version 1.1 – Official Project Specification

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

- Registration
- Login
- Forgot Password

Child:

- Created under parent account
- Username-based identity

Guest Mode:

- Local-only progress
- No cloud synchronization
- No social features

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

- 5 seconds
- 10 seconds
- 15 seconds
- 20 seconds
- 30 seconds
- Unlimited

Default:

15 seconds

---

# 14. Multiplication Configuration

Configurable by parent.

Ranges:

- 1–10
- 1–12
- 1–15
- 1–20
- Custom

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

- XP may be granted
- Historical completion is recorded
- Lost streaks are not restored

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
