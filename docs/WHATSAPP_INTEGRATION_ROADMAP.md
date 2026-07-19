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
  `evolution_instance_name` **pendentes** (Fase 3, depois do deploy no Railway)

### Fase 2 — Edge Functions ✅ (deployadas)
- `evolution-dev` — proxy (status/QR/reset), igual ao padrão LukaPsi
- `evolution-webhook` — log de eventos + reconciliação de entrega falhada
- `send-whatsapp-notifications` — cron horário (`pg_cron`, job `whatsapp-notifications-hourly`)
- `test-whatsapp-message` — usado só pelo ecrã Developer para testar envio manual

### Fase 3 — Infra Railway ⏳ (bloqueado — precisa do utilizador)
- Novo projeto Railway **isolado do LukaPsi** (conta/projeto próprios)
- Deploy Evolution API (mesma imagem/versão do LukaPsi: v1.7.4, `WHATSAPP-BAILEYS`)
- `DATABASE_ENABLED=false` para MVP (mesma limitação conhecida: perde sessão em restart —
  aceite conscientemente, documentado, plano de upgrade para Postgres dedicado se necessário)
- Configurar Vault no Supabase (`evolution_api_url`, `evolution_api_key`, `evolution_instance_name`)
- Configurar webhook na Evolution API a apontar para `evolution-webhook`
- **Bloqueio**: login Railway exige OAuth no browser — só o utilizador pode autorizar
  (`railway login --browserless`, ver secção de bloqueios abaixo)

### Fase 4 — UI (em curso)
- `app/(app)/parent-area/notifications.tsx` — Definições > Notificações (pai), 4 tipos
- `app/(app)/parent-area/edit-profile.tsx` — campo WhatsApp do pai
- `app/(app)/parent-area/child/[id].tsx` — campo WhatsApp da criança + 2 tipos de notificação
- `app/(app)/parent-area/developers.tsx` — nova secção "Integração WhatsApp" (link)
- `app/(app)/parent-area/developer-whatsapp.tsx` — QR code, status, testar envio, reset

### Fase 5 — Teste e documentação
- `npm run type-check` + `npm run lint`
- Testar fluxo completo no Simulator/dev server (golden path + edge cases: sem número,
  notificações desativadas, instância desligada)
- Atualizar `CLAUDE.md` com a nova área de arquitetura crítica
- Atualizar `docs/database-schema.md`

## Bloqueios que exigem presença do utilizador (não automatizáveis)

1. **Login Railway** (OAuth) — feito uma vez no início da sessão via `railway login --browserless`.
   Cada código de pairing expira em ~10-15 min — tem de ser gerado e autorizado na mesma
   janela de tempo (não vale a pena gerar com antecedência).
2. **Emparelhamento QR do WhatsApp** — dentro da própria app (Developer > Integração
   WhatsApp), o utilizador escaneia o QR com o telemóvel que vai servir de número de envio.
   Pode ser feito em qualquer altura depois do deploy, não bloqueia o resto do trabalho.
3. **Conta Resend para alertas de ops** (opcional, mesma limitação que o LukaPsi tem hoje —
   sandbox mode, só chega ao email da conta) — não bloqueia a funcionalidade principal,
   só os alertas de queda de servidor. Não implementado nesta fase.

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
