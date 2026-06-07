# Session Handoff

> Actualizar este ficheiro no final de cada sessão (ou quando o contexto estiver a acabar).
> Um novo Claude lê isto e retoma sem explicação do utilizador.

---

## Última sessão: 2026-06-07

### O que foi feito nesta sessão
- Phase 0 + Phase 1 completas (foundation + auth)
- `src/services/auth.service.ts` e `child.service.ts` criados
- Navigation guard em `app/(app)/_layout.tsx` e `app/index.tsx`
- Telas wired: login, register/parent (com checkbox terms), register/child, forgot-password, profile-select
- `backend/` scaffolded: Edge Functions (Deno), migrations SQL completas (001 + 002), seeds
- Supabase CLI instalada em `.bin/supabase`, autenticada, projecto linkado
- Git configurado (HTTPS + PAT, sem lock conflicts)
- Expo Go testado no Simulator — precisa actualizar para SDK 56 (pressionar `i` no expo start)
- `enable_confirmations` desactivado no Supabase dashboard
- `.scripts/` criada (gitignored) para automações do agente
- Commit: `fa7dc18` — "Phase 0+1: foundation, auth, services, backend scaffold, project structure"

### Estado actual
- **Phase 1: COMPLETA** ✅
- **Phase 2: NÃO INICIADA** — Challenge Engine é o próximo passo

### Próximo passo imediato
Iniciar **Phase 2 — Challenge Engine**. Ver `docs/implementation-phases.md` §Phase 2.

Entregáveis principais:
1. `src/stores/challenge.store.ts` — estado da sessão de desafio
2. `src/lib/question-generator.ts` — gerador de questões client-side (seed determinístico)
3. `app/(app)/challenge/[date].tsx` — tela de gameplay completa
4. `backend/functions/complete_challenge/index.ts` — Edge Function (Deno) com lógica completa
5. `backend/functions/start_challenge/index.ts` — Edge Function

### Issues/decisões pendentes
- Expo Go no Simulator desactualizado — utilizador precisa pressionar `i` no terminal do expo start
- `node_modules/.bin/` não sobrevive entre sessões do sandbox — correr `npm install --legacy-peer-deps` no início se necessário
- `enable_confirmations = false` já configurado no Supabase (não exige email de confirmação)

---

## Como retomar numa nova sessão

1. Ler este ficheiro + `CLAUDE.md` + `.ai/project-mathhero.md`
2. Correr o script de setup: `.scripts/session-setup.sh` (via Bash tool)
3. Verificar git status: `git status --short`
4. Continuar com o próximo passo acima
