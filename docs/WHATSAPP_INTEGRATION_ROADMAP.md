# Roadmap — Integração WhatsApp (Evolution API) no Math Hero Kids

Estado: **em implementação** (sessão iniciada 2026-07-18).
Baseado na arquitetura já validada em produção no LukaPsi (`Luka/Luka`), adaptada às
necessidades do MathHeroKids e com dois hardenings de segurança aplicados desde o dia 1
(ver secção "Diferenças vs. LukaPsi").

## Objetivo

Permitir notificações automáticas por WhatsApp para pais e crianças sobre o desafio diário:
lembrete para fazer, aviso de desafio não feito, aviso de desafio concluído (só pai) e resumo
semanal (só pai). Cada pai e cada criança tem o seu próprio número de WhatsApp; cada tipo de
notificação é configurável (ativo/inativo + horário) de forma independente.

## Decisões de produto (confirmadas com o utilizador)

- **Definições > Notificações** (pai): switch mestre + 4 tipos, cada um com toggle + horário:
  1. `daily_reminder` — lembrete para fazer o desafio do dia
  2. `unfinished_warning` — aviso de desafio ainda não feito
  3. `completed_notice` — aviso de desafio do dia realizado
  4. `weekly_summary` — resumo semanal (+ dia da semana)
  Enviadas para o **número de WhatsApp do pai** (`parent_profiles.whatsapp_phone`).
- **Por criança** (dentro de "Editar criança"): número de WhatsApp da criança +
  2 tipos configuráveis (toggle + horário): `daily_reminder`, `unfinished_warning`.
  Enviadas para o **número de WhatsApp da criança** (`child_profiles.whatsapp_phone`) —
  campo opcional, pode ficar vazio se a criança não tiver telefone próprio.
- `completed_notice` e `weekly_summary` só existem ao nível do pai (não faz sentido avisar a
  criança que ela completou algo que ela mesma acabou de fazer).
- Os 4/2 tipos são **agendados por horário e avaliados no momento do envio** (padrão cron,
  não outbox event-driven) — ao contrário do XP/gamificação, notificações não precisam de
  garantia forte de entrega nem de idempotência complexa; um cron horário que verifica
  `calendar_days` no momento do disparo é suficiente e mais simples.
  - `daily_reminder` / `unfinished_warning`: dispara só se o desafio do dia **ainda não**
    está `completed` em `calendar_days` no momento do trigger.
  - `completed_notice`: dispara só se o desafio do dia **já está** `completed`.
  - `weekly_summary`: agregação da semana anterior (dias completos, XP ganho, streak) — não
    depende do estado do dia atual.

## Arquitetura — resumo (ver relatório completo mais abaixo)

Réplica do padrão validado no LukaPsi:

```
App (client)                Edge Functions (Supabase)              Evolution API (Railway)
─────────────                ──────────────────────────              ────────────────────────
Developer area  ──invoke──▶  evolution-dev (proxy)        ──REST──▶  instance/create
  (QR, status,                 · valida JWT                          instance/connect
   teste, reset)               · lê Vault (get_evolution_config)     instance/connectionState
                                                                       instance/delete

Definições >     ──upsert──▶  notification_settings /
 Notificações                  child_notification_settings
                                (RLS: dono só)

pg_cron (hora a  ──invoke──▶  send-whatsapp-notifications  ──REST──▶  message/sendText
 hora, cada tipo)               · varre settings + calendar_days
                                 · dedup via whatsapp_notification_log
                                 · lê Vault (get_vault_secrets)

Evolution API    ──webhook─▶  evolution-webhook (verify_jwt=false)
 (connection.update,            · grava whatsapp_events
  messages.update)              · alerta e-mail em queda de ligação
```

## Diferenças vs. LukaPsi (hardening desde o dia 1)

1. **RPCs de Vault (`get_evolution_config`, `get_vault_secrets`) nascem com `EXECUTE`
   restrito a `service_role`** — no LukaPsi isto foi um leak descoberto e corrigido depois
   (migrations `20260709_135`/`20260713_210`). Aqui já nasce correto.
2. **`whatsapp_events` sem SELECT para `authenticated`** — o LukaPsi permite qualquer
   utilizador autenticado ler todos os eventos da instância partilhada via REST directa
   (RLS `authenticated` em SELECT). Aqui, só `service_role` lê; o ecrã Developer usa sempre
   o proxy `evolution-dev`, nunca lê a tabela diretamente.
