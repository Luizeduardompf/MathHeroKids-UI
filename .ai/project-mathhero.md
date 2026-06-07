# Math Hero Kids UI — Estado do Projeto

Repositório: `/Users/claudecode/Documents/Claude/Projects/MathHeroKids-UI`
App mobile **iOS + Android** (sem web). Matemática gamificada para crianças (6–12 anos).

---

## Stack

React Native + Expo managed + TypeScript strict + Supabase + Expo Router + TanStack Query + Zustand + i18next (pt/en/es/fr) + Reanimated 3.

---

## Estrutura de pastas

```
app/          → Expo Router (frontend — telas)
src/          → Código React Native (frontend — services, stores, components, hooks, theme, types)
backend/      → Supabase server-side (Edge Functions Deno, migrations SQL, seeds)
docs/         → Documentação de produto e técnica (PRD, architecture, schema, phases, flows)
design/       → Mockups, exports, screenshots de design
assets/       → Assets Expo (ícones, splash, imagens estáticas)
.ai/          → Memória e contexto do agente IA (este directório)
CLAUDE.md     → Instruções para agentes IA (root do projecto)
```

---

## Status de Implementação (2026-06-07)

### Phase 0 — Foundation ✅ COMPLETO
Design system, Expo Router skeleton, i18n, Supabase client, Zustand stores, tema.

### Phase 1 — Auth & Profiles ✅ COMPLETO

- `src/services/auth.service.ts` — signUp, signIn, signOut, resetPassword (com error mapping para i18n keys)
- `src/services/child.service.ts` — listChildren, createChild, updateChild, deactivateChild, isUsernameAvailable
- `src/stores/profile.store.ts` — Zustand + AsyncStorage persist para activeChild
- `src/hooks/use-auth.ts` — limpa activeChild no signout via onAuthStateChange
- `app/index.tsx` — ponto de decisão de rota inicial (loading → welcome → profile-select → app)
- `app/(app)/_layout.tsx` — guard que bloqueia acesso sem auth ou sem activeChild
- Telas wired: login, register/parent (com checkbox terms), register/child (cria filho real no Supabase), forgot-password (com estado "enviado"), profile-select (filhos reais via TanStack Query)
- `backend/` scaffolded: functions (complete_challenge, start_challenge, verify_parent_pin, send/respond_friend_request), migrations 001+002, seeds/level_thresholds

### Phases 2–9 — Pendentes

Ver `docs/implementation-phases.md` para roadmap completo.

---

## Regras Críticas de Arquitetura

- **XP / progressão**: NUNCA mutados client-side — sempre via Edge Functions (`complete_challenge`)
- **Children**: NÃO são Auth users — autenticação = parent session + profile switcher client-side
- **Challenge**: 20 questões geradas client-side (seed determinístico), enviadas em batch no fim
- **Serviços**: telas não chamam `supabase` directamente — usam `src/services/` + TanStack Query
- **PIN parental**: bcrypt via Edge Function `verify_parent_pin` — nunca client-side
- **Rankings**: queries on-demand indexadas, não tabelas pré-computadas
- **Offline**: AsyncStorage sync queue — não SQLite (overengineering para MVP)
