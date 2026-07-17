# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-07-17 (sessão 13)

### 🟢 Em curso
```
ESTADO: LIVRE — redesenho de XP + 3 bugs de "XP não reflete a realidade" corrigidos e pushed
(último commit desta sessão: 266327f, depois só docs/memória).
DÍVIDA: expo-router 5→6 desalinhado com SDK 54.
DÍVIDA: 3 erros TypeScript pré-existentes (friends.tsx: Image, social_enabled; ranking.tsx: social_enabled).
NOTA: working tree continua a ter trabalho social/sons em curso doutra sessão, não tocado —
app.json, _layout.tsx, vários components/challenge/*, social.service.ts, src/components/social/,
sound.service.ts, assets/sounds/*.mp3, scripts/, src/constants/version.ts — por commitar por quem
estiver a fazer esse trabalho.
```

---

### ✅ Concluído (sessão 13 cont. — 2026-07-17) — 3 bugs de "XP não bate" encontrados a testar o redesenho

Depois do redesenho de XP (abaixo), o user testou em 2 devices físicos e encontrou 3 sintomas do
mesmo padrão — número mostrado ao user divergia do que o servidor realmente tinha gravado.
Princípio confirmado pelo user, guardado em memória (`.ai/feedback-tech-approach.md` +
memória global `feedback-xp-realtime-truth`): **XP tem sempre de refletir a realidade do servidor
em tempo real, nunca um número optimista local apresentado como definitivo.**

1. **`complete_challenge` nunca devolvia `xp_total`** (commit `fcaf467`) — calculava e gravava o
   novo total cumulativo em `child_profiles`, mas a resposta só tinha `xp_earned` (o ganho *daquela
   sessão*). Cliente usava esse valor por engano para sobrescrever o total cumulativo cacheado
   localmente (`activeChild` em AsyncStorage) — sintoma: "900xp" e "120xp" a aparecerem para a mesma
   criança em ecrãs diferentes. Fix: EF devolve `xp_total`; cliente usa-o em vez de
   `result.session.xp_awarded`.

2. **Card "Desafio de hoje" na home estava hardcoded** (commit `12fb495`) — sempre "0/5 questões" +
   badge "HOJE" + botão "Iniciar Desafio", nunca lia se o dia já estava concluído. `ChildStats` ganhou
   `todayCompleted` (derivado do merge de `calendar_days` + completions locais já calculado em
   `fetchStats`, sem query extra); card alterna badge/progresso/CTA conforme o estado real.

3. **Milestone (Q25/50/75%) disparava a quase cada pergunta em DEV** (commit `7529d0d`) — checkpoints
   calculados como percentagem de `totalQuestions`; com `CHALLENGE.TOTAL_QUESTIONS=5` (config DEV),
   colapsam para as perguntas 1/2/3. A tela de milestone é visualmente quase idêntica à de conclusão
   real (fundo cheio, confetti, badge XP, um botão "Continuar") — fácil de sair a meio pensando que
   já tinha acabado. Fix: milestone só é avaliado com `totalQuestions >= 10`.

4. **`start_challenge` reabria um dia já concluído** (commit `266327f`) — só verificava se
   `questions_payload` existia, não `status`. Sintoma final: user respondeu tudo certo, ecrã de
   conclusão mostrou "+24 XP" (cálculo local optimista, `sessionXp + bonuses`, computado ANTES da
   resposta do servidor), mas o saldo nunca mudou — porque `complete_challenge`, correctamente
   idempotente por dia, devolvia o resultado antigo em cache sem somar XP outra vez para um dia já
   pago. Fix: `start_challenge` devolve `409 ALREADY_COMPLETED` (com `correctCount`/`xpAwarded`/
   `isPerfect` da sessão original) em vez de reabrir o payload; `challenge.service.ts` propaga o
   código de erro real da EF (padrão já usado em `social.service.ts` para `send_friend_request`);
   ecrã de desafio mostra alerta claro e volta para trás em vez de simular gameplay sem efeito.

**Também:** banner "XP desta sessão: N" visível durante o jogo (distinto do saldo geral) + aviso de
saída (botão X) menciona o XP que se perde ao sair a meio — commit `09c2258`.

**Todas as EFs afectadas (`complete_challenge`, `start_challenge`) re-deployadas via
`supabase functions deploy <nome> --use-api`.** Mudanças de app são só JS/i18n — Metro reload chega,
sem rebuild nativo.

**Não testado E2E de novo depois do fix #4** — recomendado antes de dar como fechado: fazer um dia em
atraso completo (ex: 15/07 ou 14/07 pendentes na lista de retroactive) e confirmar que `xp_total` sobe
o valor certo (2/questão + 4 completar + 10 se perfeito).

---

### ✅ Concluído (sessão 13 — 2026-07-17) — Redesenho do sistema de XP

**Motivo:** user reportou totais de XP exorbitantes (ex: 1.203.329xp). Diagnóstico: `level_thresholds`
parava no nível 50 (60.000xp) sem mais entradas acima — `xp_total` continuava a crescer sem qualquer
nível correspondente depois disso, e por isso o número perdia todo o significado no longo prazo (não
é fisicamente possível chegar lá jogando 1×/dia, o número exorbitante citado veio quase de certeza de
dados de teste/QA, não de uso orgânico).