3. **PIN da área Developer (120380) já existe no MathHeroKids** (`app/(app)/parent-area/developers.tsx`,
   pré-existente) — reutilizado tal-e-qual, mesmo padrão do LukaPsi (comparação local no
   bundle, sem validação server-side, documentado como fricção deliberada e não segurança
   real). Vamos **acrescentar** uma secção "Integração WhatsApp" dentro dele.

## Fases

### Fase 1 — Schema de BD ✅ (aplicado ao projecto Supabase `pelhtuspcofmejzqtibx`)
- `parent_profiles.whatsapp_phone` / `whatsapp_phone_ddi`
- `child_profiles.whatsapp_phone` / `whatsapp_phone_ddi`
- `notification_preferences` (001, extendida na 018 — 1:1 parent_profiles)
- `child_notification_settings` (1:1 child_profiles)
- `whatsapp_notification_log` (dedup + auditoria)
- `whatsapp_events` (log bruto de webhooks, só service_role)
- RPCs de Vault restritas a `service_role`
- Migrations: `backend/migrations/018_whatsapp_notifications.sql`,
  `backend/migrations/019_whatsapp_notifications_cron.sql`
- Vault: `project_url`, `service_role_key` (para o cron), `evolution_api_url`/`evolution_api_key`/
  `evolution_instance_name` ✅ configurados (Fase 3 concluída)

### Fase 2 — Edge Functions ✅ (deployadas)
- `evolution-dev` — proxy (status/QR/reset), igual ao padrão LukaPsi
- `evolution-webhook` — log de eventos + reconciliação de entrega falhada
- `send-whatsapp-notifications` — cron horário (`pg_cron`, job `whatsapp-notifications-hourly`)
- `test-whatsapp-message` — usado só pelo ecrã Developer para testar envio manual

### Fase 3 — Infra Railway ✅ (2026-07-19)
- Projeto Railway novo **`mathhero-whatsapp`** (id `a0bb1f57-d4ad-4b28-8e01-7f7b7e7ee84a`),
  workspace "Luiz Eduardo de Menescal's Projects", **isolado do `luka-whatsapp`** (nunca tocado).
- Serviço `evolution-api`: imagem **`evoapicloud/evolution-api:v2.3.7`** — **não** `atendai/evolution-api`
  (ver nota abaixo sobre o porquê). URL pública:
  `https://evolution-api-production-1246.up.railway.app`. Instância única: `mathhero-main`.
- Serviço `Postgres` (template oficial Railway, `ghcr.io/railwayapp-templates/postgres-ssl:18`)
  — **diferença deliberada vs. LukaPsi**: Evolution API **v2.x exige Postgres** para arrancar
  (`prisma migrate deploy` corre sempre no boot, mesmo com `DATABASE_ENABLED=false` — não é
  opcional como era no v1.x do LukaPsi). Isto elimina de raiz a limitação conhecida do LukaPsi
  ("perde sessão/QR em restart do container", já documentada como pendência de melhoria lá).
- Variáveis definidas em `evolution-api`: `AUTHENTICATION_API_KEY` (gerada, guardada só no
  Vault), `SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`, `LANGUAGE=pt-BR`,
  `DATABASE_ENABLED=true`, `DATABASE_PROVIDER=postgresql`,
  `DATABASE_CONNECTION_URI=${{Postgres.DATABASE_URL}}` (rede privada Railway),
  `DATABASE_SAVE_DATA_INSTANCE=true` (resto dos `DATABASE_SAVE_*` a `false` — não precisamos de
  histórico de mensagens/contactos/chats persistido), `CACHE_REDIS_ENABLED=false`,
  `CACHE_LOCAL_ENABLED=true` (sem Redis — volume baixo, cache em memória chega).
- Vault Supabase: `evolution_api_url`, `evolution_api_key`, `evolution_instance_name`
  configurados via `vault.create_secret` (não versionado, valores reais só no Vault).
- Webhook da instância configurado (`POST /webhook/set/mathhero-main`) →
  `evolution-webhook`, eventos `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE`,
  `QRCODE_UPDATED`.
- **Testado ponta-a-ponta**: `evolution-dev` chamada com JWT real da conta de teste devolveu
  QR code válido (base64 PNG) da instância `mathhero-main` recém-criada. `evolution-webhook`
  testado com payload sintético → gravou em `whatsapp_events` corretamente.

