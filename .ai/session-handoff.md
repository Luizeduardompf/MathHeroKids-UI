# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-06-08 23:20

### 🟢 Em curso
```
ESTADO: LIVRE
ÚLTIMO COMMIT: a11dd5b
```

### ✅ Concluído nesta sessão (2026-06-08 noite)

**Fix login silencioso:**
- `app/(auth)/_layout.tsx` — `AuthGuard` resolve race condition: após `signIn`, `index.tsx` não
  está montado (já foi substituído por `<Redirect>`). Guard observa `authStatus` e redireciona.

**ConfirmDialog reutilizável (`src/components/ui/ConfirmDialog.tsx`):**
- Props: `layout` (stack/row), variantes primary/destructive/neutral para cada botão
- Substitui `ExitModal` em `challenge/[date].tsx` e `ConfirmModal` em `settings.tsx`

**Settings do tutor sem activeChild:**
- `app/(app)/_layout.tsx` — `useSegments` + `PARENT_ONLY_ROUTES = ['settings']`
- `app/(profile-select)/index.tsx` — botão engrenagem top-right → settings

**Welcome screen pixel-fiel:**
- `app/(auth)/welcome.tsx` — card Milo, estrelas, feature pills, botões CTA
- `assets/images/milo-mascot.png` — extraído do zip de design
- ATENÇÃO: `@/` aponta para `src/` — assets usam caminho relativo `../../assets/`

**CorrectOverlay:**
- Confetti: componente `ConfettoPiece` individual (fix rules of hooks — nunca hooks em .map())
- Badge: `position: absolute` em `circleWrapper` — bordo superior-direito, drop-in animation
- `Easing`: `@ts-expect-error` (quirk tsconfig — named export não resolve)
- Som: comentado — `expo-av` incompatível com `expo-modules-core` desta versão do SDK

**Development build funcionando:**
- `npx expo run:ios` → app compila, ícone "Math Hero Kids" aparece no Simulator
- CocoaPods instalado após fix ownership: `sudo chown -R claudecode /opt/homebrew` (feito pelo utilizador admin)

### ⚠️ Issues conhecidos

**expo-av incompatível com SDK actual:**
- Erro: `EXAV.h: 'ExpoModulesCore/EXEventEmitter.h' file not found`
- Fix: `rm -rf node_modules/expo-av ~/Library/Developer/Xcode/DerivedData && cd ios && pod deintegrate && pod install && cd .. && npx expo run:ios`
- Após fix: descomentar `void playSuccessSound();` em `CorrectOverlay.tsx`
- **NUNCA** fazer `npx expo install expo-av` sem primeiro garantir compatibilidade de versão

**Edge Functions não deployadas:**
- `start_challenge` e `complete_challenge` só em código local
- Challenge usa fallback local (WARN no log — não é erro crítico)

**Git locks virtiofs:**
- Fix quando bloqueado: `find .git -name "*.lock" | while read f; do mv "$f" "${f}.gone"; done`
- Push rejeitado por non-fast-forward: usar `git push --force-with-lease` após verificar remote

### ⏭️ Próximos passos

**A — Fix expo-av (som):**
```bash
rm -rf node_modules/expo-av ~/Library/Developer/Xcode/DerivedData
cd ios && pod deintegrate && pod install && cd ..
npx expo run:ios
```
Depois descomentar `void playSuccessSound();` em `CorrectOverlay.tsx`.

**B — Phase 3 Gamification Core:**
Level Up modal, Trophy Room, Achievements, Progression.
Ver `docs/implementation-phases.md` §Phase 3.
