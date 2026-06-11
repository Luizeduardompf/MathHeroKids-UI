# Decisões Técnicas Confirmadas

Padrões arquitecturais já decididos — seguir sem propor alternativas salvo justificação forte.

---

**Ler `docs/` antes de implementar qualquer coisa.**
O projecto tem PRD, architecture.md, database-schema.md e implementation-phases.md.
Desviar sem justificativa é desperdício.

---

**Não usar SQLite para offline.** AsyncStorage sync queue é a decisão tomada.
SQLite = overengineering (schema migration client-side, conflict resolution bi-direccional).
Ver `docs/architecture.md` §4.3. Phase 8 usa AsyncStorage queue para challenge sessions pendentes.

---

**Não usar tabelas pré-computadas para rankings.** Query indexada on-demand.
Premature optimization para o scale do MVP. Ver `docs/architecture.md` §6.
Rankings via JOIN em `child_xp_ledger`. Sem scheduled Edge Functions para rankings.

---

**Edge Functions apenas onde XP/progressão é mutada.** Leitura = query Supabase directa.
Segurança anti-cheat: XP mutations via EF são o mecanismo principal de integridade.
Ao implementar qualquer feature: escrita de progressão → Edge Function; leitura → TanStack Query.

---

**Telas não chamam `supabase` directamente.** Usar `src/services/` + TanStack Query.
Separação de concerns, testabilidade, loading/error handling consistente.

---

**Diagnóstico de erros de módulos nativos no Expo Go:**
- `Cannot find native module 'ExpoAsset'` → Expo Go desactualizado no Simulator (não é problema de packages)
- `No native ExponentConstants module found` → mesmo problema
- `Invariant Violation: "main" has not been registered` → consequência do erro anterior
- Fix: no terminal do `expo start`, premir `i` → Expo CLI instala a versão correcta (~200MB, 1-2 min)
- Estes módulos nativos vivem **dentro do app Expo Go**, não nos node_modules JS

---

**Workflow do Simulator iOS:**
- O utilizador corre `npx expo start` no Terminal do Mac (projecto em `~/Documents/Claude/Projects/MathHeroKids-UI`)
- Metro URL: `exp://192.168.1.247:8081` (IP pode mudar, porta 8081 é fixa)
- Expo Go está instalado no Simulator (iPhone 17, iOS 26.5)
- **Atenção:** Expo Go no Simulator precisa de estar actualizado para SDK 56 — se der erro "incompatible", pressionar `i` no terminal do `expo start` para reinstalar automaticamente
- Depois de arrancado, o Claude navega a app autonomamente via computer-use (Simulator tem acesso full ✅)
- O Bash sandbox não consegue manter o processo Expo vivo entre chamadas — o utilizador tem de iniciar o servidor

---

**NUNCA correr `npm install` do sandbox Linux — sempre do Mac.**
O sandbox instala binários Linux incompatíveis com macOS e corrompe sub-packages do react-native (`@react-native/virtualized-lists`, `@react-native/assets-registry`, etc.). Se node_modules corrompido: no Terminal do Mac → `rm -rf node_modules package-lock.json && npm install && npx expo start --clear`. O session-setup.sh avisa mas NÃO instala.

---

**Scripts de automação do agente ficam em `.scripts/` (gitignored).**
Quando o Claude precisar de criar scripts para clicar/executar tarefas no Mac, guarda em `.scripts/`. A pasta está no `.gitignore` — não entra no repositório. Manter organizado com nomes descritivos (ex: `open-simulator.sh`, `run-migrations.sh`).

---

**Git via Bash tool apenas. Locks: usar `mv` nunca `rm`.**
O mount virtiofs (macOS→Linux sandbox) não suporta `unlink` — `rm -f` falha com "Operation not permitted" mesmo em ficheiros do próprio sandbox. `mv` (rename) funciona. Fix definitivo: alias `git fix-locks` usa `mv *.lock *.lock.bak`. Setup de sessão (`.scripts/session-setup.sh`) faz isso automaticamente. Git configurado: `gc.auto=0`, `maintenance.auto=false`, `core.lockTimeout=600`, `core.fsmonitor=false`. NUNCA usar GitHub Desktop em paralelo.

---

**expo-av NÃO é compatível com o expo-modules-core desta versão do SDK.**
- Erro ao fazer `npx expo install expo-av` + `pod install`: `EXAV.h: EXEventEmitter.h not found`
- Causa: `expo-av` espera versão mais antiga de `expo-modules-core` — incompatibilidade de headers nativos
- **Nunca instalar expo-av** sem primeiro verificar versão compatível com o SDK actual
- Fix de limpeza: `rm -rf node_modules/expo-av ~/Library/Developer/Xcode/DerivedData && cd ios && pod deintegrate && pod install`
- Som desactivado por agora — comentado em `CorrectOverlay.tsx` com TODO

---

**expo-av: nunca importar no top-level se existir risco de native module ausente.**
- `import { Audio } from 'expo-av'` no top-level crasha ao arrancar (Metro avalia na inicialização do bundle)
- `require('expo-av')` dinâmico dentro de async/try também falha — Metro resolve synchronously
- Único fix real: native module devidamente linked (EAS build ou `npx expo run:ios` com expo-av instalado)
- `import('expo-av')` async ESM é a abordagem mais segura mas ainda pode falhar se módulo não linkedado