**Nota — `atendai/evolution-api` não funciona no Railway (2026-07-19):** a imagem que o
LukaPsi documentava (`atendai/evolution-api:v1.7.4`) falha o deploy no Railway **sem gerar
nenhum log** (nem build nem runtime) — mesmo `nginx:latest` no mesmo projeto/conta funciona
normalmente, isolando o problema à imagem em si, não à conta/Railway. A causa mais provável:
o repositório Docker Hub `atendai/evolution-api` está descontinuado/com metadados quebrados
(a API do Docker Hub devolve campos vazios para ele) — o projeto migrou para o namespace
**`evoapicloud/evolution-api`**, activamente mantido (pushes recentes, v2.x). A troca de
imagem resolveu o deploy instantaneamente. **Se o LukaPsi alguma vez precisar de re-deployar
a instância dele do zero, este mesmo problema vai acontecer lá** — vale a pena avisar, mas
não mexer no projeto deles agora.

### Fase 4 — UI ✅
- `app/(app)/parent-area/notifications.tsx` — Definições > Notificações (pai), 4 tipos
- `app/(app)/parent-area/edit-profile.tsx` — campo WhatsApp do pai
- `app/(app)/parent-area/child/[id].tsx` — campo WhatsApp da criança + 2 tipos de notificação
- `app/(app)/parent-area/developers.tsx` — nova secção "Integração WhatsApp" (link)
- `app/(app)/parent-area/developer-whatsapp.tsx` — QR code, status, testar envio, reset

### Fase 5 — Teste e documentação ✅ (parcial — falta toque manual na UI)
- `npm run type-check` ✅ limpo (erros restantes pré-existentes, não relacionados)
- `npm run lint` — quebrado por um problema de ambiente pré-existente (crash no `ajv`), não
  relacionado com este trabalho
- Bundle Metro testado (força build de `index.bundle?platform=ios` — sem erros) + screenshot
  do Simulator do utilizador confirmando app viva com o bundle novo
- Backend testado ponta-a-ponta via curl/Edge Functions reais (ver Fase 3)
- **Não testado**: navegação por toque nos ecrãs novos (Notificações, Developer > WhatsApp) —
  acesso ao Simulator foi recusado pelo utilizador nesta sessão
- `CLAUDE.md` atualizado com a nova secção de arquitetura
- `docs/database-schema.md` **não** atualizado (já estava marcado como desatualizado antes
  desta feature — ver nota no topo do CLAUDE.md, tratar numa sessão de docs dedicada)

## Bloqueios que exigem presença do utilizador (não automatizáveis)

1. ~~**Login Railway** (OAuth)~~ ✅ feito em 2026-07-19.
2. **Emparelhamento QR do WhatsApp** — dentro da própria app (Developer > Integração
   WhatsApp), o utilizador escaneia o QR com o telemóvel que vai servir de número de envio.
   **Ainda por fazer** — a instância `mathhero-main` existe e está pronta (`status: close`),
   só falta abrir a app e escanear. Pode ser feito a qualquer momento.
3. **Conta Resend para alertas de ops** (opcional, mesma limitação que o LukaPsi tem hoje —
   sandbox mode, só chega ao email da conta) — não bloqueia a funcionalidade principal,
   só os alertas de queda de servidor. Não implementado nesta fase.
4. **Testar por toque na UI** — acesso ao Simulator recusado nesta sessão; verificação só
   estática (type-check, bundle, screenshot). Conceder acesso numa próxima sessão para validar
   visualmente Notificações e Developer > Integração WhatsApp.

## Nota operacional — perda de ficheiros locais não commitados (2026-07-19)

Entre a sessão de 2026-07-18 (schema, Edge Functions e cron aplicados/deployados directamente
no Supabase remoto) e a continuação em 2026-07-19, o ambiente local reiniciou e todos os
ficheiros criados nessa sessão que **ainda não tinham sido commitados** desapareceram do
working tree (git log local mostra um histórico totalmente diferente, sem nenhum commit
desta feature). O trabalho no Supabase (schema, functions, cron, vault) sobreviveu porque é
remoto — só os ficheiros locais (migrations, source das EFs, docs, services, tipos) tiveram
de ser reescritos nesta sessão. Lição aplicada: commitar a cada ficheiro concluído, como já
determina a secção "Protocolo obrigatório" deste CLAUDE.md — que não tinha sido seguida
rigorosamente na sessão anterior desta feature.
