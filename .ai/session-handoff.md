# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-10 23:55

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: e4c6da4
```

### ✅ Concluído nesta sessão (2026-06-10 — continuação)

**Confetti — animação corrigida:**
- `CorrectOverlay.tsx` (`ConfettoPiece`): adicionado `opacity` sharedValue com `withDelay` fade-out nos últimos 35% da queda — peças somem antes de empilhar no fundo
- `[date].tsx` (MilestoneScreen): confetti estático substituído por `MilestoneConfettoPiece` animado — mesma física fall + fade do CorrectOverlay
- Quirk documentado: `withDelay` precisa de `@ts-expect-error` neste tsconfig (mesmo padrão do `Easing`)

**StatusScreens redesign:**
- `MILO_PLACEHOLDER` (ícone verde do app) → `milo-celebrate.png` (mascote real)
- `EntranceView` wrapper: slide-up + fade-in nas 3 telas (TimeExpired, WrongAnswer, BlockEnd)
- Reanimated imports adicionados ao StatusScreens.tsx

**Calendar screen — implementação completa (`app/(app)/(tabs)/calendar.tsx`): ✅ FUNCIONANDO**
- Header fixo (fora do ScrollView) com `useSafeAreaInsets` — sem barra cinza no status bar
- MiloMessage contextual ao streak
- Stats cards horizontal pixel-faithful: `StreakCard` (gradient laranja, flame em círculo semi-transparente) + `RecordCard` (branco, trophy em círculo âmbar)
- Calendário mensal: mês actual + 3 meses anteriores em lista vertical
- Estados por dia: ⭐ perfeito (star amarelo), 🏆 completo (trophy verde), 🏆 incompleto (trophy vermelho/rosa), 🔵 hoje, 🔒 bloqueado/futuro
- Legenda em rodapé
- `useFocusEffect` invalida query ao entrar no ecrã
- Query range: 4 meses numa só chamada Supabase

**Calendar — fallback AsyncStorage (EF não deployada):**
- `challenge.service.ts`: `storeLocalCompletion()` + `getLocalCompletions()` — persistência local por `(childId, challengeDate, isPerfect)`
- `[date].tsx handleComplete`: chama `storeLocalCompletion()` ANTES da EF → dado garantido mesmo se EF falha
- `calendar.tsx buildDayGrid`: prioridade `calendar_days` > `challenge_sessions` > **AsyncStorage local** > today > future > missed
- RLS de `calendar_days` e `challenge_sessions` só tem SELECT — escrita directa do client bloqueada; AsyncStorage é a solução correcta

### ⚠️ Issues conhecidos

**expo-av incompatível com SDK actual:**
- Sons comentados em `CorrectOverlay.tsx` com TODO
- Fix: `rm -rf node_modules/expo-av ~/Library/Developer/Xcode/DerivedData && cd ios && pod deintegrate && pod install`

**Edge Functions não deployadas:**
- `start_challenge` e `complete_challenge` só em código local
- Calendar usa AsyncStorage como fallback (funciona correctamente)
- XP/level/streak NÃO são actualizados enquanto EF não estiver deployada

**Git locks virtiofs:**
- Fix: `find .git -name "*.lock" | while read f; do mv "$f" "${f}.gone"; done`

**Avatares — tamanho dos PNGs:**
- ~1.2MB cada (6 ficheiros = ~7.2MB no bundle)
- Não bloqueia MVP; optimizar com `sharp` antes de produção

### ⏭️ Próximos passos

**A (prioridade alta — PRÓXIMA TAREFA) — Friends screen:**
- Design disponível em `design/exports/06-friends.zip`
- Única tab ainda placeholder
- Implementar lista de amigos, pedidos pendentes, pesquisa por username

**B — Phase 2/3 — Edge Functions + Gamification:**
- Deploy `start_challenge` + `complete_challenge` no Supabase
- Ligar XP/level/streak/trophies a dados reais (Phase 3)
- Level Up modal (post-challenge se level mudou)

**C — Optimização de assets:**
- Redimensionar avatares PNG para ≤200KB cada
- Considerar `expo-image` para cache automático
