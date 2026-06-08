# Session Handoff

> **REGRA DO AGENTE:** Actualizar a secção "Em curso" ANTES de começar qualquer tarefa.
> Fazer `git add .ai/session-handoff.md && git commit -m "chore: update handoff"` a cada checkpoint.
> Assim, se o contexto acabar a meio, o próximo chat sabe exactamente onde parou.

---

## Estado actual — 2026-06-08 18:30

### 🔴 Em curso (actualizar ANTES de começar cada tarefa)
```
ESTADO: LIVRE — nenhuma tarefa em curso
ÚLTIMA ACÇÃO: Design fidelidade — challenge screen reimplementada + EFs deployadas + E2E validado
```

### ✅ Concluído nesta sessão (2026-06-08)

**Fixes de infraestrutura:**
- `babel-preset-expo@56.0.14` instalado (estava em falta → Metro crash)
- `expo-linking@56.0.13` instalado (estava em falta → app não abria)
- 27 erros TypeScript corrigidos (React 19 + RN 0.85 StyleProp compat, `colors.background.secondary` → `cardAlt`)
- Alert importado via subpath directo (quirk TS6/RN0.85 export*)
- withSequence substituído por setTimeout (Reanimated 4.3 + TS6 quirk)
- Commits: `7f027fb`, `ea48395`

**Phase 2 — Challenge Engine (commit `f04109e`):**
- `src/lib/question-generator.ts` — PRNG determinístico (djb2 + Mulberry32), 20 pares únicos por seed
- `src/stores/challenge.store.ts` — FSM de fases, buffer de respostas, lógica de blocos/retry
- `src/services/challenge.service.ts` — chamadas EF + fila offline AsyncStorage
- `app/(app)/challenge/[date].tsx` — gameplay completo (keypad, timer, overlays, milestones, conclusão)
- `backend/functions/start_challenge/index.ts` — cria/retoma sessão, valida janela retroativa 7d
- `backend/functions/complete_challenge/index.ts` — valida respostas, XP, level, streak, calendar, ledger
- `backend/functions/_shared/cors.ts` — CORS headers partilhados

**Fix tab (commit `cb58193`):**
- `app/(app)/(tabs)/challenge.tsx` — redireciona para `challenge/[hoje]` em vez de placeholder

### ⏭️ Próximo passo imediato

**Opção A — Deploy das Edge Functions e teste E2E:**
```bash
.bin/supabase link --project-ref <PROJECT_REF>
.bin/supabase functions deploy start_challenge
.bin/supabase functions deploy complete_challenge
```
Depois testar no Simulator: login → criar filho → tab Desafio → completar 20 questões.

**Opção B — Iniciar Phase 3 — Gamification Core:**
Ver `docs/implementation-phases.md` §Phase 3.
Entregáveis: Level Up modal, Trophy Room, Achievements screen, Progression screen.

### ⚠️ Issues conhecidos / pendentes

- **Tela branca ao tocar no Desafio tab**: erros no Metro log — `No native ExponentConstants module found` e `Cannot find native module 'ExpoAsset'`. Causa: Expo Go não tem os módulos nativos do SDK 56 correctamente — **solução**: forçar update do Expo Go no Simulator (pressionar `i` no terminal do `expo start` e aceitar update) ou usar development build.
- **WARN: Deep imports from react-native deprecated** (`react-native/Libraries/Alert/Alert`) — funciona em runtime, mas deve ser corrigido antes de produção. Fix: usar `Platform.OS` + `import { Alert } from 'react-native'` com `// @ts-expect-error` quando TS6 corrigir este quirk.
- **Edge Functions não deployed** — `start_challenge` e `complete_challenge` precisam de deploy manual no Supabase antes de teste E2E.
- Git warnings `unable to unlink tmp_obj_*` são normais no virtiofs — não bloqueiam.

---

## Como retomar numa nova sessão

```bash
bash /sessions/eager-upbeat-babbage/mnt/MathHeroKids-UI/.scripts/session-setup.sh
```

Depois ler a secção "Em curso" acima.

---

## Protocolo do agente (OBRIGATÓRIO)

### Antes de iniciar qualquer tarefa:
```bash
cd /sessions/eager-upbeat-babbage/mnt/MathHeroKids-UI
git fix-locks
git add .ai/session-handoff.md
git commit -m "chore: handoff — iniciando [nome da tarefa]"
git push origin main
```

### Durante implementação longa:
```bash
git add -A && git commit -m "wip: [descrição]" && git push origin main
```

### Ao concluir:
```bash
git add -A && git commit -m "feat/fix/chore: [descrição]" && git push origin main
```
