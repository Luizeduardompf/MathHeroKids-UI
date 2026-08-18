/**
 * send-whatsapp-notifications — Edge Function (Deno), invocada por pg_cron a cada hora
 * (ver migration 019). Não recebe pedidos do cliente.
 *
 * Para cada tipo de notificação (4 do pai + 2 da criança), verifica se a hora configurada
 * bate com a hora actual (timezone fixo — ver NOTIFICATIONS_TIMEZONE) e, se sim, decide se
 * deve enviar consultando calendar_days:
 *   - daily_reminder / unfinished_warning → envia só se o dia AINDA NÃO está 'completed'
 *   - completed_notice                    → envia só se o dia JÁ está 'completed'
 *   - weekly_summary                      → agregação da semana anterior, sem depender do dia actual
 *
 * Dedup via whatsapp_notification_log (unique por parent/child/target/tipo/dia) — se o cron
 * correr duas vezes na mesma hora (retry), o insert falha silenciosamente (23505) e não
 * reenvia.
 *
 * Também cobre o módulo "Tabuada Semanal Premiada" (independente do desafio diário):
 *   - tabuada_reminder_1..4 (criança) → até 4 horas configuráveis (tabuada_reminder_hours),
 *     dispara em cada uma se weekly_tabuada_days de hoje ainda não tiver completed_at.
 *   - tabuada_medal_parent (pai)      → notificação ÚNICA (não agendada, não é por dia — ver
 *     weekly_tabuada_weeks.medal_notified_at), disparada assim que medal_earned_at fica
 *     preenchido; reivindicada atomicamente por update condicional antes de enviar.
 *   - tabuada_day_completed (pai)     → aviso a cada dia em que o filho conclui os 5 blocos +
 *     desafio diário (weekly_tabuada_days.completed_at), sem horário fixo — dedup natural via
 *     whatsapp_notification_log (1 envio/dia) evita repetição entre ticks do cron.
 *   - tabuada_weekly_summary (pai + criança) → resumo da semana (dias feitos + mesada
 *     ganha, ver child_profiles.tabuada_weekly_reward), horário FIXO domingo 21h (sem
 *     picker — é sempre o fecho da semana Seg-Dom, não faz sentido ser configurável).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getEvolutionConfig, buildWhatsAppNumber, sendWhatsAppText, getLocalNow, timeMatchesHour } from '../_shared/whatsapp.ts';
import { mondayOfWeek, weeklySummaryEarnedCents, centsToEuroLabel } from '../_shared/tabuada.ts';
import { sendOpsAlert } from '../_shared/opsAlert.ts';
import { getOpsAlertSettings } from '../_shared/opsAlertSettings.ts';

const TIMEZONE = Deno.env.get('NOTIFICATIONS_TIMEZONE') ?? 'Europe/Lisbon';
const TABUADA_WEEKLY_SUMMARY_WEEKDAY = 0; // domingo
const TABUADA_WEEKLY_SUMMARY_HOUR = 21;   // 21h fixo, sem picker

type Lang = 'pt' | 'en' | 'es' | 'fr';

const TEMPLATES: Record<Lang, {
  dailyReminderParent: (name: string) => string;
  unfinishedWarningParent: (name: string) => string;
  completedNoticeParent: (name: string) => string;
  dailyReminderChild: (name: string) => string;
  unfinishedWarningChild: (name: string) => string;
  weeklySummary: (name: string, days: number, xp: number, streak: number) => string;
  tabuadaReminderChild: (name: string) => string;
  tabuadaMedalParent: (name: string) => string;
  tabuadaWeeklySummaryParent: (name: string, days: number, earned: string, total: string) => string;
  tabuadaWeeklySummaryChild: (name: string, days: number, earned: string) => string;
  tabuadaDayCompletedParent: (name: string) => string;
}> = {
  pt: {
    dailyReminderParent: (n) => `Olá! 👋 Só um lembrete: ${n} ainda não fez o desafio de matemática de hoje no Math Hero Kids.`,
    unfinishedWarningParent: (n) => `${n} continua sem fazer o desafio de hoje. ⏰ Vale a pena dar um empurrãozinho antes que o dia acabe!`,
    completedNoticeParent: (n) => `Boas notícias! 🎉 ${n} já completou o desafio de matemática de hoje.`,
    dailyReminderChild: (n) => `Olá ${n}! 🚀 Não te esqueças de fazer o teu desafio de matemática de hoje no Math Hero Kids!`,
    unfinishedWarningChild: (n) => `${n}, ainda dá tempo de fazer o teu desafio de hoje! 💪 Vamos lá?`,
    weeklySummary: (n, days, xp, streak) => `📊 Resumo da semana de ${n}: completou o desafio em ${days} dia(s), ganhou ${xp} XP e está com uma sequência de ${streak} dia(s). 🔥`,
    tabuadaReminderChild: (n) => `${n}, ainda não fizeste a Tabuada Semanal Premiada de hoje! ⏳ Se não completares os 5 blocos hoje, perdes a sequência da semana e a mesada fica para a próxima. Vamos lá? 🏅`,
    tabuadaMedalParent: (n) => `🏅 Boas notícias! ${n} completou 7 dias seguidos da Tabuada Semanal Premiada e ganhou a medalha desta semana — já pode receber a mesada! 🎉`,
    tabuadaWeeklySummaryParent: (n, days, earned, total) => days >= 7
      ? `📊 Resumo da semana de ${n}: completou os 7 dias da Tabuada Semanal Premiada! 🏅 Mesada desta semana: ${earned} (de ${total}).`
      : `📊 Resumo da semana de ${n}: completou ${days}/7 dias da Tabuada Semanal Premiada. Mesada desta semana: ${earned} (de ${total}). Para a semana há mais 7 dias para tentar de novo! 💪`,
    tabuadaWeeklySummaryChild: (n, days, earned) => days >= 7
      ? `🎉 Parabéns ${n}! Fizeste os 7 dias da Tabuada Semanal Premiada esta semana e ganhaste ${earned}! 🏅`
      : `📊 ${n}, esta semana fizeste ${days}/7 dias da Tabuada Semanal Premiada e ganhaste ${earned}. Para a semana começa tudo outra vez — vamos tentar os 7 dias? 💪`,
    tabuadaDayCompletedParent: (n) => `✅ ${n} concluiu hoje a Tabuada Semanal Premiada — os 5 blocos + o desafio diário. Mais um dia garantido para a medalha da semana! 🏅`,
  },
  en: {
    dailyReminderParent: (n) => `Hi! 👋 Just a reminder: ${n} hasn't done today's math challenge on Math Hero Kids yet.`,
    unfinishedWarningParent: (n) => `${n} still hasn't done today's challenge. ⏰ Might be worth a nudge before the day ends!`,
    completedNoticeParent: (n) => `Good news! 🎉 ${n} already completed today's math challenge.`,
    dailyReminderChild: (n) => `Hi ${n}! 🚀 Don't forget to do your math challenge today on Math Hero Kids!`,
    unfinishedWarningChild: (n) => `${n}, there's still time for today's challenge! 💪 Let's go?`,
    weeklySummary: (n, days, xp, streak) => `📊 ${n}'s week: completed the challenge on ${days} day(s), earned ${xp} XP, and is on a ${streak}-day streak. 🔥`,
    tabuadaReminderChild: (n) => `${n}, you haven't done today's Weekly Times-Table Challenge yet! ⏳ If you don't finish all 5 blocks today, you'll lose this week's streak and miss out on your allowance. Let's go? 🏅`,
    tabuadaMedalParent: (n) => `🏅 Great news! ${n} completed 7 days in a row of the Weekly Times-Table Challenge and earned this week's medal — time to pay the allowance! 🎉`,
    tabuadaWeeklySummaryParent: (n, days, earned, total) => days >= 7
      ? `📊 ${n}'s week: completed all 7 days of the Weekly Rewarded Times-Table! 🏅 This week's allowance: ${earned} (of ${total}).`
      : `📊 ${n}'s week: completed ${days}/7 days of the Weekly Rewarded Times-Table. This week's allowance: ${earned} (of ${total}). New week, new chance at all 7! 💪`,
    tabuadaWeeklySummaryChild: (n, days, earned) => days >= 7
      ? `🎉 Congrats ${n}! You did all 7 days of the Weekly Rewarded Times-Table this week and earned ${earned}! 🏅`
      : `📊 ${n}, this week you did ${days}/7 days of the Weekly Rewarded Times-Table and earned ${earned}. Fresh start next week — let's go for all 7? 💪`,
    tabuadaDayCompletedParent: (n) => `✅ ${n} finished today's Weekly Rewarded Times-Table — all 5 blocks plus the daily challenge. One more day locked in for this week's medal! 🏅`,
  },
  es: {
    dailyReminderParent: (n) => `¡Hola! 👋 Solo un recordatorio: ${n} todavía no ha hecho el reto de matemáticas de hoy en Math Hero Kids.`,
    unfinishedWarningParent: (n) => `${n} sigue sin hacer el reto de hoy. ⏰ ¡Vale la pena darle un empujoncito antes de que acabe el día!`,
    completedNoticeParent: (n) => `¡Buenas noticias! 🎉 ${n} ya completó el reto de matemáticas de hoy.`,
    dailyReminderChild: (n) => `¡Hola ${n}! 🚀 ¡No olvides hacer tu reto de matemáticas de hoy en Math Hero Kids!`,
    unfinishedWarningChild: (n) => `${n}, ¡todavía hay tiempo para el reto de hoy! 💪 ¿Vamos?`,
    weeklySummary: (n, days, xp, streak) => `📊 Semana de ${n}: completó el reto en ${days} día(s), ganó ${xp} XP y lleva una racha de ${streak} día(s). 🔥`,
    tabuadaReminderChild: (n) => `${n}, ¡todavía no has hecho la Tabla Semanal Premiada de hoy! ⏳ Si no completas los 5 bloques hoy, pierdes la racha de la semana y te quedas sin la paga. ¿Vamos? 🏅`,
    tabuadaMedalParent: (n) => `🏅 ¡Buenas noticias! ${n} completó 7 días seguidos de la Tabla Semanal Premiada y ganó la medalla de esta semana — ¡ya puedes darle la paga! 🎉`,
    tabuadaWeeklySummaryParent: (n, days, earned, total) => days >= 7
      ? `📊 Semana de ${n}: ¡completó los 7 días de la Tabla Semanal Premiada! 🏅 Paga de esta semana: ${earned} (de ${total}).`
      : `📊 Semana de ${n}: completó ${days}/7 días de la Tabla Semanal Premiada. Paga de esta semana: ${earned} (de ${total}). ¡Nueva semana, nueva oportunidad de completar los 7! 💪`,
    tabuadaWeeklySummaryChild: (n, days, earned) => days >= 7
      ? `🎉 ¡Felicidades ${n}! Hiciste los 7 días de la Tabla Semanal Premiada esta semana y ganaste ${earned}! 🏅`
      : `📊 ${n}, esta semana hiciste ${days}/7 días de la Tabla Semanal Premiada y ganaste ${earned}. Nueva semana, ¿vamos por los 7 días? 💪`,
    tabuadaDayCompletedParent: (n) => `✅ ${n} completó hoy la Tabla Semanal Premiada — los 5 bloques y el reto diario. ¡Un día más asegurado para la medalla de la semana! 🏅`,
  },
  fr: {
    dailyReminderParent: (n) => `Salut ! 👋 Juste un rappel : ${n} n'a pas encore fait le défi de maths d'aujourd'hui sur Math Hero Kids.`,
    unfinishedWarningParent: (n) => `${n} n'a toujours pas fait le défi du jour. ⏰ Ça vaut peut-être le coup de lui donner un petit coup de pouce avant la fin de la journée !`,
    completedNoticeParent: (n) => `Bonne nouvelle ! 🎉 ${n} a déjà terminé le défi de maths d'aujourd'hui.`,
    dailyReminderChild: (n) => `Salut ${n} ! 🚀 N'oublie pas de faire ton défi de maths d'aujourd'hui sur Math Hero Kids !`,
    unfinishedWarningChild: (n) => `${n}, il est encore temps pour le défi d'aujourd'hui ! 💪 On y va ?`,
    weeklySummary: (n, days, xp, streak) => `📊 Semaine de ${n} : défi complété ${days} jour(s), ${xp} XP gagnés, série de ${streak} jour(s). 🔥`,
    tabuadaReminderChild: (n) => `${n}, tu n'as pas encore fait le Défi Hebdo des Tables aujourd'hui ! ⏳ Si tu ne termines pas les 5 blocs aujourd'hui, tu perds la série de la semaine et l'argent de poche qui va avec. On y va ? 🏅`,
    tabuadaMedalParent: (n) => `🏅 Bonne nouvelle ! ${n} a complété 7 jours d'affilée du Défi Hebdo des Tables et a gagné la médaille de la semaine — c'est le moment de verser l'argent de poche ! 🎉`,
    tabuadaWeeklySummaryParent: (n, days, earned, total) => days >= 7
      ? `📊 Semaine de ${n} : les 7 jours du Défi Hebdo des Tables complétés ! 🏅 Argent de poche de cette semaine : ${earned} (sur ${total}).`
      : `📊 Semaine de ${n} : ${days}/7 jours du Défi Hebdo des Tables complétés. Argent de poche de cette semaine : ${earned} (sur ${total}). Nouvelle semaine, nouvelle chance de faire les 7 ! 💪`,
    tabuadaWeeklySummaryChild: (n, days, earned) => days >= 7
      ? `🎉 Bravo ${n} ! Tu as fait les 7 jours du Défi Hebdo des Tables cette semaine et gagné ${earned} ! 🏅`
      : `📊 ${n}, cette semaine tu as fait ${days}/7 jours du Défi Hebdo des Tables et gagné ${earned}. Nouvelle semaine, on tente les 7 jours ? 💪`,
    tabuadaDayCompletedParent: (n) => `✅ ${n} a terminé aujourd'hui le Défi Hebdo des Tables — les 5 blocs plus le défi quotidien. Un jour de plus assuré pour la médaille de la semaine ! 🏅`,
  },
};

function tpl(lang: string | null | undefined): typeof TEMPLATES['pt'] {
  return TEMPLATES[(lang as Lang) ?? 'pt'] ?? TEMPLATES.pt;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const summary = { parentSent: 0, childSent: 0, skipped: 0, errors: 0 };

  try {
    const config = await getEvolutionConfig(supabaseAdmin);
    if (!config) {
      return new Response(JSON.stringify({ ok: false, error: 'EVOLUTION_NOT_CONFIGURED' }), { status: 503, headers: corsHeaders });
    }

    const { isoDate, hour, weekday } = getLocalNow(TIMEZONE);

    // ── Notificações do pai ─────────────────────────────────────────────
    const { data: parentPrefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('*, parent_profiles!inner(id, name, language, whatsapp_phone, whatsapp_phone_ddi)')
      .eq('whatsapp_enabled', true);

    for (const pref of parentPrefs ?? []) {
      const parent = (pref as any).parent_profiles;
      if (!parent?.whatsapp_phone) continue;
      const number = buildWhatsAppNumber(parent.whatsapp_phone, parent.whatsapp_phone_ddi);
      const t = tpl(parent.language);

      const { data: children } = await supabaseAdmin
        .from('child_profiles')
        .select('id, display_name, tabuada_weekly_reward')
        .eq('parent_id', parent.id)
        .eq('is_active', true);

      for (const child of children ?? []) {
        const { data: dayRow } = await supabaseAdmin
          .from('calendar_days')
          .select('state')
          .eq('child_id', child.id)
          .eq('day_date', isoDate)
          .maybeSingle();
        const completedToday = dayRow?.state === 'completed';

        const checks: Array<{ enabled: boolean; time: string; type: string; shouldSend: boolean; text: string }> = [
          {
            enabled: (pref as any).daily_reminder,
            time: (pref as any).reminder_time,
            type: 'daily_reminder',
            shouldSend: !completedToday,
            text: t.dailyReminderParent(child.display_name),
          },
          {
            enabled: (pref as any).unfinished_warning_enabled,
            time: (pref as any).unfinished_warning_time,
            type: 'unfinished_warning',
            shouldSend: !completedToday,
            text: t.unfinishedWarningParent(child.display_name),
          },
          {
            enabled: (pref as any).completed_notice_enabled,
            time: (pref as any).completed_notice_time,
            type: 'completed_notice',
            shouldSend: completedToday,
            text: t.completedNoticeParent(child.display_name),
          },
        ];

        for (const check of checks) {
          if (!check.enabled || !timeMatchesHour(check.time, hour) || !check.shouldSend) continue;
          await trySend(supabaseAdmin, config, {
            parentId: parent.id, childId: child.id, target: 'parent',
            notificationType: check.type, number, text: check.text, sendDate: isoDate,
          }, summary);
        }

        // Tabuada Semanal Premiada — aviso ÚNICO ao pai quando a medalha é ganha (sem
        // horário fixo, dispara em qualquer tick assim que houver uma semana por notificar).
        if ((pref as any).tabuada_medal_notice_enabled) {
          const { data: pendingWeek } = await supabaseAdmin
            .from('weekly_tabuada_weeks')
            .select('id')
            .eq('child_id', child.id)
            .not('medal_earned_at', 'is', null)
            .is('medal_notified_at', null)
            .maybeSingle();

          if (pendingWeek) {
            // Reivindicação atómica — se dois ticks corressem em paralelo, só um consegue
            // este update (o segundo apanha 0 linhas e `claimed` fica null).
            const { data: claimed } = await supabaseAdmin
              .from('weekly_tabuada_weeks')
              .update({ medal_notified_at: new Date().toISOString() })
              .eq('id', (pendingWeek as any).id)
              .is('medal_notified_at', null)
              .select('id')
              .maybeSingle();

            if (claimed) {
              await trySend(supabaseAdmin, config, {
                parentId: parent.id, childId: child.id, target: 'parent',
                notificationType: 'tabuada_medal_parent', number,
                text: t.tabuadaMedalParent(child.display_name), sendDate: isoDate,
              }, summary);
            }
          }
        }

        // Tabuada Semanal Premiada — aviso ao pai sempre que o dia de hoje fica completo (5
        // blocos + desafio diário, ver tryCompleteDay). Sem horário fixo — dedup natural via
        // whatsapp_notification_log garante 1 envio por dia mesmo em vários ticks do cron.
        if ((pref as any).tabuada_day_completed_enabled) {
          const { data: tabuadaDayRow } = await supabaseAdmin
            .from('weekly_tabuada_days')
            .select('completed_at')
            .eq('child_id', child.id)
            .eq('day_date', isoDate)
            .maybeSingle();

          if ((tabuadaDayRow as any)?.completed_at) {
            await trySend(supabaseAdmin, config, {
              parentId: parent.id, childId: child.id, target: 'parent',
              notificationType: 'tabuada_day_completed', number,
              text: t.tabuadaDayCompletedParent(child.display_name), sendDate: isoDate,
            }, summary);
          }
        }

        // Tabuada Semanal Premiada — resumo de domingo à noite (horário fixo, sem picker).
        if ((pref as any).tabuada_weekly_summary_enabled
          && weekday === TABUADA_WEEKLY_SUMMARY_WEEKDAY
          && hour === TABUADA_WEEKLY_SUMMARY_HOUR) {
          const { data: weekRow } = await supabaseAdmin
            .from('weekly_tabuada_weeks')
            .select('days_completed')
            .eq('child_id', child.id)
            .eq('week_start_date', mondayOfWeek(isoDate))
            .maybeSingle();
          const daysCompleted = (weekRow as any)?.days_completed ?? 0;
          const reward = Number((child as any).tabuada_weekly_reward ?? 0);
          const earnedCents = weeklySummaryEarnedCents(reward, daysCompleted);

          await trySend(supabaseAdmin, config, {
            parentId: parent.id, childId: child.id, target: 'parent',
            notificationType: 'tabuada_weekly_summary', number,
            text: t.tabuadaWeeklySummaryParent(child.display_name, daysCompleted, centsToEuroLabel(earnedCents), centsToEuroLabel(Math.round(reward * 100))),
            sendDate: isoDate,
          }, summary);
        }
      }

      // weekly_summary — agregação, um envio por criança, no dia/hora configurados
      if ((pref as any).weekly_summary_enabled
        && (pref as any).weekly_summary_weekday === weekday
        && timeMatchesHour((pref as any).weekly_summary_time, hour)) {
        for (const child of children ?? []) {
          const weekAgo = new Date(isoDate);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekAgoIso = weekAgo.toISOString().slice(0, 10);

          const { data: weekDays } = await supabaseAdmin
            .from('calendar_days')
            .select('state')
            .eq('child_id', child.id)
            .gte('day_date', weekAgoIso)
            .lt('day_date', isoDate);
          const completedDays = (weekDays ?? []).filter((d: any) => d.state === 'completed').length;

          const { data: childRow } = await supabaseAdmin
            .from('child_profiles')
            .select('xp_total, current_streak')
            .eq('id', child.id)
            .maybeSingle();

          const text = t.weeklySummary(child.display_name, completedDays, childRow?.xp_total ?? 0, childRow?.current_streak ?? 0);
          await trySend(supabaseAdmin, config, {
            parentId: parent.id, childId: child.id, target: 'parent',
            notificationType: 'weekly_summary', number, text, sendDate: isoDate,
          }, summary);
        }
      }
    }

    // ── Notificações da criança ─────────────────────────────────────────
    const { data: childPrefs } = await supabaseAdmin
      .from('child_notification_settings')
      .select('*, child_profiles!inner(id, parent_id, display_name, whatsapp_phone, whatsapp_phone_ddi, is_active, tabuada_weekly_reward, parent_profiles(language))')
      .eq('whatsapp_enabled', true);

    for (const pref of childPrefs ?? []) {
      const child = (pref as any).child_profiles;
      if (!child?.whatsapp_phone || !child.is_active) continue;
      const number = buildWhatsAppNumber(child.whatsapp_phone, child.whatsapp_phone_ddi);
      const t = tpl(child.parent_profiles?.language);

      const { data: dayRow } = await supabaseAdmin
        .from('calendar_days')
        .select('state')
        .eq('child_id', child.id)
        .eq('day_date', isoDate)
        .maybeSingle();
      const completedToday = dayRow?.state === 'completed';

      const checks = [
        { enabled: (pref as any).daily_reminder_enabled, time: (pref as any).daily_reminder_time, type: 'daily_reminder', text: t.dailyReminderChild(child.display_name) },
        { enabled: (pref as any).unfinished_warning_enabled, time: (pref as any).unfinished_warning_time, type: 'unfinished_warning', text: t.unfinishedWarningChild(child.display_name) },
      ];

      for (const check of checks) {
        if (!check.enabled || !timeMatchesHour(check.time, hour) || completedToday) continue;
        await trySend(supabaseAdmin, config, {
          parentId: child.parent_id, childId: child.id, target: 'child',
          notificationType: check.type, number, text: check.text, sendDate: isoDate,
        }, summary);
      }

      // Tabuada Semanal Premiada — até 4 horários configuráveis (tabuada_reminder_hours),
      // cada um mapeado para um notification_type distinto (tabuada_reminder_1..4) para não
      // colidir com o dedup diário de whatsapp_notification_log (1 envio/tipo/dia).
      const tabuadaHours: number[] = (pref as any).tabuada_reminder_hours ?? [];
      if ((pref as any).tabuada_reminder_enabled && tabuadaHours.length) {
        const { data: tabuadaDay } = await supabaseAdmin
          .from('weekly_tabuada_days')
          .select('completed_at')
          .eq('child_id', child.id)
          .eq('day_date', isoDate)
          .maybeSingle();
        const tabuadaCompletedToday = !!(tabuadaDay as any)?.completed_at;

        if (!tabuadaCompletedToday) {
          for (let idx = 0; idx < Math.min(tabuadaHours.length, 4); idx++) {
            if (tabuadaHours[idx] !== hour) continue;
            await trySend(supabaseAdmin, config, {
              parentId: child.parent_id, childId: child.id, target: 'child',
              notificationType: `tabuada_reminder_${idx + 1}`, number,
              text: t.tabuadaReminderChild(child.display_name), sendDate: isoDate,
            }, summary);
          }
        }
      }

      // Tabuada Semanal Premiada — mesmo resumo de domingo à noite, mas para a própria criança.
      if ((pref as any).tabuada_weekly_summary_enabled
        && weekday === TABUADA_WEEKLY_SUMMARY_WEEKDAY
        && hour === TABUADA_WEEKLY_SUMMARY_HOUR) {
        const { data: weekRow } = await supabaseAdmin
          .from('weekly_tabuada_weeks')
          .select('days_completed')
          .eq('child_id', child.id)
          .eq('week_start_date', mondayOfWeek(isoDate))
          .maybeSingle();
        const daysCompleted = (weekRow as any)?.days_completed ?? 0;
        const reward = Number(child.tabuada_weekly_reward ?? 0);
        const earnedCents = weeklySummaryEarnedCents(reward, daysCompleted);

        await trySend(supabaseAdmin, config, {
          parentId: child.parent_id, childId: child.id, target: 'child',
          notificationType: 'tabuada_weekly_summary', number,
          text: t.tabuadaWeeklySummaryChild(child.display_name, daysCompleted, centsToEuroLabel(earnedCents)),
          sendDate: isoDate,
        }, summary);
      }
    }

    // Camada 3 do sistema de ops alerts (ver _shared/opsAlert.ts): mede o RESULTADO REAL
    // dos envios deste tick, não o que a Evolution API diz sobre si mesma — apanha o "zombie
    // state" (connectionState/webhook dizem 'open', mas /message/sendText falha sempre com
    // "Connection Closed") que as camadas 1 (railway-health-check) e 2 (evolution-webhook)
    // não veem, porque nenhuma delas depende do resultado de um envio real.
    await checkSendFailureHealth(supabaseAdmin, summary);

    return new Response(JSON.stringify({ ok: true, ...summary }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('send-whatsapp-notifications error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message, ...summary }), { status: 500, headers: corsHeaders });
  }
});

function nowUtcLabel(): string {
  return `${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/**
 * Camada 3 — ver comentário no ponto de chamada. "unhealthy" = este tick teve pelo menos
 * uma tentativa de envio real E todas falharam; só alerta na transição saudável→doente (e
 * o inverso na recuperação), nunca a cada tick, via whatsapp_send_health_state.
 */