---

**Rules of Hooks: nunca usar hooks dentro de .map() ou callbacks.**
- `useAnimatedStyle`, `useSharedValue`, etc. dentro de `.map()` → rules of hooks violation
- Fix: criar componente filho separado para cada item (ex: `ConfettoPiece`) que usa o hook correctamente
- Isto foi a causa do bug de confetti no `CorrectOverlay` — componente `ConfettiLayer` com `.map()` + hooks

---

**Alias `@/` aponta para `src/`, não para a raiz do projecto.**
- `tsconfig.json`: `"@/*": ["./src/*"]`
- Assets em `assets/` devem usar caminho relativo: `../../assets/images/foo.png`
- Nunca usar `@/assets/...` — Metro não resolve e dá erro em runtime

---

**`Easing` de react-native-reanimated: importar com `@ts-expect-error`.**
- Erro: `Module '"react-native-reanimated"' has no exported member 'Easing'`
- Causa: quirk do tsconfig deste projecto — named export não resolve correctamente
- Fix: `// @ts-expect-error reanimated Easing named-export quirk` + import separado
- Funciona correctamente em runtime — é apenas um quirk de tipos

---

**Git virtiofs: locks orphaned frequentemente.**
- Mount virtiofs (macOS → Linux sandbox) não suporta `unlink` — locks ficam permanentes
- Usar SEMPRE `mv` em vez de `rm` para locks: `mv file.lock file.lock.gone`
- Push non-fast-forward: `git push --force-with-lease` após confirmar que remote não tem commits críticos
- Nunca correr GitHub Desktop em paralelo com git do sandbox

---

**Development build: CocoaPods requer ownership correcto do Homebrew.**
- Problema: Homebrew instalado por outro utilizador → `/opt/homebrew` com owner errado
- Fix (requer utilizador admin do Mac): `sudo chown -R claudecode /opt/homebrew`
- Depois: `brew install cocoapods && cd ios && pod install && npx expo run:ios`
- O utilizador `claudecode` não tem sudo — operações que requerem sudo devem ser feitas pelo utilizador admin

---

**Supabase Edge Functions via Management API: NUNCA usar imports relativos.**
- Deploy via `/v1/projects/{ref}/functions` com `body` string único NÃO resolve `../\_shared/cors.ts`
- Fix obrigatório: inline todas as constantes partilhadas em cada EF (corsHeaders, etc.)
- `supabase functions deploy` com Docker resolve imports — mas Docker não disponível no sandbox Linux
- Padrão para novas EFs: tudo self-contained, sem imports de `_shared/`

---

**Nunito ExtraBold (800) + iOS 26: stylistic alternates distorcem letras e números.**
- iOS 26 activa OpenType stylistic sets no Nunito_800ExtraBold a tamanhos grandes (>20px)
- Fix: `fontVariant: ['tabular-nums']` em estilos numéricos; `fontFamily.bold` (700) em títulos grandes
- Aplicado globalmente no `Text` component base: `fontVariant: ['tabular-nums']` + `allowFontScaling={false}`
- Não afecta o Bold (700) — usar bold para headings grandes, reservar extraBold para tamanhos pequenos-médios

---

**app.json plugin `expo-notifications` só deve ser adicionado APÓS `npm install expo-notifications`.**
- Plugin no app.json é avaliado pelo Metro na inicialização — se o pacote não existir → crash imediato
- Nunca adicionar plugins ao app.json sem o pacote correspondente instalado

---

**complete_challenge EF: idempotency por (child_id, challenge_date, module_id), não só por session_id.**
- A tabela `challenge_sessions` tem unique constraint em (child_id, challenge_date, module_id)
- Se start_challenge criou uma session com UUID diferente, upsert por `id` viola a constraint → 500
- Fix: verificar por (child_id, date, module_id) primeiro; usar `effectiveSessionId` (o ID que existe no DB) em todos os inserts subsequentes
- Pattern: byDay query → byId fallback → effectiveSessionId = existingSession?.id ?? session_id

---

**send_friend_request EF: separar expo_push_token da query principal.**
- Selecionar `expo_push_token` na mesma query que verifica se a criança existe → falha se migration 003 não aplicada
- Pattern correto: query principal seleciona só `id, display_name`; após inserir o pedido, fetch separado + try/catch para o token
- Nunca colocar campos opcionais/migrados em queries de validação crítica

---

**Header pattern universal: LinearGradient + "Math Hero Kids" subtitle + chevron-back circle.**
- Todas as telas com header usam: `LinearGradient([primary, primaryDark])` + SafeAreaView edges top + headerRow com back button (circle 40x40 rgba 18%) + headerCenter (subtitle + title) + spacer (width:40)
- Alternativa: usar `AuthScreen` component (já tem o padrão correto) para telas com scroll/form
- Nunca usar `SafeAreaView` com fundo sólido ou `‹` texto como back button
- Referência: `friends/list.tsx` (manual) e `trophy-room.tsx` (AuthScreen) como exemplos correctos