**1. Ganhos reduzidos ~5x** (`backend/functions/complete_challenge/index.ts`, fonte autoritativa):
`XP_PER_CORRECT` 10→2, `XP_COMPLETION_BONUS` 20→4, `XP_PERFECT_BONUS` 50→10. `xp_total` continua
cumulativo e nunca reseta por nível (já era assim, confirmado ao user).

**2. Níveis de prestígio 55–100 acrescentados** a `LEVEL_THRESHOLDS_FALLBACK` (na EF),
`backend/seeds/level_thresholds.sql` (aplicado ao DB via `supabase db query --linked -f`, confirmado
por SELECT) e `src/constants/config.ts` — até nível 100 / 200.000xp, para o total continuar a mapear
para um nível mesmo em uso multi-anual. Novas chaves i18n `levels.campeao/campeao_supremo/
mestre_absoluto/genio/genio_supremo/imortal` em pt/en (es/fr não tinham secção `levels`, fallback pt).

**3. Bug de UI descoberto e corrigido** — `getXpNextLevel`/`getXpCeil`/`getXpRange` em 3 ecrãs
(`(tabs)/index.tsx`, `(tabs)/calendar.tsx`, `progression.tsx`) faziam lookup exacto `level+1` numa
tabela esparsa; para níveis "planalto" (15, 20, 50, e agora todos os de prestígio) isto falhava e caía
no fallback (último threshold da tabela = tecto errado, ex: "faltam 200.000xp" para quem está no nível
15). Extraídos dois helpers partilhados `getLevelXpFloor`/`getLevelXpCeil` para `config.ts` (procuram o
primeiro threshold com `level > current`, não `level === current+1`) e usados nos 3 sítios.

**4. Client-side tinha os seus próprios valores de XP hardcoded, divergentes da EF** (mais grave que
o problema original — a EF é a fonte autoritativa, o cliente nunca devia recalcular):
- `src/stores/challenge.store.ts` `selectSessionXp`: `correct.size * 10` hardcoded → agora usa
  `CHALLENGE.XP_PER_CORRECT_ANSWER`.
- `app/(app)/challenge/[date].tsx`: `CorrectOverlay xpGain={10}` hardcoded → `CHALLENGE.XP_PER_CORRECT_ANSWER`.
  `totalXp = sessionXp + 200 + (perfeito?100:0)` hardcoded → `CHALLENGE.XP_COMPLETION_BONUS` +
  `CHALLENGE.XP_PERFECT_BONUS`.
- `home.challenge.xpReward` (badge "+150 XP" fixo no card do desafio de hoje, em `(tabs)/index.tsx`)
  era um texto estático em 4 locales, sem relação com o valor real — convertido para interpolação
  `+{{xp}}` calculada a partir de `CHALLENGE.*`.
- `config.ts`: removido `XP_COMPLETION_BONUS: 200` e `MILESTONE_XP` (mortos, nunca usados, valores
  divergentes da EF) — só ficaram os 3 valores reais (2/4/10) documentados como "apenas exibição,
  fonte autoritativa é a EF".

**Nota:** `MILESTONE_CFG.xp` em `[date].tsx` (valores 50/100/150 nas telas de milestone q5/q10/q15)
ficou como estava — é dead code (a chamada sempre passa `xpOverride={sessionXp}`, que vence), não
afecta comportamento. Não mexido para não expandir o escopo.

**Deploy:** `complete_challenge` re-deployada (`supabase functions deploy complete_challenge --use-api`).
`backend/functions/` e `supabase/functions/` são hardlinks (mesmo inode) — editar um edita ambos,
não precisou de `cp`. Seed aplicado directo ao DB linked (`pelhtuspcofmejzqtibx`) via
`supabase db query --linked -f backend/seeds/level_thresholds.sql`.

**Validação:** `npx tsc --noEmit` limpo nos ficheiros tocados (erros pré-existentes noutros ficheiros,
não relacionados). ESLint não corre neste ambiente (erro de config `ajv` pré-existente, não relacionado).
**Não testado no Simulator/device** — só validação estática + confirmação da tabela no DB.

**Commit:** `b57e502` — 12 ficheiros, `git add` explícito por nome (não `-A`), para não misturar com o
trabalho social/sons em curso na working tree. Pushed para `origin main`.

---

### ✅ Concluído (sessão 12 — 2026-07-16) — Recriação completa do Supabase

**O projecto Supabase original foi APAGADO.** Ref antigo `lrwlmxyafvmxqyfpawzg` (org `jcbuwtthpcyexkikrawv`)
dava NXDOMAIN no DNS — sinal de eliminação (projecto pausado mantém DNS). Perderam-se contas e progresso
(tudo de teste). Código estava versionado.

**Projecto novo:** `MathHeroKids`, ref `pelhtuspcofmejzqtibx`, conta `luizeduardompf2@gmail.com`
(org `LuizEduardoMPF2`), região `eu-west-1`. ⚠️ Conta **diferente** da do Luka
(`luizeduardompf.lixo@gmail.com`) — o CLI guarda um só token, alternar com `supabase login`.

**1. DB reconstruída** (via Management API `/database/query`, com header `User-Agent` senão Cloudflare dá 1010):
- 8 migrations aplicadas por ordem. **Migration 007 tinha bug** (`user_id` em RLS policy — coluna
  inexistente); corrigido para `parent_id = auth.uid()` e versionado.
- 4 seeds: level_thresholds (17), trophies (15), achievements (13), level_rewards (7). +100 mult. facts.

