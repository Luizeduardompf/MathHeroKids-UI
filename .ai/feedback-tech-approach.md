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

**`process.env[key]` com chave dinâmica NÃO funciona em builds Release/produção.**
- As `EXPO_PUBLIC_*` só são inlined pelo Babel quando escritas como acesso **estático literal**:
  `process.env.EXPO_PUBLIC_SUPABASE_URL` ✅ / `process.env[key]` ❌
- Em dev funciona (Metro popula `process.env` em runtime) → o bug fica invisível até ao primeiro build Release
- Num bundle Release não existe `process.env` para ler → `undefined` → `requireEnv()` faz throw → **crash imediato no arranque**
- Sintoma: app instala, abre e fecha logo. Crash log: `RCTFatalException: Missing required environment variable`
- Isto afectava **qualquer** build de produção (device local, EAS, App Store) — não era específico do iPhone
- Fix aplicado em `src/constants/env.ts` (sessão 11): `requireEnv(key, process.env.EXPO_PUBLIC_X)` — valor passado por argumento, acesso literal no call site
- **Regra: nunca aceder a `process.env` por chave computada.** Cada var tem de ser soletrada no código.
- Verificação rápida de que ficou inlined: `grep -a -o "https://[a-z0-9]*\.supabase\.co" <App>.app/main.jsbundle`

---

**Instalar no iPhone físico com conta Apple gratuita (Personal Team) — funciona, sem os $99.**
- O handoff antigo dizia que era preciso o Apple Developer Program: **falso**. Isso só é preciso para
  TestFlight, distribuição sem cabo (ad-hoc/OTA) e push notifications.
- Por cabo, com Personal Team, funciona. Limites: **app caduca em 7 dias**, sem push, máx. 3 apps por Apple ID.
- Comando (iPhone desbloqueado + Developer Mode on + cabo):
  `npx expo run:ios --device <UDID> --configuration Release --no-bundler`
- **Usar o UDID real** (`xcrun xctrace list devices`), não o UUID do coredevice do `devicectl list devices` — não são o mesmo e o Expo só aceita o UDID
- `--no-bundler` evita conflito de portas com outros projectos; num Release o JS vai embebido, não precisa de Metro
- O `-allowProvisioningUpdates` gera o perfil sozinho — **desde que o bundle ID esteja livre**. Se o registo do
  bundle ID falhar, o erro que aparece é o enganador "No profiles found / automatic signing disabled"
- Bundle ID `com.mathherokids.app` está registado por outra conta → inutilizável. Mudado para `com.luizeduardompf.mathherokids`
- Diagnosticar crash no device: `xcrun devicectl device process launch --device <UDID> --console --terminate-existing <bundleid>`
- Verificar se está viva: `xcrun devicectl device info processes --device <UDID> | grep -i <app>`

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

**Para Expo Go: usar apenas pacotes primeiro-party Expo SDK. Pacotes community crasham.**
- `@react-native-community/netinfo` NÃO está incluído no Expo Go runtime → crash ao arrancar
- Substituído por `expo-network` (`Network.getNetworkStateAsync()`) — primeiro-party, incluído no Expo Go
- `expo-network` não tem `addEventListener` → usar polling com `setInterval` (5s suficiente para UX de offline)
- `expo-av` também removido por incompatibilidade nativa (ver abaixo)
- Regra geral: antes de adicionar qualquer pacote community, verificar se está na lista de pacotes do Expo Go SDK

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

**`withRepeat` e `withSequence` precisam do mesmo padrão `@ts-expect-error` que `withDelay` e `Easing`.**
- Estes exports do react-native-reanimated não resolvem correctamente no tsconfig deste projecto
- Fix: import separado com `// @ts-expect-error reanimated withRepeat named-export quirk`
- Funciona correctamente em runtime — é apenas um quirk de tipos

---

**`StyleSheet.absoluteFill` / `absoluteFillObject` não existem nesta versão do RN.**
- Erro: `Property 'absoluteFill' does not exist on type...`
- Fix: usar spread manual `{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }`

---

**`useAnimatedStyle` retorna tipo incompatível com `StyleProp<ViewStyle>` — cast `as any` no valor.**
- Erro: `TS2769 No overload matches this call` ao passar animated style num array de styles
- Fix correcto: `const anim = useAnimatedStyle(() => ({ ... })) as any;` — cast no valor, não inline em JSX
- Cast inline em JSX (`[s.foo, anim as any]`) não funciona dentro de ternários JSX — causa syntax error

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

