# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-10 20:30

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: 3b0b843
```

### ✅ Concluído nesta sessão (2026-06-10)

**Visual polish — Design system:**
- `Button`: sombra colorida por variante, prop `icon`, animação Y no press
- `Card`: `radius['2xl']`, border sutil 1px, scale spring no press
- `Badge`: border colorida por variante, prop `icon`

**Visual polish — Tab bar:**
- FAB: `LinearGradient` laranja, sombra colorida, spring scale no focus
- Tab icons: spring scale 1→1.15 ao focar (Reanimated 4)
- Quirk: `tabBarItemStyle` requer `@ts-expect-error` nesta versão expo-router

**Visual polish — Home dashboard:**
- Challenge card: `LinearGradient` verde escuro + círculos decorativos
- Streak pill laranja: `LinearGradient`
- Stats grid: ícones com fundo tintado por cor
- MiloMessage: gradiente + speech bubble branco separado + Image real do mascote

**Visual polish — Auth screens:**
- Novo `AuthScreen` component (`src/components/layout/AuthScreen.tsx`): header `LinearGradient` + back button + body scrollável
- Welcome: mascote em círculo com ring, fundo `LinearGradient`, CTAs com `Button`
- Login, Register Parent, Register Child: migrados para `AuthScreen` + form em `Card`
- `Input`: `radius.md → radius.xl`

**Visual polish — Gamification (telas construídas do zero):**
- `progression.tsx`: card azul gradient com nível dourado, XP bar, timeline marcos
- `trophy-room.tsx`: stats row dourado/laranja, próximo troféu com progress, grid 3-col por categoria
- `achievements.tsx`: progresso geral com %, grid 2-col earned/locked

**Settings redesign:**
- Header `LinearGradient`
- Section icons tintados (globo/timer/×/people)
- Language grid 2×2 com border + check circle
- Botão editar (lápis) no ParentCard → `/(app)/parent-area/edit-profile`
- PIN gate também com gradiente

**Nova tela: `/(app)/parent-area/edit-profile.tsx`:**
- Nome editável (salva em `auth.updateUser` + `parent_profiles`)
- Email read-only com badge "fixo"
- Card separado para redefinição de senha

**Avatares reais (PNG 3D):**
- Extraídos de `07-Authentication-Onboarding.zip` → `assets/images/avatars/`
- 6 personagens: sofia, lucas, luna, mia, pedro, theo (substituindo gabriel + ana)
- `AVATAR_IDS` actualizado em `config.ts`
- `Avatar.tsx` reescrito com `Image` (static require map — Metro exige paths estáticos)
- `AvatarPicker` component novo (`src/components/ui/AvatarPicker.tsx`) — grid com PNG real + check badge
- Usado em: `register/child`, `add-child`, `parent-area/child/[id]`

**Bug fix:**
- Botão "+ Adicionar criança" no profile-select: criada `/(profile-select)/add-child.tsx` fora do grupo `(auth)` (AuthGuard bloqueava acesso autenticado); invalida query `['children', parentId]` após criar filho

### ⚠️ Issues conhecidos

**expo-av incompatível com SDK actual:**
- Sons comentados em `CorrectOverlay.tsx` com TODO
- Fix: `rm -rf node_modules/expo-av ~/Library/Developer/Xcode/DerivedData && cd ios && pod deintegrate && pod install`

**Edge Functions não deployadas:**
- `start_challenge` e `complete_challenge` só em código local
- Challenge usa fallback local (WARN no log — não é erro crítico)

**Git locks virtiofs:**
- Fix: `find .git -name "*.lock" | while read f; do mv "$f" "${f}.gone"; done`

**Avatares — tamanho dos PNGs:**
- ~1.2MB cada (6 ficheiros = ~7.2MB no bundle)
- Considerar optimização com `sharp` ou `expo-image` com cache em produção
- Não bloqueia MVP

### ⏭️ Próximos passos

**A — Phase 2/3 — Edge Functions + Gamification:**
- Deploy `start_challenge` + `complete_challenge` no Supabase
- Ligar XP/level/streak/trophies a dados reais (Phase 3)
- Level Up modal (post-challenge se level mudou)

**B — Telas restantes com design:**
- Calendar screen (design: `03-home-dashboard-calendar.zip`)
- Friends screen (design: `06-friends.zip`)

**C — Optimização de assets:**
- Redimensionar avatares PNG para ≤200KB cada
- Considerar `expo-image` para cache automático