**2. Catálogos reconstruídos e VERSIONADOS** — antes só existiam no DB (aplicados ad-hoc via API na
sessão 7, nunca commitados → perderam-se):
- `backend/migrations/008_gamification_rpc_and_catalog_keys.sql` — RPC `get_challenge_counts_for_gamification`
  + índices únicos em `name_key` (dão chave natural → seeds re-executáveis).
- `backend/seeds/{trophies,achievements,level_rewards}.sql`. Valores derivados das descrições em
  `pt.json` + dos `switch` de requirement_type/condition_type na EF. 63 chaves i18n validadas em pt/en/es/fr.
- ⚠️ **REGRA:** nunca aplicar SQL via Studio/API sem versionar em `backend/`. Foi o que causou a perda.

**3. Edge Functions** — as 7 deployadas com `--use-api`. `backend/functions/` e `supabase/functions/`
são **hardlinks** (mesmo inode) — editar um edita ambos.

**4. Bug corrigido — `complete_challenge` EF:** avaliação de trophies/achievements corria ANTES de a
sessão ser marcada `completed`; como `fetchGamificationStats` conta sessões completadas, no 1º desafio
contava 0 e `daily1`/`firstChallenge`/`perfect1`/`firstPerfect` nunca disparavam. Fix: mover o update
`status='completed'` para antes da avaliação. Bug pré-existente, nunca testado E2E.

**5. `.env`** actualizado (URL + anon key do projecto novo; anon key validada — ref no JWT bate certo).

**6. Validação E2E** — conta de teste + challenge completo: 120 XP, 5 factos mastery, **2 trophies +
2 achievements a disparar**, ledger + calendar OK. Progresso limpo depois; conta pronta a usar.

**Conta de teste:** `teste.mathhero@gmail.com` / `Teste1234!` · criança `Testinho`/`testinho`.
Nota: Supabase rejeita domínios `.dev` no signup; confirmar email via admin API `{"email_confirm":true}`.

**7. Reinstalação em 2 iPhones físicos** (2026-07-16/17) — ambos confirmados a funcionar:
- **iPhone 16 Pro** (Luiz, UDID `00008140-001A45E80CEA801C`) — reinstalado com sucesso.
- **iPhone 13** (Luana, UDID `00008110-00143041148A801E`) — primeiro deploy neste device: falhou com
  `Provisioning profile ... doesn't include the currently selected device` (perfil ainda não conhecia
  o UDID). Fix: `xcodebuild -workspace ios/MathHeroKids.xcworkspace -scheme MathHeroKids -configuration
  Release -destination "id=<UDID>" -allowProvisioningUpdates build` — regista o device e regenera o
  perfil. Depois o `expo run:ios` normal passou a funcionar.
- ⚠️ **Xcode aberto bloqueou builds da CLI duas vezes** — ficavam presos indefinidamente (CPU parada)
  até fechar o Xcode. Fechar sempre o Xcode antes de correr `expo run:ios` por linha de comandos.
- ⚠️ Um `xcodebuild` de Debug para o simulador ficou preso a segurar
  `DerivedData/.../XCBuildData/build.db`, bloqueando o build do device físico com
  `database is locked`. Fix: `ps aux | grep xcodebuild`, matar o processo com CPU parada há minutos.
- ⚠️ Um build em background morreu **em silêncio, sem notificação**, depois de ~9h — provavelmente o
  Mac dormiu a meio da noite. Sempre confirmar `ps aux` antes de assumir que um build ainda corre.

**8. Registo real bloqueado por rate limit — corrigido:** signup de `luizeduardompf@gmail.com` (conta
real, não a de teste) deu 429 `over_email_send_rate_limit`. Causa: projecto novo usa o mailer interno
do Supabase (sem SMTP próprio), limite de 2 emails/hora. A conta não chegou a ser criada (bloqueado
antes disso). Fix aplicado: `mailer_autoconfirm: true` no config de auth do projecto — signup confirma
na hora, sem depender de email. Decisão do user, documentada em `CLAUDE.md` (secção Auth) — reconsiderar
se for para produção com pais desconhecidos (SMTP próprio + voltar a exigir confirmação).

**9. Wireless debugging confirmado** — depois da 1ª instalação por cabo em cada device, o Xcode guarda
"Connect via network" automaticamente (ícone de globo 🌐 em Window → Devices and Simulators). Reinstalações
seguintes **não precisam de cabo** — confirmado no iPhone 16 Pro (`devicectl` mostra `connected` com o
cabo desligado). Detalhe completo em `.ai/project-mathhero.md` (secção "Como testar").

**Próximo passo:** nenhum pendente — ambiente estável. Builds caducam por device: iPhone 16 Pro ~23 Jul,
iPhone 13 da Luana uns dias depois (instalado mais tarde).

---

### ✅ Concluído (sessão 11 — 2026-07-16) — App standalone no iPhone físico + fix crítico de env

**1. Fix CRÍTICO — `src/constants/env.ts`: `process.env` com chave dinâmica**

Sintoma: app instalava no iPhone, abria e fechava imediatamente.
Crash real (via `devicectl --console`):
`RCTFatalException: Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL`

Causa raiz: `requireEnv()` fazia `process.env[key]` — **chave computada**. O Babel só inlina
`EXPO_PUBLIC_*` em acessos estáticos literais. Em dev o Metro popula `process.env` em runtime
(por isso nunca se notou); num bundle Release não há `process.env` → `undefined` → throw no import
do módulo → morte no arranque.

