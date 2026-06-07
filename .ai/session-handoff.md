# Session Handoff

> **REGRA DO AGENTE:** Actualizar a secção "Em curso" ANTES de começar qualquer tarefa.
> Fazer `git add .ai/session-handoff.md && git commit -m "chore: update handoff"` a cada checkpoint.
> Assim, se o contexto acabar a meio, o próximo chat sabe exactamente onde parou.

---

## Estado actual — 2026-06-07 23:30

### 🔴 Em curso (actualizar ANTES de começar cada tarefa)
```
ESTADO: LIVRE — nenhuma tarefa em curso
ÚLTIMA ACÇÃO: fix definitivo do git lock (mv em vez de rm no virtiofs)
```

### ✅ Concluído nesta sessão
- Phase 0 + Phase 1 completas (foundation + auth + navigation guard)
- `src/services/auth.service.ts` + `child.service.ts` criados e wired
- Telas: login, register/parent, register/child, forgot-password, profile-select (dados reais)
- `backend/` scaffolded: Edge Functions (Deno), migrations SQL 001+002, seeds
- Supabase CLI em `.bin/supabase`, autenticada, `enable_confirmations` desactivado
- Git: fix definitivo virtiofs — `mv` em vez de `rm`, alias `git fix-locks`, `session-setup.sh`
- Sistema de handoff criado: `.ai/session-handoff.md`, `.scripts/session-setup.sh`, CLAUDE.md com instruções de retoma
- Commits: `fa7dc18`, `6eb987f`, `a622074`

### ⏭️ Próximo passo imediato
Iniciar **Phase 2 — Challenge Engine**. Ver `docs/implementation-phases.md` §Phase 2.

Entregáveis:
1. `src/stores/challenge.store.ts` — estado da sessão (questão actual, respostas, timer)
2. `src/lib/question-generator.ts` — gerador client-side com seed `${child_id}:${date}:${module_id}`
3. `app/(app)/challenge/[date].tsx` — gameplay completo (20 questões, 4 blocos, overlays)
4. `backend/functions/complete_challenge/index.ts` — Edge Function Deno (XP, streak, trophies)
5. `backend/functions/start_challenge/index.ts` — Edge Function Deno

### ⚠️ Issues conhecidos
- Expo Go no Simulator precisa de actualização para SDK 56 — pressionar `i` no `expo start`
- `node_modules/.bin/` pode não existir ao início — `session-setup.sh` trata disso
- Git warnings `unable to unlink tmp_obj_*` são normais no virtiofs — não bloqueiam

---

## Como retomar numa nova sessão

```bash
bash /sessions/wonderful-trusting-lamport/mnt/MathHeroKids-UI/.scripts/session-setup.sh
```

Depois ler a secção "Em curso" acima — se não estiver LIVRE, há trabalho incompleto.

---

## Protocolo do agente (OBRIGATÓRIO)

### Antes de iniciar qualquer tarefa:
```bash
# 1. Actualizar "Em curso" neste ficheiro com o que vai fazer
# 2. Commit imediato do handoff
cd /sessions/wonderful-trusting-lamport/mnt/MathHeroKids-UI
git fix-locks
git add .ai/session-handoff.md
git commit -m "chore: handoff — iniciando [nome da tarefa]"
git push origin main
```

### Durante implementação longa (a cada ficheiro concluído):
```bash
git add -A
git commit -m "wip: [descrição do que foi feito até agora]"
git push origin main
# Actualizar "Em curso" com progresso
```

### Ao concluir:
```bash
# Actualizar "Em curso" → LIVRE
# Mover tarefa para "Concluído"
git add -A
git commit -m "feat/fix/chore: [descrição completa]"
git push origin main
```
