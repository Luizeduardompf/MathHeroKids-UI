-- 021 — Mesada da Tabuada Semanal Premiada (valor em euros) + resumo de domingo à noite
--
-- O pai define, por criança, quanto vale a mesada se a semana ficar completa (7/7 dias).
-- Cada dia completo (o dia inteiro, os 5 blocos + o desafio diário — mesma definição de
-- "dia completo" de weekly_tabuada_days.completed_at) vale 1/7 desse valor; a app mostra
-- um totalizador ao vivo na tela da Tabuada Semanal (ver tabuadaSemanal.weeklyEarned no
-- frontend). O valor é puramente informativo — não há nenhuma transação financeira real,
-- só um número para o pai saber quanto pagar. Ao domingo à noite (21h fixo, sem picker —
-- é sempre o fecho da semana Seg-Dom), pai e criança recebem um WhatsApp com o resumo:
-- quantos dias fez e quanto ganhou.

alter table public.child_profiles
  add column if not exists tabuada_weekly_reward numeric(6,2) not null default 0
    check (tabuada_weekly_reward >= 0);

comment on column public.child_profiles.tabuada_weekly_reward is
  'Mesada (euros) que o pai paga se a criança completar os 7 dias da Tabuada Semanal Premiada. Cada dia completo vale 1/7 deste valor — puramente informativo, sem transação real.';

alter table public.notification_preferences
  add column if not exists tabuada_weekly_summary_enabled boolean not null default true;

comment on column public.notification_preferences.tabuada_weekly_summary_enabled is
  'Resumo semanal da Tabuada Semanal Premiada ao pai — domingo às 21h fixo (não configurável, ver send-whatsapp-notifications).';

alter table public.child_notification_settings
  add column if not exists tabuada_weekly_summary_enabled boolean not null default true;

comment on column public.child_notification_settings.tabuada_weekly_summary_enabled is
  'Resumo semanal da Tabuada Semanal Premiada enviado à própria criança — mesmo horário fixo (domingo 21h) do resumo do pai.';

alter table public.whatsapp_notification_log
  drop constraint whatsapp_notification_log_notification_type_check;

alter table public.whatsapp_notification_log
  add constraint whatsapp_notification_log_notification_type_check
    check (notification_type in (
      'daily_reminder', 'unfinished_warning', 'completed_notice', 'weekly_summary',
      'tabuada_reminder_1', 'tabuada_reminder_2', 'tabuada_reminder_3', 'tabuada_reminder_4',
      'tabuada_medal_parent', 'tabuada_weekly_summary'
    ));