⚠️ **Isto afectava qualquer build de produção** — EAS e App Store incluídos. Não era específico do device.

Fix: `requireEnv(key, value)` recebe o valor por argumento; call sites usam acesso literal
(`process.env.EXPO_PUBLIC_SUPABASE_URL`). `optionalEnv` removido (mesmo problema, só usado 1×).
Validado: URL + anon key confirmados inlined no `main.jsbundle`; app viva no device.
Type-check: 3 erros antes, 3 depois — nenhum introduzido.

**2. Bundle identifier mudado — `com.mathherokids.app` → `com.luizeduardompf.mathherokids`**

`com.mathherokids.app` já está registado por outra conta Apple → "Failed Registering Bundle Identifier".
Alterado em `app.json` **e** `ios/MathHeroKids.xcodeproj/project.pbxproj` (2 ocorrências: Debug + Release).
⚠️ Consequência: a publicação futura na App Store será com este ID. `eas.json` ainda tem
`ascAppId` e `appleTeamId` por preencher.

**3. Instalação standalone no iPhone 16 Pro — SEM Apple Developer Program**

O handoff anterior afirmava que era preciso pagar os $99/ano. **Falso** — só é preciso para TestFlight,
OTA e push. Por cabo com Personal Team gratuita funciona.

Certificado já existente: `Apple Development: luizeduardompf2@gmail.com`, team `F4NB8TACS5` (gratuita).

**Comando de (re)instalação — a app CADUCA A 7 DIAS (≈23 Jul 2026):**
```bash
# iPhone desbloqueado + ligado por cabo + Developer Mode on
npx expo run:ios --device 00008140-001A45E80CEA801C --configuration Release --no-bundler
```
- UDID do iPhone 16 Pro: `00008140-001A45E80CEA801C` (o UUID do coredevice `550AC2C8-…` NÃO serve)
- Na 1ª abertura: Definições → Geral → VPN e Gestão de Dispositivos → confiar no Apple ID
- Limites da conta gratuita: 7 dias, sem push, máx. 3 apps

**4. Ambiente — nota sobre portas**

A porta 8081 costuma estar ocupada pelo dev server de outro projecto do user. Para o simulador:
`npx expo start --dev-client --port 8082`. O `--dev-client` é obrigatório (o projecto tem `ios/`
nativo, não corre em Expo Go a partir do Mac). Build nativo já instalado no simulador iPhone 17.

**5. Skills reescritas — `mathhero-resume` e `context-checkpoint`**

Vivem em `~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/*/skills/`
(fora do repo, logo não versionadas — registado aqui para não se perder).

`mathhero-resume`:
- Removido o passo do `.scripts/session-setup.sh` (a pasta não existe) e os paths de sandbox `/sessions/*/mnt/`
- Acrescentado `git status`/`git log` + passo de reconciliação com o handoff (foi assim que se
  detectou o `index.js` não versionado, que o handoff não mencionava)
- Sinais a vigiar: campo "Em curso", config `// DEV` por reverter, migrations pendentes

`context-checkpoint`:
- **Estava hardcoded ao MathHero mas com nome e gatilhos genéricos** → disparava em sessões de
  outros projectos e escrevia neste handoff. Âmbito agora fechado ao MathHeroKids-UI.
- Removidos paths de sandbox e o workaround de git locks do virtiofs (obsoleto — corre local)
- `git add -A` cego → substituído por commits separados por unidade lógica
- Push deixou de ser automático: confirmar com o utilizador (acção com efeito externo)

⚠️ **Regra geral:** as skills dos dois projectos do user (MathHeroKids e o outro) devem ser
mutuamente independentes — sem referências cruzadas e com âmbito explícito por directório.

---

### ✅ Concluído (sessão 10 — 2026-06-16) — Fix build iOS: Reanimated 3→4

**Sintoma:** `xcodebuild` error code 65 ao compilar `RNReanimated`:
`ReanimatedMountHook.h:24:34: non-virtual member function marked 'override' hides virtual member function` (param `mountTime`).

**Causa raiz:** `react-native-reanimated@~3.17.0` é versão do SDK 53 (RN 0.79).
Projeto está no SDK 54 (RN 0.81), que mudou a assinatura virtual de `shadowTreeDidMount`.
O SDK 54 fixa (ver `node_modules/expo/bundledNativeModules.json`):
`react-native-reanimated ~4.1.1` + nova peer dep `react-native-worklets 0.5.1`.
Não existe Reanimated 3.x compatível com RN 0.81 → migração para v4 é obrigatória.

**Editado:** `babel.config.js` — plugin `react-native-reanimated/plugin` → `react-native-worklets/plugin` (Reanimated 4 moveu o plugin do Babel; deve ser o último plugin).

**Risco de regressão: ~nulo** — nenhum `.ts/.tsx` em `src/`/`app/` importa reanimated diretamente (só dependência transitiva de expo-router/react-native-screens). Nenhuma API removida em uso (verificado: `useAnimatedGestureHandler`, `makeMutable`, etc.).

**Pendente (correr no Terminal do Mac, raiz do projeto):**
```
npx expo install react-native-reanimated react-native-worklets
npx pod-install
npx expo run:ios --no-build-cache
```
Se persistir cache Xcode: `rm -rf ~/Library/Developer/Xcode/DerivedData`.

**Validação:** ✅ build iOS passou (confirmado pelo user, 2026-06-16).