**Supabase Edge Functions: usar `npm:` specifiers, nunca `https://esm.sh/` nem `https://deno.land/x/`.**
- `https://esm.sh/@supabase/supabase-js@2` → causa BOOT_ERROR no runtime actual da Supabase
- `https://deno.land/x/bcrypt` → usa WASM + Worker threads, incompatível com o edge runtime
- Correcto: `import { createClient } from 'npm:@supabase/supabase-js@2'`
- Correcto: `import * as bcrypt from 'npm:bcryptjs'` (pure JS, sem WASM)
- `bcryptjs` exige salt rounds explícito: `bcrypt.hash(pin, 10)` — não tem default como o deno/bcrypt

---

**EFs: catch silencioso + fallback de insert directo é um anti-pattern perigoso.**
- Padrão errado: `try { ef() } catch { /* swallow */ }` + fallback client insert
- O catch esconde o erro real; o fallback falha sempre (RLS sem INSERT policy)
- O utilizador via um erro genérico que não correspondia ao problema real
- Correcto: sem catch silencioso; parsear `FunctionsHttpError.context.json()` para expor o código de erro da EF
- `friend_requests` não tem (nem deve ter) política RLS INSERT — a EF com SERVICE_ROLE_KEY é o único caminho válido

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

---

**Cliente NUNCA deve recalcular XP localmente com valores próprios — só ecoar `CHALLENGE.*` ou o
resultado real da EF.** (sessão 13, 2026-07-17)
- Descoberto ao reduzir os ganhos de XP (10/20/50 → 2/4/10 na EF): o cliente tinha 3 sítios com os
  próprios valores hardcoded (`selectSessionXp`: `*10`; `CorrectOverlay xpGain={10}`; tela de conclusão:
  `sessionXp + 200 + (perfeito?100:0)`), já divergentes da EF *antes* desta sessão (EF usava 20/50,
  cliente assumia 200/100 — nunca ninguém reparou porque o número real só aparece se houver level-up
  ou trophy).
- Regra: qualquer número de XP mostrado ANTES da resposta da EF (overlays optimistas, badges de preview)
  tem de vir de `CHALLENGE.XP_PER_CORRECT_ANSWER/XP_COMPLETION_BONUS/XP_PERFECT_BONUS` em `config.ts`
  (que por sua vez tem de ser mantido manualmente em sincronia com as constantes da EF — não há
  import cross-runtime entre Deno EF e RN app). Nunca literal solto tipo `+10`, `*10`, `+200`.
- Tabelas de threshold esparsas (nem todo nível tem entrada) precisam de lookup por "próximo threshold
  com level > current", nunca `level === current + 1` — este último falha silenciosamente em qualquer
  nível-planalto e cai no fallback errado (visto em 3 telas: `(tabs)/index.tsx`, `(tabs)/calendar.tsx`,
  `progression.tsx`). Helpers correctos: `getLevelXpFloor`/`getLevelXpCeil` em `config.ts`.

**Princípio confirmado pelo user (sessão 13, mesma sessão): "os XPs precisam sempre refletir a
realidade em tempo real, para não frustrar."** Mais dois bugs da mesma família encontrados a seguir
ao acima, ambos com o mesmo padrão — número mostrado ao user não bate com o que o servidor
realmente gravou:
- **`complete_challenge` calculava `newXpTotal` (cumulativo) e gravava-o em `child_profiles`, mas
  nunca o devolvia na resposta.** O cliente, sem esse valor, chamava
  `updateChildXp(result.session.xp_awarded, ...)` — o XP ganho só NAQUELA sessão — sobrescrevendo o
  total cumulativo cacheado localmente (`activeChild` em AsyncStorage) com um número bem menor.
  Fix: EF devolve `xp_total` no corpo da resposta (caminho normal e o de idempotência); cliente usa
  `result.xp_total`, nunca `result.session.xp_awarded`, para actualizar o saldo geral.
- **`start_challenge` só verificava se `questions_payload` existia, nunca se `status === 'completed'`**
  — reabria (e devolvia as mesmas perguntas de) um dia já concluído como se fosse resumível. O ecrã
  de conclusão mostra sempre um total optimista local (`sessionXp + bonuses`, calculado ANTES da
  EF confirmar) — para um dia já pago, esse número nunca correspondia a nada real, porque
  `complete_challenge` (correctamente idempotente por dia) devolvia o resultado antigo em cache sem
  somar XP outra vez. Fix: `start_challenge` devolve `409 ALREADY_COMPLETED` quando o dia já está
  feito, em vez de reabrir o payload.