// deno-lint-ignore no-explicit-any
async function checkSendFailureHealth(supabaseAdmin: any, summary: { parentSent: number; childSent: number; skipped: number; errors: number }) {
  const attempted = summary.parentSent + summary.childSent + summary.errors;
  if (attempted === 0) return; // nada foi realmente tentado neste tick — sem sinal

  const allFailed = summary.parentSent + summary.childSent === 0;

  const { data: stateRow } = await supabaseAdmin
    .from('whatsapp_send_health_state')
    .select('is_healthy')
    .eq('id', true)
    .maybeSingle();
  const wasHealthy = stateRow?.is_healthy ?? true;
  const isHealthy = !allFailed;
  if (wasHealthy === isHealthy) return;

  const settings = await getOpsAlertSettings(supabaseAdmin);
  if (settings?.send_failure_alert_enabled) {
    const from = settings.from_email ? { email: settings.from_email, name: settings.from_name } : undefined;
    if (!isHealthy) {
      await sendOpsAlert(
        supabaseAdmin,
        settings.email,
        '🔴 MathHeroKids: envios de WhatsApp a falhar de verdade',
        `Todas as ${summary.errors} tentativas de envio deste tick (${nowUtcLabel()}) falharam, mesmo a ` +
        `Evolution API reportando a instância como ligada. Isto é o "zombie state" conhecido de sessões ` +
        `Baileys auto-hospedadas: o estado em cache não reflete a sessão real do WhatsApp.\n\n` +
        `Reconecte escaneando o QR code em Developer → Integração WhatsApp no app — pode ser preciso ` +
        `"Reset" primeiro, já que o ecrã de status também confia nesse mesmo estado em cache e pode não ` +
        `oferecer um QR novo sozinho.`,
        from,
      );
    } else {
      await sendOpsAlert(
        supabaseAdmin,
        settings.email,
        '✅ MathHeroKids: envios de WhatsApp voltaram a funcionar',
        `Pelo menos um envio deste tick (${nowUtcLabel()}) foi bem sucedido depois de um período a falhar.`,
        from,
      );
    }
  }

  await supabaseAdmin
    .from('whatsapp_send_health_state')
    .update({ is_healthy: isHealthy, last_checked_at: new Date().toISOString() })
    .eq('id', true);
}

