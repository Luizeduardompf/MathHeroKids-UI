# Session Handoff

> **REGRA DO AGENTE:** Actualizar "Em curso" ANTES de começar qualquer tarefa. Commit imediato.

---

## Estado actual — 2026-07-19 (sessão 16, cont. — QA sénior: questões, montagem, XP)

### ✅ Concluído — QA sénior focado no SENTIDO das questões e montagem do desafio

Pedido do user: QA profundo não só do mecanismo de reteste, mas se as questões fazem sentido,
como o desafio é montado (dificuldade/tiers/nível), e a matemática de XP.

**1 bug real encontrado e corrigido (`eb1ac22`):** quando o pool de fatos elegíveis esgota
(operação com poucos fatos + `question_count` alto + cooldown cross-sessão), `start_challenge`
entrega MENOS questões do que o pedido — mas gravava `total_questions` = valor PEDIDO, não o
realmente entregue. `complete_challenge` compara `correctCount === total_questions` para
`is_perfect` → uma criança que acerta 100% das questões que realmente recebeu (ex: 22/22) era
marcada como não-perfeita (22 vs 25 pedidas), perdendo o bónus de XP e progresso de troféu.
Reproduzido deliberadamente (criança nova, só adição — pool T1+T2=47 menor que mult/div=66 —,
question_count=25, 2ª sessão consecutiva esgota o pool a 22). Fix: `total_questions =
finalQuestions.length` (entregue, não pedido) + `selection_metadata.shortfall` para
diagnóstico (nunca silencioso).

**Catálogo de questões (`arithmetic_facts`) auditado — tudo correto:**
- Zero inconsistências aritméticas (resposta bate com a fórmula em todas as 400 linhas)
- Subtração nunca negativa, divisão nunca com resto/por zero
- Distribuição de tiers faz sentido pedagógico real: tier 5 de multiplicação = exactamente os
  fatos classicamente mais difíceis (7×8, 8×9, 9×8, 6×9, 7×7...); tier 1 = ×1/N×1 (trivial)
- Divisão deriva de multiplicação, subtração deriva de adição (mesma distribuição de tiers) —
  intencional e documentado

**Tier gating vs nível — confirmado desacoplado (correcto, não é bug):** desbloqueio de
dificuldade depende só de mastery (`child_fact_mastery`), nunca de `level`/XP. Testado o limiar
exacto: 28/47 fatos tier2 não-NEW não desbloqueia tier3 (59.57% < 60%), 29/47 desbloqueia
(61.7%). Mesmo desbloqueado, um tier novo só começa a aparecer depois do bucket NEW dos tiers
mais baixos esgotar (`buckets.NEW` ordena por `base_difficulty` ascendente) — desbloqueio é
gradual/orgânico, auto-equilibrado (jogar mais avança mastery, que desbloqueia mais pool,
evitando esgotamento na prática).

