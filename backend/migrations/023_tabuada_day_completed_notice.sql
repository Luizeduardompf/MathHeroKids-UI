-- Nova notificação ao pai: dispara sempre que a criança conclui o dia da Tabuada Semanal
-- Premiada (5 blocos + desafio diário normal — ver backend/functions/_shared/tabuada.ts:
-- tryCompleteDay). Segue o mesmo padrão de tabuada_medal_notice_enabled (sem horário fixo,
-- dispara em qualquer tick do cron assim que weekly_tabuada_days.completed_at de hoje for
-- preenchido; dedup natural via whatsapp_notification_log, 1 envio por tipo/dia/destinatário).
alter table notification_preferences
  add column if not exists tabuada_day_completed_enabled boolean not null default false;