async function trySend(
  supabaseAdmin: any,
  config: any,
  args: { parentId: string; childId: string; target: 'parent' | 'child'; notificationType: string; number: string; text: string; sendDate: string },
  summary: { parentSent: number; childSent: number; skipped: number; errors: number },
) {
  // Reserva a linha de dedup ANTES de enviar — se já existir (23505), outro run já tratou disto.
  const { error: insertError } = await supabaseAdmin.from('whatsapp_notification_log').insert({
    parent_id: args.parentId,
    child_id: args.childId,
    target: args.target,
    notification_type: args.notificationType,
    recipient_phone: args.number,
    send_date: args.sendDate,
    status: 'sent',
  });
  if (insertError) {
    if (insertError.code === '23505') summary.skipped++;
    else summary.errors++;
    return;
  }

  try {
    const result = await sendWhatsAppText(config, args.number, args.text);
    if (!result.ok) {
      await supabaseAdmin.from('whatsapp_notification_log')
        .update({ status: 'failed', error_detail: JSON.stringify(result.raw).slice(0, 500) })
        .match({ parent_id: args.parentId, child_id: args.childId, target: args.target, notification_type: args.notificationType, send_date: args.sendDate });
      summary.errors++;
      return;
    }
    await supabaseAdmin.from('whatsapp_notification_log')
      .update({ evolution_message_id: result.messageId ?? null })
      .match({ parent_id: args.parentId, child_id: args.childId, target: args.target, notification_type: args.notificationType, send_date: args.sendDate });
    if (args.target === 'parent') summary.parentSent++; else summary.childSent++;
  } catch (err) {
    await supabaseAdmin.from('whatsapp_notification_log')
      .update({ status: 'failed', error_detail: (err as Error).message.slice(0, 500) })
      .match({ parent_id: args.parentId, child_id: args.childId, target: args.target, notification_type: args.notificationType, send_date: args.sendDate });
    summary.errors++;
  }
}