**Dívida separada detectada:** `expo-router ~5.0.0` no package.json, mas SDK 54 fixa `~6.0.24`. Tratar isolado (breaking changes de routing), não misturar com este fix.

---

### ✅ Concluído (sessão 9 — 2026-06-14) — EAS Update setup para Expo Go

**Objetivo:** publicar app no Expo Go via EAS Update (sem Apple Developer, sem build nativo)

**`package.json`:**
- Removido `expo-av` (incompatível com SDK 56 — crashava build nativo com `EXAV.h: EXEventEmitter.h not found`; não era usado no código, sons comentados)
- Removido `@react-native-community/netinfo` (não incluído no Expo Go runtime)
- Adicionado `expo-network` (primeiro-party Expo, incluído no Expo Go)

**`src/hooks/use-network-status.ts`:**
- Reescrito para usar `expo-network` em vez de `@react-native-community/netinfo`
- `useNetworkStatus`: usa `Network.getNetworkStateAsync()` + polling a cada 5s (expo-network não tem addEventListener)
- `checkNetworkOnce`: idem, one-shot

**`app.json`:**
- `extra.eas.projectId`: `"FILL_AFTER_EAS_INIT"` → `"c9e1ab66-bab6-4dbd-bdb7-990087d1f209"`
- Adicionado `updates.url`: `"https://u.expo.dev/c9e1ab66-bab6-4dbd-bdb7-990087d1f209"`
- Adicionado `runtimeVersion.policy`: `"appVersion"`

**`eas.json`:**
- Removido campo `"update"` inválido (causava `eas.json is not valid`)

**`npm install --legacy-peer-deps` + `npx expo install expo-network`** — concluídos sem erros

**`npx eas init`** — projeto já linkado, confirmado: ID `c9e1ab66-bab6-4dbd-bdb7-990087d1f209`

**⏳ Pendente:** correr `eas update --branch main --message "initial release"` para publicar o bundle

---

### ✅ Concluído (sessão 8 — 2026-06-12, cont.) — UI fixes

**`src/components/challenge/StatusScreens.tsx`:**
- Layout corrigido: `MiloBubble` movida para dentro do `EntranceView` (body `flex:1 justify:center`) nas 3 telas — eliminado gap vazio enorme entre subtitle e bubble
- `sc.title`: `fontFamily.bold` → `fontFamily.extraBold` + `lineHeight: 36` — corrige clipping do "T" renderizando como "I ime's up!"

**`app/(app)/challenge/[date].tsx` — fix React warning:**
- `useTimer`: `onExpireRef.current()` estava dentro do updater `setRemaining((prev) => ...)` → violação de pureza → "Cannot update a component while rendering"
- Fix: updater puro (só decrementa); `onExpire` disparado em `useEffect` separado com `firedRef` para evitar disparos duplos

**`src/locales/en.json` — chaves em falta:**
- Adicionado `challenge.timeout.miloMessage`, `challenge.wrong.miloMessage`, `challenge.wrong.continueAnyway`, `challenge.blockIncomplete.miloMessage` — sem estas o i18next fazia fallback para pt.json (texto em português na UI inglesa)

**`app/(app)/parent-area/child/[id].tsx`:**
- Removido `MiloMessage` da tela de edição do perfil da criança
- Card de stats movido para o fundo da tela como texto discreto (`statsFooter`) — ícone 13px + texto `colors.text.tertiary`, sem card/shadow

---

### ✅ Concluído (sessão 8 — 2026-06-12) — Bugs + UI polish

**Fix crítico — start_challenge EF (unique constraint ao retry):**
- EF falhava com 500 quando já existia row em `challenge_sessions` com `questions_payload = null` (sessão órfã de tentativa anterior)
- Idempotência corrigida: busca por `(child_id, challenge_date, module_id)` antes do upsert; reutiliza `id` da sessão órfã se encontrada; retorna direto se payload já existe
- `effectiveSessionId` usado em todo o upsert e response; EF re-deployada e testada

**Fix — botão "Try again" ia para tela de complete vazia:**
- `onPress` chamava `setPhase('completed')` em vez de re-iniciar (bug copy-paste)
- Fix: `storeActions.reset()` → volta a `phase: 'idle'`; `phase` adicionado às deps do `useEffect` de `init`

**UI — headers Desafios e Amigos idênticos ao Settings:**
- `challenge.tsx`: adicionado `LinearGradient`, padding/gap/fontes alinhados
- `friends.tsx`: `gap: space.xs` no View interno, padding alinhado
- Ambos: `paddingHorizontal: space.md`, `paddingTop: space.sm`, `paddingBottom: space.lg`, `gap: space.xs`

**UI — Settings: botão editar pai removido + ChildrenInfoCard:**
- `TouchableOpacity create-outline` removido do `ParentCard` — edição só na Área dos Pais
- Novo `ChildrenInfoCard`: avatar + nome + idade + XP + Nível + "Desde / Acesso" (apenas informativo)

**UI — Settings: logout movido para dentro do ScrollView:**
- Saiu da barra fixa acima da tab bar; agora é último item da lista
- Borda sutil `#FECACA` adicionada para mais definição visual

**Nota git:** virtiofs locks → usada GitHub Contents API para commits de `challenge.tsx`, `friends.tsx`, `settings.tsx`.

---

### ✅ Concluído (sessão 8 — 2026-06-12) — Animação de conclusão de desafio

