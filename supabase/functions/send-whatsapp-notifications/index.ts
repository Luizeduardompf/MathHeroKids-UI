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
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getEvolutionConfig, buildWhatsAppNumber, sendWhatsAppText, getLocalNow, timeMatchesHour } from '../_shared/whatsapp.ts';

const TIMEZONE = Deno.env.get('NOTIFICATIONS_TIMEZONE') ?? 'Europe/Lisbon';

type Lang = 'pt' | 'en' | 'es' | 'fr';

const TEMPLATES: Record<Lang, {
  dailyReminderParent: (name: string) => string;
  unfinishedWarningParent: (name: string) => string;
  completedNoticeParent: (name: string) => string;
  dailyReminderChild: (name: string) => string;
  unfinishedWarningChild: (name: string) => string;
  weeklySummary: (name: string, days: number, xp: number, streak: number) => string;
}> = {
  pt: {
    dailyReminderParent: (n) => `Olá! 👋 Só um lembrete: ${n} ainda não fez o desafio de matemática de hoje no Math Hero Kids.`,
    unfinishedWarningParent: (n) => `${n} continua sem fazer o desafio de hoje. ⏰ Vale a pena dar um empurrãozinho antes que o dia acabe!`,
    completedNoticeParent: (n) => `Boas notícias! 🎉 ${n} já completou o desafio de matemática de hoje.`,
    dailyReminderChild: (n) => `Olá ${n}! 🚀 Não te esqueças de fazer o teu desafio de matemática de hoje no Math Hero Kids!`,
    unfinishedWarningChild: (n) => `${n}, ainda dá tempo de fazer o teu desafio de hoje! 💪 Vamos lá?`,
    weeklySummary: (n, days, xp, streak) => `📊 Resumo da semana de ${n}: completou o desafio em ${days} dia(s), ganhou ${xp} XP e está com uma sequência de ${streak} dia(s). 🔥`,
  },
  en: {
    dailyReminderParent: (n) => `Hi! 👋 Just a reminder: ${n} hasn't done today's math challenge on Math Hero Kids yet.`,
    unfinishedWarningParent: (n) => `${n} still hasn't done today's challenge. ⏰ Might be worth a nudge before the day ends!`,
    completedNoticeParent: (n) => `Good news! 🎉 ${n} already completed today's math challenge.`,
    dailyReminderChild: (n) => `Hi ${n}! 🚀 Don't forget to do your math challenge today on Math Hero Kids!`,
    unfinishedWarningChild: (n) => `${n}, there's still time for today's challenge! 💪 Let's go?`,
    weeklySummary: (n, days, xp, streak) => `📊 ${n}'s week: completed the challenge on ${days} day(s), earned ${xp} XP, and is on a ${streak}-day streak. 🔥`,
  },
  es: {
    dailyReminderParent: (n) => `¡Hola! 👋 Solo un recordatorio: ${n} todavía no ha hecho el reto de matemáticas de hoy en Math Hero Kids.`,
    unfinishedWarningParent: (n) => `${n} sigue sin hacer el reto de hoy. ⏰ ¡Vale la pena darle un empujoncito antes de que acabe el día!`,
    completedNoticeParent: (n) => `¡Buenas noticias! 🎉 ${n} ya completó el reto de matemáticas de hoy.`,
    dailyReminderChild: (n) => `¡Hola ${n}! 🚀 ¡No olvides hacer tu reto de matemáticas de hoy en Math Hero Kids!`,
    unfinishedWarningChild: (n) => `${n}, ¡todavía hay tiempo para el reto de hoy! 💪 ¿Vamos?`,
    weeklySummary: (n, days, xp, streak) => `📊 Semana de ${n}: completó el reto en ${days} día(s), ganó ${xp} XP y lleva una racha de ${streak} día(s). 🔥`,
  },
  fr: {
    dailyReminderParent: (n) => `Salut ! 👋 Juste un rappel : ${n} n'a pas encore fait le défi de maths d'aujourd'hui sur Math Hero Kids.`,
    unfinishedWarningParent: (n) => `${n} n'a toujours pas fait le défi du jour. ⏰ Ça vaut peut-être le coup de lui donner un petit coup de pouce avant la fin de la journée !`,
    completedNoticeParent: (n) => `Bonne nouvelle ! 🎉 ${n} a déjà terminé le défi de maths d'aujourd'hui.`,
    dailyReminderChild: (n) => `Salut ${n} ! 🚀 N'oublie pas de faire ton défi de maths d'aujourd'hui sur Math Hero Kids !`,
    unfinishedWarningChild: (n) => `${n}, il est encore temps pour le défi d'aujourd'hui ! 💪 On y va ?`,
    weeklySummary: (n, days, xp, streak) => `📊 Semaine de ${n} : défi complété ${days} jour(s), ${xp} XP gagnés, série de ${streak} jour(s). 🔥`,
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
        .select('id, display_name')
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
      .select('*, child_profiles!inner(id, parent_id, display_name, whatsapp_phone, whatsapp_phone_ddi, is_active, parent_profiles(language))')
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
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('send-whatsapp-notifications error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message, ...summary }), { status: 500, headers: corsHeaders });
  }
});

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