**⚠️ Achado de design não corrigido — reteste ignora tier gating:** um fato em
`child_fact_retest` (`a_retestar=true`) é injectado com garantia por `start_challenge`
independentemente de o seu tier estar actualmente desbloqueado para a criança (testado: fato
tier 4 injectado numa criança só com tier 1+2 desbloqueados). Na prática só é alcançável via
regressão de mastery (tier "re-tranca" depois de já ter sido desbloqueado, ver `WEAK` em
`computeUnlockedTiers`), um caminho estreito mas real. Defensável ("corrigir erro conhecido
> sequência de dificuldade") mas é uma escolha de produto, não decidi sozinho — fica para
o user avaliar se quer manter ou gatear o reteste por tier também.

**Matemática de XP validada end-to-end**, incluindo o caso de um fato de reteste aparecer 2x
na sessão: `correctCount`/`xp_earned`/`xp_total` bateram exactamente com o cálculo manual
(10 corretas incl. 2x do mesmo fato → 34 XP, streak de reteste conta só 1x apesar de 2
ocorrências). Constantes XP cliente/servidor confirmadas em sincronia (2/4/10).

Dados de teste do Testinho totalmente resetados ao fim (xp=0, nível=1, sem mastery/retest).

---

## Estado anterior — 2026-07-18 13:15 (sessão 16, cont. — teste de UX real)

### ✅ Concluído (sessão 16 cont.) — Teste de UX a sério (Simulator, jogo real pelo teclado)

Pedido do user: "teste sério e bem completo" de UX, não só verificação de exibição.

**2 bugs reais encontrados e corrigidos:**
1. **`challenge.wrong` (tela de erro) sem tradução em fr.json (nenhuma chave) e incompleta
   em es.json (faltava `continueAnyway`/`miloMessage`)** — utilizadores em francês viam a
   tela inteira de "errou" em português; espanhol via o botão e a mensagem do Milo em
   português. Pré-existente, não desta sessão — descoberto ao trocar idioma no Simulator
   e inspeccionar os locales. Fix: chaves adicionadas em ambos, com texto revisto (ver
   achado 2). Commit `dbd50fe`.
2. **Achado de conteúdo, não corrigido sem confirmação do user**: `challenge.wrong.miloMessage`
   em pt/en diz "Agora você já sabe esta!" / "Now you know this one" — mensagem que
   contradiz o próprio sistema de reteste (o fato acabou de ser marcado para reteste
   obrigatório, a criança não "já sabe"). As traduções novas em es/fr evitaram repetir a
   frase, mas pt/en ficaram como estavam — fica para o user decidir se quer alinhar.

**Comportamento pré-existente confirmado (não é bug introduzido, mas relevante para UX):**
timeout a meio de uma sessão descarta todo o progresso local e reinicia da questão 1 —
o servidor mantém a sessão certa (mesmo payload ao retomar), mas o cliente não guarda
progresso incremental (respostas só vão em batch no fim, por desenho). Reproduzido 3x.

**Confirmado a funcionar correctamente** (jogo real pelo teclado, não curl): overlay de
erro (WrongAnswerScreen) renderiza a equação/resposta certas; milestones 50%/75%; ecrã
vazio do Desempenho ("Nenhum fato em reteste — tudo em dia! 🎉"); gate de senha errada
("Senha incorrecta"); botão "Guardar" desactivado com valor fora do intervalo (validação
client-side impede o pedido inválido de sequer ser enviado); guardar valor válido mostra
spinner → "✓ Guardado com sucesso!" e persiste no servidor; Desempenho e Developers
100% traduzidos em FR (as chaves adicionadas nesta feature, ao contrário do achado 1 que
é dívida antiga).

Dados de teste (Testadao) e settings globais (`app_config`) repostos ao estado por defeito.

---

## Estado anterior — 2026-07-18 10:35 (sessão 16, cont. — QA-2 avançado)

### ✅ Concluído (sessão 16 cont.) — QA-2: cenário avançado (nível 4) end-to-end

Pedido do user: nova ronda de testes, "criança avançada" (nível 4), simular erros com ledger
escrito à mão ANTES de correr, depois comparar com `child_fact_retest` real E com a exibição
da tela Desempenho no Simulator.

Setup: Testinho a nível 4 (1800xp), 4 operações misturadas, 15 questões/desafio (4 vagas de
reteste), 12 fatos com mastery prévio seedado (realismo). Ciclo de 7 sessões reais via curl
(datas + `last_correct_local_date` falsificado para simular dias distintos), com previsão
escrita campo-a-campo ANTES de cada sessão. **Todas as 7 sessões bateram certo com a
previsão**, incluindo um cenário rico de fila FIFO: um fato (`fact_add_3_1`) ficou "preterido"
da garantia durante 5 sessões seguidas (fatos mais antigos ocupavam as 4 vagas), mas continuou
a poder ser puxado pela seleção adaptativa normal por sorte (streak avançou na sessão 2 mesmo
sem vaga garantida) — esclarece que "preterido da garantia" ≠ "excluído da sessão", só perde a
garantia. 3 fatos atingiram o limiar e limparam **simultaneamente** numa sessão; o 4º (com 1
recaída) fechou na sessão seguinte.

Verificação final: estado real em `child_fact_retest` bateu 100% com o ledger escrito. Copiado
o estado final para a Testadao (já autenticada no Simulator) só para validar a camada de UI —
tela Desempenho mostrou exactamente os 2 fatos "em reteste" (`3+1=4 · 2/5`, `10÷10=1 · 1/5`) e
os 4 "recuperados" com os símbolos de operação correctos. Nenhum bug novo encontrado nesta
ronda. Dados de teste limpos (Testinho + Testadao voltaram ao baseline).

---

## Estado anterior — 2026-07-18 10:15 (sessão 16, cont. — QA profundo)

### 🟢 Em curso
```
ESTADO: LIVRE — sistema de reteste persistente cross-challenge (child_fact_retest) completo,
testado a fundo (QA adversarial, ver secção abaixo) e pushed para origin/main. Tag de
segurança pré-sessão: v1.4-pre-retest-system (HEAD=7fda09c).
```

### ✅ Concluído (sessão 16 cont.) — QA profundo ao sistema de reteste

Pedido do user: "haja como QA exigente e experiente", teste profundo de tudo + verificação da
didática aplicada. 19 cenários testados via curl directo às EFs (regras de flag/par comutativo
nas 4 operações, ciclo real de 5 dias distintos até ao limiar + clear, garantia de selecção com
mais fatos que vagas, cap de 2x por sessão, RLS/segurança). Detalhe completo dado ao user em chat.

**1 bug real encontrado e corrigido:** `applyRetestOutcomes` tinha um resultado não-determinístico
— quando o par comutativo de um fato era respondido certo E o próprio fato errava na MESMA sessão,
o resultado final (streak fica 0 ou reincrementa) dependia da ordem de posições no payload
embaralhado. Reproduzido deliberadamente nas duas ordens antes do fix (uma dava resultado errado),
confirmado determinístico depois. Fix: processamento em duas fases — todos os erros (directos +
propagados ao par) resolvidos primeiro, acertos só depois, ignorando fatos já tocados por erro.
Commit `46b35a4`, redeployado (`complete_challenge`).

**1 decisão de design confirmada pelo user (não é bug):** um fato que aparece 2x na mesma sessão
(reforço do reteste) conta 2x para `child_fact_mastery` (`times_seen`/`times_correct`/
`consecutive_correct` +2 em vez de +1). O gate mais importante (`distinct_sessions_correct`) está
protegido. User escolheu deixar como está ("mais prática = mais crédito"). Ver
`.ai/feedback-tech-approach.md` para o detalhe — **não reabrir sem nova conversa**.

Todos os dados de teste (Testinho + Testadao) limpos ao fim — contas voltaram ao estado
documentado antes do QA.

### ✅ Concluído (sessão 16 — 2026-07-18) — Sistema de reteste persistente cross-challenge

**Pedido do user:** análise "arquiteto sénior" completa ao fluxo de reteste de erros +
spec fechado em conversa antes de implementar (8 rondas de perguntas/respostas). Substitui
o `retestQueue` client-side (efémero, só reaparecia no fim da MESMA sessão) por uma tabela
persistente: um erro marca o fato para reteste **garantido** em desafios futuros, até
acumular acertos em sessões distintas.

⚠️ **Achado antes de arrancar:** o `main` tinha avançado 5 commits (86886bb..7fda09c, entre
07:54–08:31 do mesmo dia) de outra sessão, mexendo na MESMA área (removeu `retryBlock`,
adicionou propagação de erro comutativo directo em `mastery.ts`/WEAK). Reconciliado com o
user em chat: essa sessão já tinha terminado; o spec desta sessão substitui por completo o
`retestQueue` por esta tabela nova; o fix em `mastery.ts` (932624f) ficou como estava —
complementar, não tocado.

**Regras de negócio (fechadas em conversa):**
- Erro em qualquer fato → `a_retestar=true`, streak=0. Par comutativo (mult/adição, via
  `fact_group_id`) também marcado automaticamente — `fact_id` isolado, sem incrementar
  `retest_wrong_count` do par (não foi literalmente perguntado, só sinalizado).
- Acerto (todas as ocorrências) em sessão/dia distinto → `retest_correct_streak++`. Erro →
  volta a zero. Limiar global (default 5, configurável) → `a_retestar=false`,
  `cleared_at` preenchido — a linha nunca é apagada (fica como histórico).
- Máx. 2 aparições do mesmo fato por sessão.
- Fatia do desafio reservada a reteste = `round(question_count × retest_percentage)`,
  default 25% (configurável). Mais antigos primeiro; excedente fica para a sessão seguinte
  (fila natural pela tabela, sem fila explícita).
- `child_fact_mastery`/`WEAK`/`adaptive-rules.json` não mudam — sistema independente.

**Backend:**
- `backend/migrations/017_child_fact_retest.sql` — tabela `child_fact_retest` (RLS: leitura
  do próprio parent, escrita só service_role) + tabela `app_config` (key/value, leitura
  pública autenticada, escrita só service_role) com seeds `retest_correct_threshold=5`,
  `retest_percentage=0.25`. Aplicada ao DB linked.
- `backend/functions/_shared/retest.ts` — `getAppConfig`, `getActiveRetestFacts`,
  `applyRetestOutcomes` (flag+streak, chamado por `complete_challenge`).
- `start_challenge`: reserva vagas de reteste (mais antigos primeiro, até 2x cada) ANTES da
  selecção adaptativa normal; exclui esses `fact_id`s da selecção normal restante.
- `complete_challenge`: agrupa respostas por `fact_id` (errou alguma vez? todas certas?) e
  aplica as regras acima, em paralelo a `updateMastery`/`applyCommutativity` (não substitui).
- `update_app_config` EF nova — único caminho de escrita em `app_config` (valida key
  allowlist + range do value). `supabase/functions/update_app_config` é symlink para
  `backend/functions/update_app_config` (mesmo padrão de `start_challenge`/`complete_challenge`).

**Client:**
- `challenge.store.ts` — `retestQueue`/`retestQuestionIndex` removidos por completo (reteste
  passa a ser 100% cross-sessão, injectado pelo payload do `start_challenge`); `[date].tsx`
  perde o header "🔁 Vamos rever!" (chave i18n `retestLabel` removida dos 4 locales).
- `src/services/app-config.service.ts` + `retest.service.ts` novos.
- `app/(app)/parent-area/developers.tsx` — nova tela: PIN normal (já herdado do parent-area)
  + senha fixa `120380` (fricção deliberada, documentada como não-segurança-real). Edita os
  2 settings globais via `update_app_config`. Tinha um bug real (botão "Entrar" atrás do
  teclado — sem `KeyboardAvoidingView`) encontrado e corrigido durante o teste no Simulator.
- `app/(app)/parent-area/child/[id].tsx` — nova secção "Desempenho": lista "Em reteste"
  (com progresso `X/limiar`) e "Recuperados", lidas de `child_fact_retest` via join com
  `arithmetic_facts` (`retest.service.ts`).

**Validação:**
- `npx tsc --noEmit` limpo (só os 3 erros pré-existentes de sempre).
- **Backend validado end-to-end via curl** directo às EFs deployadas (conta de teste
  `teste.mathhero@gmail.com`/`Testinho`): erro flagga o fato + par comutativo
  automaticamente; sessão seguinte inclui o fato garantidamente (mesmo com baixa
  probabilidade adaptativa); acerto em dia distinto avança o streak; limiar simulado (=1)
  limpa a flag e liberta a vaga para o próximo fato pendente. Dados de teste limpos depois
  (xp/question_count/child_fact_retest restaurados).
- **Telas novas validadas visualmente no Simulator** (iPhone 17 Pro, conta real do user,
  criança de teste "Testadao"): gate + settings da tela Developers (threshold=5,
  percentage=25% carregados correctamente do servidor); secção Desempenho a mostrar dados
  reais inseridos directo no DB para o teste ("10 − 1 = 9 · 2/5 acertos" em reteste,
  "10 − 2 = 8 ✓" recuperado). Dados de teste removidos depois.
- **Não testado**: um desafio real jogado do início ao fim no Simulator com um fato
  garantidamente reaparecendo dentro do payload gerado por `start_challenge` (validado só
  via curl, a lógica é a mesma que a EF usa em produção — risco residual baixo, mas fica
  registado como o único passo de validação visual que falta).

**Deploy:** `start_challenge`, `complete_challenge`, `update_app_config` (nova) deployadas
via `supabase functions deploy <nome> --use-api`. Migration 017 aplicada ao DB linked via
`supabase db query --linked -f`.

---

## Estado anterior — 2026-07-18 00:35 (sessão 15)

### 🟢 Em curso
```
ESTADO: LIVRE — as 5 fases do redesenho do motor de questões estão completas, commitadas e
pushed para origin/main (código + migrations aplicadas ao DB linked). Falta só uma verificação
visual no Simulator (ver "Pendente" abaixo) que não foi possível terminar porque o Mac bloqueou
o ecrã (login window) a meio da sessão e o user estava ausente — sem interação possível até
alguém desbloquear.

Tag de segurança pré-sessão: v1.3-pre-question-engine-v2 (permite voltar ao estado antes de
qualquer alteração desta sessão, se algo aparecer partido).

Roadmap das 5 fases — todas commitadas + pushed:
  Fase B — Randomização real + retest imediato de erros (commit 909ec25)
  Fase C — question_count por criança ligado end-to-end (commit 909ec25)
  Fase D — Timer automático que reduz com o nível (commit f2c8302)
  Fase E — Adição/subtração/divisão + modo misto (commits 0347f9b, 4772b8a)
  Fase F — Docs actualizadas (este commit)

Testadao (@tesgado) é uma criança de teste criada nesta sessão para iterar rápido — reposta a
config default (multiplication only, question_count=20, timer_auto=false) no fim da sessão.
Tem várias challenge_sessions "in_progress" órfãs de datas de Junho/Julho (de testes directos à
EF via curl + do bug de simulador descrito abaixo) — inofensivo, dados de teste.
```

### ⏭️ Pendente — verificação visual no Simulator (única coisa não confirmada)

Toda a lógica desta sessão foi validada de duas formas independentes:
1. **Chamadas directas à Edge Function via `curl`** (bypassa o Simulator inteiramente) — sessão
   mista multiplicação+adição, sessão divisão+subtração, validação de erro quando falta
   `module_id` com >1 operação activada e não mistura, mastery a gravar corretamente para os
   4 tipos de facto, `is_perfect` correcto após o fix.
2. **Simulator (iPhone 17 Pro)** para as Fases B/C/D — randomização, retry de bloco reembaralhado,
   retest de erro no fim da sessão, question_count=5 aplicado, timer automático a 20s no nível 1.

**Não confirmado visualmente no Simulator** (o ecrã bloqueou antes de chegar a esta parte):
- Checkboxes de operações + toggle "misturar" no parent-area (`app/(app)/parent-area/child/[id].tsx`) —
  o código foi revisto e o `tsc` passa limpo, mas nunca foi tocado no Simulator.
- Ecrã seletor de operação (`challenge/[date].tsx`, aparece quando >1 operação activada e não
  mistura) — lógica testada via curl (a EF rejeita/aceita `module_id` correctamente), mas o
  ecrã em si (botões, título "O que vamos praticar hoje?") nunca foi visto a renderizar.
- Operador correto (+,−,×,÷) e nome da operação a aparecer na tela de jogo para uma sessão real
  de adição/subtração/divisão (validado que os DADOS vêm corretos da EF; o render client-side
  usa `OPERATION_SYMBOLS`/`OPERATION_CATEGORY_KEYS` — revisto no código, não visto a correr).

**Próximo passo recomendado:** abrir o Simulator, criar/usar uma criança de teste, activar 2+
operações no parent-area sem misturar, iniciar um desafio e confirmar que o seletor aparece e
que o operador certo é mostrado. Devia ser ~5 min.

### ⚠️ Achado nesta sessão — simulador "iPhone 17" ficou preso após reload, possível bug de navegação

Durante os testes desta sessão, o simulador "iPhone 17" (não o "iPhone 17 Pro") ficou com um toast
"The action 'GO_BACK' was not handled by any navigator" e um spinner infinito depois de um `cmd+r`.
Nos minutos seguintes apareceram 7 `challenge_sessions` "in_progress" para Testadao em datas de Junho/
Julho diferentes, todas criadas em ~90 segundos — sem eu ter navegado manualmente por essas datas.
**Não investigado a fundo** (o simulador "iPhone 17 Pro" funcionava bem e foi o que usei para todos os
testes reais) — pode ser só o app a tentar reconectar a um Metro morto em loop, ou pode ser um bug real
de navegação retroativa a criar sessões para múltiplos dias em sequência. Se reaparecer, vale a pena
investigar `app/(app)/challenge/[date].tsx` `init()` e o fluxo de "recuperar dias em atraso" no
calendário/home. Não bloqueou o trabalho porque o outro simulador reconectou bem.

---

### ✅ Concluído (sessão 15 cont. — 2026-07-18) — Fases D+E: timer automático + adição/subtração/divisão

**Fase D — timer automático por nível:** `child_profiles.timer_auto` (migration 012) +
`resolveTimerSeconds(level, manual, auto)` em `config.ts` (patamares 20s→6s dos níveis 1 a 30+).
Toggle no parent-area dimma os chips fixos quando activo. Testado no Simulator: nível 1 + auto
→ mostra "17s" a contar a partir de 20s (a config manual era "∞", correctamente sobreposta).

**Fase E — 4 operações + modo misto (a maior fase):**
- Migrations 013-016: `arithmetic_facts` generaliza `multiplication_facts` (coluna `operation`).
  100 factos de multiplicação migrados com os MESMOS ids (preserva mastery). 300 factos novos
  gerados via SQL (`generate_series`, não escritos à mão): 100 adição (tiers por soma/operando-1),
  100 subtração (derivada da adição: c-a=b para cada facto), 100 divisão (derivada da
  multiplicação: c÷a=b). `multiplication_facts` mantida (comentada como deprecated) para
  rollback fácil — não apagar sem confirmar produção estável primeiro.
- `child_profiles.enabled_operations` (array, mín. 1) + `mix_operations` (migration 016).
- `start_challenge`: lê a config, corre a selecção adaptativa **uma vez por operação activada**
  (mastery/tiers não fazem sentido misturados entre operações — uma criança pode estar em T4 de
  multiplicação e T1 de adição), combina os resultados e reembaralha (seed única por sessão).
  Exige `module_id` do cliente só quando há >1 operação activada e `mix_operations=false`
  (senão usa a única activada, ou todas se misturar) — validado com erro `OPERATION_REQUIRED`
  quando o cliente não manda.
- Cliente: `computeAnswer`/`OPERATION_SYMBOLS`/`OPERATION_CATEGORY_KEYS` em `config.ts`
  substituem os cálculos/símbolos hardcoded a multiplicação. Seletor de operação
  (`challenge/[date].tsx`) antes de iniciar quando aplicável. Checkboxes + toggle "misturar" no
  parent-area.

**2 bugs reais encontrados e corrigidos durante a bateria de teste** (ver
`.ai/feedback-tech-approach.md` para o detalhe completo — vale a pena ler antes de tocar em
`question_count` ou em qualquer cálculo de "está certo?" no futuro):
1. `complete_challenge`: `is_perfect` comparava contra o valor fixo global (`questionsPerChallenge`
   de `adaptive-rules.json`) em vez de `session.total_questions` — bug introduzido na Fase C
   (question_count configurável), nunca apanhado até esta bateria testar `question_count≠5`.
   Qualquer criança com um `question_count` diferente do default nunca conseguia "perfeito"
   mesmo acertando tudo.
2. `challenge.store.ts` (3 selectors) + o ecrã de fim de bloco recalculavam "está certo?" como
   `child_answer === operand_a * operand_b` — óbvio para multiplicação, errado para +,−,÷.
   `AnswerDraft` ganhou `correct_answer` (calculado uma vez, não recalculado a cada leitura).

**Validação:** `npx tsc --noEmit` limpo (só os 3 erros pré-existentes de sempre). Testado
directamente contra a Edge Function via `curl` (bypassa o Simulator): sessão mista
multiplicação+adição (5+5, embaralhada), sessão divisão+subtração (9/10 correctas testado de
propósito), validação de `module_id` obrigatório, mastery a gravar correctamente para os 4 tipos
de facto, `is_perfect=true` confirmado após o fix numa sessão 10/10. **Não testado visualmente
no Simulator** (ecrã bloqueou a meio — ver "Pendente" no topo do handoff).

**Deploy:** `start_challenge`, `complete_challenge`, `recompute_mastery` redeployados
(`--use-api`). Migrations 011-016 aplicadas ao DB linked via `supabase db query --linked -f`.

**Docs actualizadas:** `CLAUDE.md` (secção Challenge + fase actual), banner de aviso em
`docs/adaptive-multiplication-system.md` (desatualizado desde esta fase — o algoritmo descrito
está certo, o schema literal não). `docs/database-schema.md` já estava desatualizado desde a
Phase 2.5 (nunca mencionou `multiplication_facts`/`child_fact_mastery`) — dívida pré-existente,
não coberta nesta sessão; fica registado para uma sessão de docs dedicada.

**2 issues de dead code encontradas e sinalizadas (spawn_task, não corrigidas nesta sessão):**
- `ChildSettingsCard` em `settings.tsx` (~280-438) — nunca renderizado.
- `complete_challenge/index_dashboard.ts` — versão obsoleta pré-Phase 2.5, nunca deployada.

---

### ✅ Concluído (sessão 15 — 2026-07-17) — Fases B+C do redesenho do motor de questões

**Pedido do user:** análise completa como "desenvolvedor arquiteto senior" ao motor de questões —
8 pontos (aleatoriedade real, retest de erros, question count configurável, dificuldade progressiva
por nível, timer que reduz com o nível, +soma/subtração/divisão com modo misto, sistema tipo Duolingo,
tag de segurança antes de mudar). Trabalho autónomo enquanto o user estava fora — acesso ao Simulator +
clipboard concedido via `request_access` no início da sessão.

**Antes de começar:** encontradas ~1130 linhas não commitadas de sessões anteriores (ranking realtime
+ retest, sons, calendário retroativo) que o handoff nunca mencionou — commitadas em 4 commits lógicos
(`f202432`, `69c243e`, `22ad0c1`, `3e5ac6b`) e pushed antes de tocar em código novo. Tag
`v1.3-pre-question-engine-v2` criada a seguir, como baseline de rollback.

**Causa raiz dos 2 bugs principais reportados pelo user:**
1. **"Sempre a mesma ordem"** — `question-selector.ts` não tinha NENHUMA fonte de aleatoriedade.
   `interleaveByDifficulty()` e os desempates de sort (`hash(a.id)`) eram 100% deterministos — para o
   mesmo estado de mastery, a ordem nunca mudava, mesmo em sessões diferentes.
2. **"Reiniciar bloco repete igual"** — `retryBlock()` em `challenge.store.ts` reaproveitava o mesmo
   array `questions` já buscado no início da sessão, sem nunca reembaralhar.

**Fix (commit `909ec25`):**
- `question-selector.ts`: PRNG mulberry32 seedado por `session_id` — tie-breaks e ordem final
  (`seededShuffle`) passam a variar por sessão; resume da mesma sessão continua estável (mesma seed).
- `retryBlock()`: reembaralha as questões do bloco (Fisher-Yates) em vez de repetir a ordem.
- Fila de reteste (`retestQueue`/`retestQuestionIndex` no store): quando o filho erra e escolhe
  "Continuar" (sem retry), a questão fica marcada e reaparece no fim da sessão antes de completar —
  header muda para "🔁 Vamos rever!". Testado end-to-end no Simulator: sessão de 5 perguntas, 1 erro
  "continuado", reapareceu correctamente no fim, acertar nessa 2ª vez contou para o bónus "perfeito".
- `child_profiles.question_count` (migration 011) ligado end-to-end — `start_challenge` lê o valor real
  da criança em vez do fixo de `adaptive-rules.json`. O picker já existia na UI (parent-area E também
  num `ChildSettingsCard` morto em settings.tsx — ver issue abaixo) mas escrevia só em AsyncStorage,
  completamente desligado do motor.
- Migration 011 também corrigiu CHECK constraints latentes (`question_index between 0 and 19`,
  `block_number between 1 and 4`) que já estavam desalinhados com `QUESTION_COUNT_OPTIONS` incluir 25
  — nunca disparou porque question_count nunca era lido, mas ia rebentar assim que fosse.
- Reverte flags DEV (`TOTAL_QUESTIONS=5`→20, `BLOCKS_PER_SESSION` removido) — question_count real
  torna o atalho de teste desnecessário.

**Achado durante o teste (não é bug, é comportamento esperado):** testando rapidamente com uma criança
nova (Testadao, nível 1, só T1+T2 desbloqueados), pareceu que a mesma combinação de 5 factos repetia em
padrão de período 3 entre sessões — pareceu um bug de RNG. Isolado com testes directos ao PRNG (Node) e
chamadas directas à Edge Function via curl com datas/seeds genuinamente novas: a aleatoriedade está
correcta (5 datas novas → 5 combinações diferentes). A causa real: `crossSessionCooldown=2` +
pool pequeno (19 factos T1, quotas concentradas no bucket NEW porque a criança não tem mastery
nenhuma ainda) faz o conjunto de "factos disponíveis após exclusão" ciclar rapidamente — e o teste
apanhou uma sessão retroativa (dia 16) que já tinha um payload cacheado de uma tentativa anterior
(idempotência a funcionar correctamente, não a repetir por bug). Não é preciso ajustar
`crossSessionCooldown` agora — registado aqui para não se confundir com um bug real numa sessão futura.

**Issue nova encontrada (não corrigida, fora do âmbito):** `ChildSettingsCard` em
`app/(app)/(tabs)/settings.tsx` (linhas ~280-438) está completamente morto — define pickers de
timer/tabuadas/nº de questões só ligados a `childService.updateChild`, mas nunca é renderizado em
lado nenhum (só `<ChildrenInfoCard />`, versão só-leitura, aparece no render de `SettingsScreen`).
Sinalizado como spawn_task (`task_a3242239`) para remoção numa sessão separada.

**Validação:** `npx tsc --noEmit` limpo (só os 3 erros pré-existentes de friends.tsx/ranking.tsx,
`Image`/`social_enabled`, confirmados no `git log` como não desta sessão). Testado no Simulator
(iPhone 17 Pro) com criança de teste: question_count=5 aplicado, sessão completa, retry de bloco
reembaralhado, retest de erro no fim da sessão, XP/nível actualizados correctamente.

**Deploy:** `start_challenge` re-deployada (`supabase functions deploy start_challenge --use-api`).
Migration 011 aplicada directo ao DB linked via `supabase db query --linked -f`.

**Próximo passo:** Fase D (timer automático por nível) — ver roadmap em "Em curso" acima.

---

### ✅ Concluído (sessão 14 — 2026-07-17) — Eliminar filho definitivamente (parent-area)

**Pedido do user:** opção nas definições dos pais para apagar um filho de forma definitiva, sem
deixar dados órfãos.

**Descoberta:** praticamente todas as FKs para `child_profiles.id` já tinham `ON DELETE CASCADE`
(challenge_sessions, challenge_answers, child_xp_ledger, calendar_days, child_trophies,
child_achievements, child_level_rewards, friendships, friend_requests, messages, child_fact_mastery —
ver `backend/migrations/001_initial_schema.sql`). Não havia policy RLS de `DELETE` em `child_profiles`
(de propósito — só `service_role` pode apagar), por isso o delete **tem** de passar por Edge Function.

**`backend/functions/delete_child/index.ts`** (novo, copiado para `supabase/functions/` e deployado
com `--use-api`): recebe `{ child_id }`, autentica o parent via `Authorization` header
(`supabase.auth.getUser()`), confirma com `supabaseAdmin` que `child_profiles.parent_id === user.id`
(evita um pai apagar filho de outra conta só por saber o id), depois `DELETE FROM child_profiles WHERE
id = child_id` com service role — cascade trata do resto. Mesmo padrão de auth que `verify_parent_pin`.

**`src/services/child.service.ts`**: `deleteChild(childId)` novo — chama a EF via
`supabase.functions.invoke`, mesmo padrão de erro de `cancelFriendRequest` em `social.service.ts`.

**`app/(app)/parent-area/child/[id].tsx`**: secção "Zona de perigo" no fundo do ecrã (depois das
stats). Fluxo: botão vermelho → `Alert.alert` de confirmação → caixa inline pedindo para escrever
`@username` exacto → botão "Eliminar definitivamente" (disabled até bater) → chama `deleteChild` →
invalida query `['children', parentId]` → se era o `activeChild`, `clearActiveChild()` (o guard de
`(app)/_layout.tsx` não redirecciona porque `parent-area` está em `PARENT_ONLY_ROUTES`) → `router.back()`.

**i18n:** chaves novas em `parentArea.child.*` (dangerZoneTitle, dangerZoneHint, deleteBtn,
deleteWarning, deleteConfirmLabel, deleteConfirmPlaceholder, deleteConfirmBtn, deleteCancelBtn,
deleteMismatch) traduzidas em pt/en/es/fr.

**Nota separada (não mexida):** `es.json`/`fr.json` já tinham um buraco pré-existente de ~16 chaves
em `parentArea` (changePassword, pinSection, removePinBtn, etc. só existem em pt/en) — fora do
âmbito deste pedido, mas fica registado para uma futura sessão de i18n audit.

**Validação:** `npx tsc --noEmit` limpo nos ficheiros tocados (os 3 erros restantes são pré-existentes,
confirmados via `git log` que não vêm desta sessão). ESLint não corre neste ambiente (erro de config
`ajv` pré-existente). Deploy da EF confirmado com sucesso (`supabase functions deploy delete_child
--use-api`).

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
- **`ChildSettingsCard` morto em `settings.tsx`** (linhas ~280-438) — nunca renderizado, duplica a
  funcionalidade viva de `parent-area/child/[id].tsx`. Sinalizado como spawn_task `task_a3242239`.
- **`complete_challenge/index_dashboard.ts` obsoleto** — versão pré-Phase 2.5 (seed-based, XP
  10/200/100), nunca deployada nem referenciada. Sinalizado como spawn_task `task_8d9a3d26`.
- **Simulador "iPhone 17" com `GO_BACK` não tratado + spinner infinito** após `cmd+r` (sessão 15) —
  gerou 7 `challenge_sessions` órfãs para uma criança de teste em datas diferentes em ~90s. Não
  reproduzido de forma controlada; ver nota completa na sessão 15 acima antes de investigar.
- **Verificação visual da Fase E no Simulator pendente** — ecrã bloqueou a meio da sessão 15
  (login window, Mac inacessível). Ver secção "Pendente" no topo do handoff para o que falta.
- `docs/database-schema.md` desactualizado desde a Phase 2.5 (nunca chegou a mencionar
  `multiplication_facts`/`child_fact_mastery`, agora também não menciona `arithmetic_facts`/
  `enabled_operations`) — dívida documental antiga, não coberta nesta sessão.

---

### ⏭️ Próximos passos (por prioridade)

**A — Verificação visual no Simulator do redesenho do motor de questões (sessão 15 completa, só falta isto):**
- Parent-area: checkboxes de operações + toggle "misturar" renderizam e gravam correctamente
- Seletor de operação antes do desafio (quando >1 activada, não misturado)
- Operador (+,−,×,÷) e nome da operação correctos na tela de jogo para uma sessão real de
  adição/subtração/divisão
- Ver secção "Pendente" no topo do handoff para o contexto completo

**B — Phase 4 — Calendar (pendente de sessões anteriores, ainda válido):**
- Retroactive challenge flow — já em uso, mas revisitar após a Fase E (múltiplas operações por dia)

**C — Push notifications em device:**
- Mac Terminal: `bash .scripts/setup-push-notifications.sh`
- EAS build Android (gratuito)

**D — Limpeza de dívida técnica (spawn_tasks já criadas nesta sessão):**
- Remover `ChildSettingsCard` morto em `settings.tsx` (`task_a3242239`)
- Remover `complete_challenge/index_dashboard.ts` obsoleto (`task_8d9a3d26`)
- `expo-av` incompatível com SDK — sons comentados com TODO
- `friends/list.tsx`: "Nível X" nos sub-labels ainda hardcoded
- Git locks virtiofs: usar `/tmp` clone para commits (ver workaround em CLAUDE.md)
- `docs/database-schema.md` desactualizado desde a Phase 2.5 — sessão de docs dedicada