- Bónus relacionado: o ecrã de milestone a meio da sessão (Q25%/50%/75%) calcula os checkpoints como
  percentagem de `totalQuestions` — com `CHALLENGE.TOTAL_QUESTIONS=5` (config DEV), isso colapsa para
  disparar a quase cada pergunta, e a tela é visualmente quase idêntica à de conclusão real (fundo
  cheio, confetti, badge XP, um botão "Continuar") — fácil de confundir com "já acabei" e sair a meio
  sem completar. Guard aplicado: milestone só é avaliado com `totalQuestions >= 10`.

**Regra geral daqui para a frente:** qualquer número de progressão (XP, nível, streak) no ecrã tem de
vir do resultado confirmado do servidor, ou estar claramente rotulado como provisório/em curso — nunca
um valor calculado no cliente apresentado como se já fosse definitivo. Ver também memória global
`feedback-xp-realtime-truth`.

---

**Cuidado ao testar aleatoriedade do `question-selector.ts` com uma criança nova e poucas sessões —
o "ciclo" de resultados repetidos pode ser o `crossSessionCooldown` a funcionar, não um bug de RNG.**
(sessão 15, 2026-07-17)
- Com uma criança nível 1 (só T1+T2 desbloqueados = 19+30 factos) e mastery vazio, todas as buckets
  WEAK/LEARNING/REVIEWING/MASTERED ficam vazias — a seleção reduz-se a "os N primeiros do bucket NEW
  ordenados por tiebreak seedado". `crossSessionCooldown=2` exclui os factos das últimas 2 sessões;
  com um pool pequeno, isto faz o conjunto de "disponíveis após exclusão" ciclar rapidamente entre
  poucas combinações — parece determinístico mesmo com RNG genuinamente aleatório.
- Antes de assumir bug de RNG: testar directo a Edge Function via `curl` com `session_id` e
  `challenge_date` genuinamente novos (nunca usados antes por aquela criança) — se as combinações
  variarem aí, o RNG está correcto e o que se viu no Simulator foi idempotência (`start_challenge`
  devolve o payload já persistido se a sessão daquele dia já existir) ou exaustão do pool pequeno.
- `mulberry32(seedFromString(seed))` foi validado directamente em Node com UUIDs reais — seeds
  diferentes dão sequências e *rankings relativos* bem diferentes; o algoritmo em si não tem bug.

---

**Ao tornar um valor antes fixo em configurável por criança, procurar TODOS os sítios que
assumiam o valor antigo — não só onde foi introduzida a config.** (sessão 15, Fase E, 2026-07-18)
Dois bugs reais encontrados só porque a bateria de teste da Fase E (curl directo à EF +
simulação de sessões mistas) forçou casos fora do caminho feliz de sempre-multiplicação-sempre-20:
- `complete_challenge`: `isPerfect = correctCount === rules.session.questionsPerChallenge` — desde
  a Fase C (`question_count` configurável por criança), qualquer criança sem o valor default (5)
  nunca conseguia "perfeito" mesmo acertando tudo, porque comparava contra o valor fixo da regra
  global em vez de `session.total_questions` (que já reflectia a config real desde a Fase C).
  Bug introduzido na Fase C, só apanhado na Fase E ao testar `question_count=10`.
- `challenge.store.ts` (`selectSessionXp`/`selectUniqueCorrectCount`/`selectBlockCorrectCount`) e
  o ecrã de fim de bloco recalculavam "está certo?" como `child_answer === operand_a * operand_b`
  em 3 sítios — óbvio para multiplicação, silenciosamente errado para +,−,÷. Fix: `AnswerDraft`
  ganha `correct_answer` (calculado uma vez via `computeAnswer` na criação da questão), os
  selectors comparam contra esse campo em vez de recalcular.
**Regra:** ao adicionar uma dimensão nova de configuração (contagem, operação, timer), fazer
`grep` pelo padrão antigo hardcoded em todo o repo (client E edge functions) antes de considerar
a feature completa — o compilador TS não apanha isto porque os tipos continuam válidos, só a
lógica fica semanticamente errada.

---