**Novos componentes:**
- `src/components/challenge/CompletedScreen.tsx`: substitui o `MilestoneScreen variant="completed"`. Fundo LinearGradient dourado, 8 elementos com stagger spring/fade (XP badge, Milo, título, subtítulo, progress, barra animada 0%→pct%, botão), float loop do Milo (±12px). 72 peças de confetti.
- `src/components/challenge/CelebrationTransition.tsx`: tela full-screen de 3s que corre entre "Continuar" e o submit. Background flash que escala, 12 raios de sol em rotação, burst ring, trophy card (scale 0→1.3→1 + rotate -180°→0° + wobble), 4 sparkles pulsantes, título/subtítulo spring in, 120 peças de confetti. Auto-avança após 3s.

**Alterações em `app/(app)/challenge/[date].tsx`:**
- Imports dos dois novos componentes
- Estado `showCelebration: boolean`
- Bloco `completed/submitting` agora usa `CompletedScreen` (Continuar → `setShowCelebration(true)`)
- Novo bloco `showCelebration` renderiza `CelebrationTransition` (onComplete → `handleComplete()`)
- Fluxo: `CompletedScreen` → (Continuar) → `CelebrationTransition` 3s → `handleComplete` → LevelUp/TrophyModals → navigate

**Config de teste (`src/constants/config.ts`):**
- `TOTAL_QUESTIONS: 5` (era 20) — marcado com `// DEV`
- `BLOCKS_PER_SESSION: 1` (era 4) — marcado com `// DEV`
- `DEFAULT_QUESTION_COUNT: 5` (era 20) — marcado com `// DEV`
- ⚠️ REVERTER para 20/4/20 antes de produção

**Padrão de imports Reanimated confirmado:**
- `withRepeat` e `withSequence` precisam do mesmo `@ts-expect-error` + import separado que `withDelay` e `Easing`
- `StyleSheet.absoluteFill`/`absoluteFillObject` não existem nesta versão do RN — usar spread manual `{ position:'absolute', top:0, left:0, right:0, bottom:0 }`
- `useAnimatedStyle` retorna tipo incompatível com `StyleProp<ViewStyle>` — cast `as any` no valor, não inline em JSX

---

### ✅ Concluído (sessão 7 — 2026-06-11) — Phase 3 completa

**Migrations aplicadas (Supabase Management API):**
- Migration 004: INSERT RLS em friend_requests
- Migration 005: last_seen_at em child_profiles
- Migration 006: multiplication_facts (100 questões, tiers T1–T5)
- Migration 007: child_fact_mastery + colunas Phase 2.5 em challenge_sessions/answers
  (bug fix: RLS usava user_id que não existia — corrigido para parent_id = auth.uid())

**Seed no DB:**
- 15 trophies (daily/weekly/monthly/streak/special, tiers bronze→diamond)
- 13 achievements (primeiros_passos/sequencias/habilidades/especiais)
- 7 level_rewards (frames, outfits, medals nos níveis 2,5,8,10,12,15,20)
- RPC: get_challenge_counts_for_gamification (week/month counts para EF)

**complete_challenge EF (Phase 3 — deployed):**
- computeLevel: agora usa level_thresholds do DB (não fallback hardcoded)
- Avaliação completa de trophies por requirement_type (challenges_completed, challenges_in_week, challenges_in_month, current_streak, perfect_challenges)
- Avaliação completa de achievements por condition_type (challenges_total, perfect_challenges, streak_days, facts_mastered, level_reached)
- Ambos one-time safe (upsert com onConflict)

**Frontend Phase 3:**
- LevelUpModal: animações spring/bounce (react-native-reanimated), reward desbloqueada
- TrophyEarnedModal: fila N itens, avança um a um com animação
- challenge/[date].tsx: Level Up → Trophies/Achievements → navigate home (sequencial)
- trophy-room.tsx: dados reais TanStack Query (era mock estático)
- trophy/[id].tsx: screen completa com progresso (era placeholder 7 linhas)
- achievements.tsx: dados reais TanStack Query (era mock estático)
- rewards.tsx: level rewards com estado unlocked (era placeholder 8 linhas)
- gamification.service.ts: fetchTrophiesWithState, fetchAchievementsWithState, fetchLevelRewards, fetchLevelThresholds

**i18n:**
- 15 trophy keys (trophies.daily1.*...trophies.perfect30.*) × 4 locales
- 13 achievement keys (achievements.firstChallenge.*...achievements.level10.*) × 4 locales
- 7 reward keys (rewards.frame_star.name...rewards.frame_rainbow.name) × 4 locales

---

### ✅ Concluído (sessão 6 — 2026-06-11) — Phase 2.5 completa

**Tag git:**
- `v1.1-phase1-complete` criada e publicada no remote

**Sprint 2.5.1 — `backend/migrations/006_multiplication_facts.sql`:**
- Catálogo estático de 100 questões (1×1 .. 10×10), tiers T1–T5
- Distribuição validada: T1=19, T2=47, T3=14, T4=11, T5=9
- RLS: leitura pública para autenticados

**Sprint 2.5.2 — `backend/migrations/007_child_fact_mastery.sql`:**
- `child_fact_mastery`: mastery por (child_id, fact_id), estados NEW/LEARNING/REVIEWING/MASTERED/WEAK
- `child_profiles.timezone` adicionado (default 'America/Sao_Paulo')
- `challenge_sessions`: colunas `questions_payload`, `rules_version`, `selection_metadata`; `question_seed` tornado nullable (deprecated)
- `challenge_answers`: colunas `fact_id`, `response_time_ms`

