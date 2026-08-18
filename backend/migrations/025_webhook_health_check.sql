-- 025 — Fecha o ponto cego encontrado na sessão de hoje: nada monitorizava a saúde do
-- próprio evolution-webhook. A camada 2 (connection.update) só alerta quando RECEBE um
-- evento — se o webhook em si está a rejeitar tudo com 401 (exactamente o que aconteceu
-- hoje, verify_jwt=true por engano num deploy), a camada 2 fica cega, silenciosamente, sem
-- avisar ninguém. Isto adiciona um 4º check ao railway-health-check (mesmo cron de 5 min):
-- um pedido OPTIONS ao próprio endpoint (sem side-effects, testa exactamente o gate de
-- verify_jwt que partiu hoje) — camada e toggle próprios, para não misturar com "servidor
-- Railway fora do ar" (falha diferente, causa diferente).

alter table public.railway_health_state
  add column webhook_is_up boolean not null default true;

alter table public.ops_alert_settings
  add column webhook_alert_enabled boolean not null default true;