**Cuidado com `useEffect` de init que tem `phase` (ou qualquer campo que `reset()` também mexe) na
dependency array E chama `storeActions.reset()` dentro do próprio handler.** (sessão 13, mesmo dia)
O fix do `ALREADY_COMPLETED` acima introduziu um loop infinito real (app travava): `handleComplete()`
já chamava `storeActions.reset()` no sucesso, antes de navegar para casa — isso devolve `phase` a
`'idle'`. O `useEffect` de `init()` em `[date].tsx` só tinha a guarda `phase === 'idle'`; se o
`router.replace` ainda não tinha desmontado o ecrã nesse instante, o efeito reentrava em `init()` para
a MESMA data — que agora dava `409 ALREADY_COMPLETED`, cujo catch chamava `reset()` outra vez → `phase`
volta a `'idle'` → reentra outra vez → `Alert.alert()` empilhando-se mais depressa do que dava para
tocar OK, até travar. Fix: `initedDateRef` (ref local, não a store global) marca a data já tratada
(sucesso OU erro terminal tipo `ALREADY_COMPLETED`) nesta instância do ecrã, e o efeito ignora
reentradas para a mesma data independentemente de `phase` oscilar — sem bloquear o retry genuíno
(offline/500, que não marca a ref). **Regra: qualquer efeito de init que dependa de um campo que
`reset()` também zera precisa de uma guarda própria (ref local) contra reentrada, não pode confiar só
no valor desse campo.**

---

**Decisão confirmada (sessão 16, QA ao sistema de reteste): um fato que aparece 2x na mesma sessão
(reforço do reteste) conta 2x para `child_fact_mastery` (`times_seen`/`times_correct`/
`consecutive_correct` sobem +2, não +1).**
QA encontrou isto como possível inflação indevida do gate `mastered.totalCorrectRequired=8` para
fatos que estão simultaneamente em reteste activo. `distinct_sessions_correct` (o gate que
realmente controla as transições de estado LEARNING→REVIEWING→MASTERED) está protegido — só sobe
1x por dia local, independentemente de quantas vezes o fato apareça na sessão. Apresentadas duas
opções ao user: deixar como está ("mais prática = mais crédito") ou deduplicar por `fact_id` antes
de chamar `updateMastery` em `complete_challenge.ts` (sem tocar em `mastery.ts`). **User confirmou:
deixar como está.** Não mexer nisto sem re-abrir a conversa — é uma escolha deliberada, não uma
lacuna esquecida.

---

**Ao redeployar qualquer Edge Function pública (sem verificação de JWT própria no código, ex.
`evolution-webhook`): usar sempre `supabase functions deploy <nome> --use-api --no-verify-jwt`.**
Esquecer a flag repõe o default `verify_jwt: true` **mesmo que a função já estivesse a correr como
pública** — não dá erro nenhum no momento do deploy, falha silenciosamente a partir daí (a Evolution
API, ou qualquer chamador externo sem JWT do Supabase, passa a levar 401 sem log nenhum do lado do
cliente que o dispara). Foi exactamente o que aconteceu em 2026-08-18: um redeploy de
`evolution-webhook` sem a flag (para a feature de ops alerts) deixou a entrega de webhooks morta
por horas até um teste manual apanhar o 401 nos logs do Railway. **Sempre que tocar em código de uma
EF pública, confirmar `verify_jwt: false` na listagem (`supabase functions list`) depois do deploy —
não confiar só no comentário do ficheiro.** A camada 4 do sistema de ops alerts
(`railway-health-check` fazendo OPTIONS ao próprio `evolution-webhook`) existe precisamente para
apanhar isto mais cedo se voltar a acontecer.

---

**O status "open"/"connected" da Evolution API não é fiável — pode ser um "zombie state".**
`/instance/connectionState` e `/instance/fetchInstances` podem continuar a devolver `state: "open"`
mesmo com a sessão do WhatsApp genuinamente morta (envios reais falham com "Connection Closed").
Nem `/instance/delete`, `/instance/logout` nem `/instance/connect` conseguem desbloquear isto de
forma fiável quando acontece (todos dependem do mesmo estado interno corrompido) — confirmado em
2026-08-18. O único fix que funcionou foi `railway restart --service evolution-api` (reinicia o
processo Node do zero, força reconexão real do socket Baileys). **Nunca confiar em "state: open" da
Evolution API como prova de que os envios vão funcionar** — só um envio real de teste confirma.
`evolution-dev`'s `resetInstance` (delete+create+connect) também não verifica o resultado das
chamadas — pode falhar silenciosamente (confirmado: `/instance/delete` devolveu 400 e o botão
"Reiniciar ligação" não fez nada visível na app).