**Sprint 2.5.3 — Config JSON + Schema + Loader:**
- `backend/config/adaptive-rules.json`: regras versionadas com pesos, thresholds, anti-repeat, progressão por tier
- `backend/config/adaptive-rules.schema.json`: JSON Schema 2020-12 — validado com ajv
- `backend/functions/_shared/adaptive-rules.ts`: loader com validação de invariantes no boot (soma pesos = 1.0)

**Sprint 2.5.4 — Refactor `start_challenge`:**
- Geração server-side via `selectQuestions()` em `_shared/question-selector.ts`
- Payload de 20 questões persistido em `questions_payload`; retornado ao cliente
- Cooldown cross-sessão (últimas 2 sessões excluídas), progressão de tiers, interleave por dificuldade
- `question_seed` = null para novas sessões (legacy deprecated)

**Sprint 2.5.5 — Refactor `complete_challenge`:**
- Valida respostas contra `questions_payload` armazenado (não regenera seed)
- `_shared/mastery.ts`: `updateMastery`, `computeStrength` (HLR decay), `nextState`, `applyCommutativity`
- Preserva toda a lógica de XP/streak/calendar_days/trophies/level_rewards do v1
- Sessões legacy sem payload retornam 409 `LEGACY_SESSION_UNSUPPORTED`

**Sprint 2.5.6 — App cliente:**
- `challenge.service.ts`: nova API sem seed, sem offline queue, `startChallenge` retorna `ChallengeStartResponse`
- `challenge/[date].tsx`: consome `questions_payload` server-side, remove PRNG local
- `src/hooks/use-network-status.ts`: hook + `checkNetworkOnce()`
- `Question.fact_id?: string` adicionado; `AnswerDraft.fact_id?` + `position?` propagados no `submitAnswer`
- `ChallengeQuestion`, `ChallengeStartResponse` em `src/types/index.ts`
- i18n: `offlineTitle` + `offlineMsg` em pt/en/es/fr
- `@react-native-community/netinfo` instalado
- `supabase/config/`: criado para resolver imports relativos do CLI de deploy
- EFs `start_challenge` + `complete_challenge` deployadas com sucesso

**Sprint 2.5.7 — `recompute_mastery` EF:**
- Replay idempotente do histórico de `challenge_answers` em ordem cronológica
- Protegida por `X-Admin-Token` ou `service_role`
- Deployada em produção

**Sprint 2.5.8 — A/B harness:**
- `adaptive-rules-v2.json`: variante experimental (4 sessões para REVIEWING, WEAK weight 35%)
- `getRulesForChild(childId)`: atribuição estável 50/50 por hash(child_id) % 2
- Controlado por `AB_TEST_ENABLED=true` env var na EF
- `docs/ab-testing.md`: workflow completo, queries de análise SQL
- EFs re-deployadas com v1+v2

**Docs + CLAUDE.md:**
- `docs/implementation-phases.md`: Phase 2.5 inserida com tabela de sprints
- `CLAUDE.md`: seção Challenge atualizada (server-side, online-only, mastery), Fase atual atualizada, Offline atualizado

---

### ✅ Concluído (sessão 5 — 2026-06-11)

**i18n — auditoria completa de textos hardcoded PT:**
- `PlaceholderScreen.tsx`: 'Voltar' → t('common.back'), 'Em breve' → t('common.comingSoon')
- `+not-found.tsx`: 'Página não encontrada' + 'Voltar ao início' → t()
- `trophy-room.tsx`: title, miloMessage, 'PRÓXIMO TROFÉU', CATEGORY_LABELS → t()
- `trophy/[id].tsx`, `controls.tsx`, `rewards.tsx`, `parent-area/child/new.tsx` → t() nos títulos dos placeholders
- `pin.tsx`: 'Controle dos pais', 'Área dos pais', 'Digite o PIN', 'Esqueci o PIN' → t()
- `edit-profile.tsx`: todos os labels, placeholders, erros, alerts → t()
- `change-password.tsx`: erros de validação, labels, botões → t()
- `add-child.tsx` (profile-select): title, miloMessage, botão → t()
- `forgot-password.tsx`: mensagem de sucesso → t()
- `friends/chat`: 'Amigo' + 'Começa a conversa!' → t()
- `friends/add`: 'Sem sugestões' + 'Busca por username' → t()
- `home/index.tsx`: '+150 XP' badge → t('home.challenge.xpReward')
- Novas chaves adicionadas em pt/en/es/fr: 30+ chaves novas

---
### ✅ Concluído (sessão 4 — 2026-06-11)

**Fix complete_challenge EF — unique constraint collision:**
- EF falhava com 500 quando já existia uma session para (child_id, challenge_date, module_id) com UUID diferente
- Fix: verificar por (child_id, date, module_id) ANTES de upsert por id; usar effectiveSessionId em todos os inserts
- Deployed: complete_challenge v6

**Fix send_friend_request EF:**
- EF selecionava `expo_push_token` na query principal → 500 se migration 003 não aplicada
- Fix: expo_push_token em query separada, não bloqueia o pedido de amizade
- Deployed: send_friend_request v3
- Migration 004 criada: INSERT RLS policy para friend_requests (fallback client-side)

**i18n — datas hardcoded:**
- `calendar.tsx`: MONTH_NAMES_PT e DOW_LABELS → `t('calendar.months/weekdays', {returnObjects})`
- `calendar.tsx`: monthProgressMsg → chaves i18n; `toLocaleString('pt-BR')` → locale-neutral
- `challenge.tsx`: `formatDate` usa `i18n.language` (LANG_TO_LOCALE map)
- `friends/chat`: `toLocaleDateString('pt-PT')` → locale-aware
- `friends/list`: placeholder via `t('friends.searchPlaceholder')`
- Locales: adicionados `calendar.months`, `calendar.weekdays`, `challenge.errorSubmitMsg/Retry`, `parentArea.title/subtitle/accessBtn`

**PIN keypad — números distorcidos iOS 26:**
- `settings.tsx` pinStyles.keyText: adicionado `lineHeight: 34` (mesmo que challenge keypad)
- `parent-area/pin.tsx` kp.keyText: adicionado `lineHeight: 34` + `fontVariant: ['tabular-nums']`

**Challenge phase='error' UI:**
- Antes: `phase='error'` caia no render do gameplay → "Question 6 of 5"
- Agora: tela dedicada com ícone, mensagem i18n, botão retry e botão sair

**Settings — restructure PIN flow:**
- Antes: settings abria com PIN gate bloqueante (full-screen)
- Agora: settings abre diretamente; PIN gate apenas ao tocar em "Área dos pais"
- `PinGate` aceita `onCancel` prop → back button no header (chevron circle)
- Sign out: barra fixa acima da tab bar (fora do ScrollView), tint vermelho #FEF2F2, modal confirmação
- `SettingsHeader` aceita `onBack` prop opcional

**last_seen_at + created_at no perfil da criança:**
- Migration 005: `last_seen_at timestamptz` em `child_profiles` + índice
- `childService.updateLastSeen()`: fire-and-forget, non-throwing
- Chamado ao selecionar filho (profile-select) e ao abrir a app (_layout.tsx, throttle 30 min)
- Card de stats em `parent-area/child/[id].tsx`: "Membro desde" + "Último acesso"
- Locales: `parentArea.child.registeredSince` + `lastAccess` (pt/en/es/fr)

**Header consistency — auditoria completa:**
- `parent-area/index.tsx`: SafeAreaView solid → LinearGradient + chevron-back + "Math Hero Kids" subtitle
- `parent-area/child/[id].tsx`: mesmo fix
- `friends/add.tsx`: adicionado headerCenter + headerSub "Math Hero Kids"
- `friends/ranking.tsx`: mesmo
- `friends/notifications.tsx`: mesmo + título "Notificações" → `t('friends.viewNotifications')`
- `friends/blocked.tsx`: mesmo + "Bloqueados" → `t('friends.blockedUsers')` + `useTranslation` adicionado
- Padrão universal: LinearGradient [primary→primaryDark], "Math Hero Kids" small subtitle, title extraBold white, chevron-back em circle button

---

### ✅ Concluído (sessão 3 — 2026-06-11)

**Fix crítico — Edge Functions (corsHeaders inline):**
- Re-deploy de todas as 5 EFs com corsHeaders inlined (Management API não resolve imports relativos)

**Fix fonte iOS 26 (Nunito ExtraBold stylistic alternates):**
- `Text.tsx`: `fontVariant: ['tabular-nums']` + `allowFontScaling={false}` globais
- challenge/[date].tsx e StatusScreens.tsx: fontVariant em todos os elementos numéricos

**Calendar — dias passados tappáveis, i18n, PIN keypad fixes**

**i18n global — 10 ficheiros corrigidos na sessão anterior**

---

### ⚠️ Issues conhecidos

- `expo-av` incompatível com SDK — sons comentados com TODO
- **Migrations pendentes (Supabase Studio):**
  - Migration 004: `backend/migrations/004_friend_requests_insert_rls.sql`
  - Migration 005: `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;` + índice
- **Push em device real:** `npm install expo-notifications expo-device` (Mac Terminal) + EAS build
- **Push iOS (APNs):** requer Apple Developer Program ($99/ano)
- **Block list:** AsyncStorage MVP — migrar para tabela `blocked_users` (Phase 5+)
- Git locks virtiofs: `mv` nunca `rm`
- Avatares PNG ~1.2 MB — optimizar para ≤200 KB antes de produção
- `friends/list.tsx`: "Nível X" nos sub-labels ainda hardcoded
- **`expo-router ~5.0.0` desalinhado** — SDK 54 fixa `~6.0.24`. Migração v5→v6 pendente (breaking changes de routing). Correr `npx expo install --check` para listar todos os pacotes fora do pin.

---

### ⏭️ Próximos passos (por prioridade)

**A — Testar Phase 2.5 + Phase 3 end-to-end no Simulator:**
- Completar um challenge → verificar que `complete_challenge` atualiza mastery
- Verificar Level Up modal se XP suficiente
- Verificar TrophyEarnedModal (firstChallenge achievement deve disparar)
- Testar trophy-room, achievements, rewards screens com dados reais
- Testar tela offline (desligar WiFi)

**B — Phase 4 — Calendar:**
- Calendar screen com estados reais (completed, failed, in_progress, perfect)
- Retroactive challenge flow
- Ver `docs/implementation-phases.md`

**C — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build Android (gratuito)

**D — Issues conhecidos:**
- `expo-av` incompatível com SDK — sons comentados com TODO
- `friends/list.tsx`: "Nível X" nos sub-labels ainda hardcoded
- Git locks virtiofs: usar `/tmp` clone para commits (ver workaround em CLAUDE.md)
