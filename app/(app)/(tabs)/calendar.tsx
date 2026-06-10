/**
 * Calendar screen — pixel-faithful ao design 03-home-dashboard-calendar.zip
 *
 * Layout:
 * - Header fixo (fora do ScrollView): avatar, nome, level, XP bar
 * - Conteúdo scrollável:
 *   - MiloMessage contextual ao streak
 *   - Stats row: Sequência + Recorde (layout horizontal, igual ao design)
 *   - Mês actual + 3 meses anteriores em lista vertical
 *   - Legenda
 *
 * Dados:
 * - calendar_days via Supabase (escrita pela Edge Function complete_challenge)
 * - Fallback: challenge_sessions para quando a EF não está deployada
 */

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, ProgressBar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { LEVEL_THRESHOLDS } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { challengeService, type LocalCompletion } from '@/services/challenge.service';
import { colors, fontFamily, radius, shadows } from '@/theme';
import type { CalendarDay } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_TO_SHOW = 4; // current + 3 previous
const DAY_SIZE       = 40;
const DOW_LABELS     = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── XP helpers ───────────────────────────────────────────────────────────────

function getXpFloor(level: number): number {
  return LEVEL_THRESHOLDS.find((t) => t.level === level)?.xpRequired ?? 0;
}
function getXpCeil(level: number): number {
  return (
    LEVEL_THRESHOLDS.find((t) => t.level === level + 1)?.xpRequired ??
    LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]?.xpRequired ??
    99999
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function monthsToShow(): Array<{ year: number; month: number }> {
  const now = new Date();
  return Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

// ─── Supabase query ───────────────────────────────────────────────────────────

interface SessionFallback {
  challenge_date: string;
  status: string;
  correct_count: number;
  total_questions: number;
  is_perfect: boolean;
}

interface CalendarData {
  calDays:    CalendarDay[];
  sessions:   SessionFallback[];
  localComps: LocalCompletion[];
}

async function fetchCalendarData(childId: string): Promise<CalendarData> {
  const now      = new Date();
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_TO_SHOW - 1), 1);

  const [calResult, sessResult, localComps] = await Promise.all([
    supabase
      .from('calendar_days')
      .select('*')
      .eq('child_id', childId)
      .gte('day_date', toISO(rangeStart))
      .lte('day_date', toISO(rangeEnd)),
    supabase
      .from('challenge_sessions')
      .select('challenge_date, status, correct_count, total_questions, is_perfect')
      .eq('child_id', childId)
      .eq('status', 'completed')
      .gte('challenge_date', toISO(rangeStart))
      .lte('challenge_date', toISO(rangeEnd)),
    challengeService.getLocalCompletions(childId, toISO(rangeStart), toISO(rangeEnd)),
  ]);

  return {
    calDays:    (calResult.data ?? []) as CalendarDay[],
    sessions:   (sessResult.data ?? []) as SessionFallback[],
    localComps,
  };
}

// ─── Day grid builder ─────────────────────────────────────────────────────────

type DayVariant = 'perfect' | 'completed' | 'failed' | 'today' | 'future' | 'missed';

interface DayInfo {
  day:      number;
  dateStr:  string;
  variant:  DayVariant;
}

function buildDayGrid(
  year:       number,
  month:      number,
  calDays:    CalendarDay[],
  sessions:   SessionFallback[],
  localComps: LocalCompletion[],
  today:      string,
): Array<DayInfo | null> {
  const byDate      = new Map<string, CalendarDay>(calDays.map((d) => [d.day_date, d]));
  const sessByDate  = new Map<string, SessionFallback>(sessions.map((s) => [s.challenge_date, s]));
  const localByDate = new Map<string, LocalCompletion>(localComps.map((c) => [c.challengeDate, c]));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow    = new Date(year, month, 1).getDay(); // 0 = Sun

  const cells: Array<DayInfo | null> = Array(startDow).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const calDay   = byDate.get(dateStr);
    const session  = sessByDate.get(dateStr);
    const localComp = localByDate.get(dateStr);

    let variant: DayVariant;

    // Priority: calendar_days (EF) > challenge_sessions (EF) > AsyncStorage local > today > future > missed
    if (calDay) {
      if (calDay.state === 'completed' && calDay.is_perfect) variant = 'perfect';
      else if (calDay.state === 'completed') variant = 'completed';
      else variant = 'failed';
    } else if (session) {
      variant = session.is_perfect ? 'perfect' : 'completed';
    } else if (localComp) {
      // Fallback local: EF não deployada — dados guardados no AsyncStorage ao completar
      variant = localComp.isPerfect ? 'perfect' : 'completed';
    } else if (dateStr === today) {
      variant = 'today';
    } else if (dateStr > today) {
      variant = 'future';
    } else {
      variant = 'missed';
    }

    cells.push({ day: d, dateStr, variant });
  }

  // Pad last row to complete 7-column grid
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

const DAY_THEME: Record<DayVariant, {
  bg: string; iconName: string; iconColor: string; textColor: string;
}> = {
  perfect:   { bg: '#F59E0B', iconName: 'star',        iconColor: '#fff',     textColor: '#fff'     },
  completed: { bg: '#22C55E', iconName: 'trophy',      iconColor: '#fff',     textColor: '#fff'     },
  failed:    { bg: '#FEE2E2', iconName: 'trophy',      iconColor: '#EF4444',  textColor: '#EF4444'  },
  today:     { bg: '#2B52E5', iconName: 'none',        iconColor: '#fff',     textColor: '#fff'     },
  future:    { bg: '#F3F4F6', iconName: 'lock-closed', iconColor: '#C4C9D8',  textColor: '#C4C9D8'  },
  missed:    { bg: '#F3F4F6', iconName: 'lock-closed', iconColor: '#C4C9D8',  textColor: '#C4C9D8'  },
};

function DayCell({ info }: { info: DayInfo | null }) {
  if (!info) return <View style={dc.cell} />;

  const th = DAY_THEME[info.variant];

  if (info.variant === 'today') {
    return (
      <View style={[dc.cell, { backgroundColor: th.bg }]}>
        <Text style={dc.todayNum}>{info.day}</Text>
        <Text style={dc.todayLbl}>HOJE</Text>
      </View>
    );
  }

  return (
    <View style={[dc.cell, { backgroundColor: th.bg }]}>
      {th.iconName !== 'none' && (
        <Ionicons name={th.iconName as never} size={15} color={th.iconColor} />
      )}
      <Text style={[dc.num, { color: th.textColor }]}>{info.day}</Text>
    </View>
  );
}

const dc = StyleSheet.create({
  cell: {
    width: DAY_SIZE, height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  num: {
    fontFamily: fontFamily.bold,
    fontSize: 12, lineHeight: 14,
  },
  todayNum: {
    fontFamily: fontFamily.extraBold,
    fontSize: 12, lineHeight: 13, color: '#fff',
  },
  todayLbl: {
    fontFamily: fontFamily.extraBold,
    fontSize: 8, lineHeight: 10, color: '#fff', letterSpacing: 0.4,
  },
});

// ─── Month calendar ───────────────────────────────────────────────────────────

function MonthCalendar({
  year, month, calDays, sessions, localComps, today,
}: {
  year: number; month: number;
  calDays: CalendarDay[]; sessions: SessionFallback[];
  localComps: LocalCompletion[]; today: string;
}) {
  const grid = buildDayGrid(year, month, calDays, sessions, localComps, today);

  return (
    <View style={mc.card}>
      <Text style={mc.title}>{MONTH_NAMES_PT[month]} {year}</Text>

      {/* Day-of-week header */}
      <View style={mc.dowRow}>
        {DOW_LABELS.map((lbl, i) => (
          <Text key={i} style={mc.dowLbl}>{lbl}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={mc.grid}>
        {grid.map((info, i) => <DayCell key={i} info={info} />)}
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    padding: 16,
    ...shadows.md,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18, color: colors.text.primary,
    textAlign: 'center', marginBottom: 14,
  },
  dowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  dowLbl: {
    width: DAY_SIZE, textAlign: 'center',
    fontFamily: fontFamily.bold, fontSize: 12, color: colors.text.secondary,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-around', rowGap: 8,
  },
});

// ─── Stats cards ──────────────────────────────────────────────────────────────
// Layout pixel-faithful: ícone em círculo à esquerda, valor + label à direita

function StreakCard({ value }: { value: number }) {
  return (
    <LinearGradient
      colors={['#F5722A', '#D45A18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={sc.card}
    >
      <View style={sc.iconCircleOrange}>
        <Ionicons name="flame" size={22} color="#F5722A" />
      </View>
      <View style={sc.col}>
        <Text style={sc.valueWhite}>{value}</Text>
        <Text style={sc.labelWhite}>Sequência</Text>
      </View>
    </LinearGradient>
  );
}

function RecordCard({ value }: { value: number }) {
  return (
    <View style={[sc.card, sc.cardWhite]}>
      <View style={sc.iconCircleAmber}>
        <Ionicons name="trophy" size={22} color="#F59E0B" />
      </View>
      <View style={sc.col}>
        <Text style={sc.valueAmber}>{value}</Text>
        <Text style={sc.labelGray}>Recorde</Text>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...shadows.md,
  },
  cardWhite: { backgroundColor: '#fff' },
  // Orange semi-transparent circle for streak
  iconCircleOrange: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Amber tinted circle for record
  iconCircleAmber: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  col: { gap: 2 },
  valueWhite: {
    fontFamily: fontFamily.extraBold,
    fontSize: 36, lineHeight: 40, color: '#fff',
  },
  valueAmber: {
    fontFamily: fontFamily.extraBold,
    fontSize: 36, lineHeight: 40, color: '#F59E0B',
  },
  labelWhite: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14, color: 'rgba(255,255,255,0.85)',
  },
  labelGray: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14, color: '#6B7280',
  },
});

// ─── Milo streak message ──────────────────────────────────────────────────────

function streakMessage(streak: number): string {
  if (streak === 0)  return 'Comece hoje e construa sua sequência! Eu acredito em você.';
  if (streak <= 2)   return `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}! Ótimo começo, continue assim!`;
  if (streak <= 6)   return 'Você está pegando o ritmo! Não pare agora.';
  if (streak <= 13)  return 'Sua sequência está incrível! Não perca hoje.';
  if (streak <= 29)  return `${streak} dias! Você é um verdadeiro herói da matemática!`;
  return `INCRÍVEL! ${streak} dias sem parar. Você é uma lenda!`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarioScreen() {
  const child        = useProfileStore(selectActiveChild);
  const insets       = useSafeAreaInsets();
  const queryClient  = useQueryClient();
  const today        = useMemo(() => toISO(new Date()), []);
  const months       = useMemo(() => monthsToShow(), []);

  // Refetch sempre que o ecrã fica em foco — garante que o dia de hoje
  // aparece como completo após o utilizador terminar o desafio
  useFocusEffect(
    useCallback(() => {
      if (child?.id) {
        void queryClient.invalidateQueries({ queryKey: ['calendar_data', child.id] });
      }
    }, [queryClient, child?.id]),
  );

  const { data, isLoading } = useQuery<CalendarData>({
    queryKey: ['calendar_data', child?.id],
    queryFn:  () => fetchCalendarData(child!.id),
    enabled:  !!child?.id,
    staleTime: 30_000,
  });

  if (!child) return null;

  const calDays   = data?.calDays    ?? [];
  const sessions  = data?.sessions   ?? [];
  const localComps = data?.localComps ?? [];

  const xpFloor    = getXpFloor(child.level);
  const xpCeil     = getXpCeil(child.level);
  const xpProgress = xpCeil > xpFloor
    ? (child.xp_total - xpFloor) / (xpCeil - xpFloor)
    : 1;

  return (
    // View root branca — cobre safe area do status bar com a mesma cor do header
    <View style={s.safe}>

      {/* ── Fixed header — inclui o inset do status bar ────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Avatar
          avatarId={child.avatar_id}
          displayName={child.display_name}
          size="md"
        />
        <View style={s.headerMid}>
          <View style={s.headerNameRow}>
            <Text style={s.childName}>{child.display_name}</Text>
          </View>
          <Text style={s.levelLabel}>Nível {child.level}</Text>
          <ProgressBar
            value={xpProgress}
            color={colors.primary}
            trackColor="#E4E5EF"
            height={6}
            style={{ marginTop: 4 }}
          />
          <View style={s.xpRow}>
            <Text style={s.xpCurrent}>{child.xp_total.toLocaleString('pt-BR')} XP</Text>
            <Text style={s.xpNext}>{xpCeil.toLocaleString('pt-BR')}</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Milo message */}
        <MiloMessage
          message={streakMessage(child.current_streak)}
          variant="blue"
        />

        {/* Stats row */}
        <View style={s.statsRow}>
          <StreakCard value={child.current_streak} />
          <RecordCard value={child.best_streak} />
        </View>

        {/* Monthly calendars */}
        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={{ marginTop: 32 }}
          />
        ) : (
          months.map(({ year, month }) => (
            <MonthCalendar
              key={`${year}-${month}`}
              year={year}
              month={month}
              calDays={calDays}
              sessions={sessions}
              localComps={localComps}
              today={today}
            />
          ))
        )}

        {/* Legend */}
        <View style={s.legend}>
          {[
            { bg: '#F59E0B', icon: 'star',        label: 'Perfeito',    iconColor: '#fff'    },
            { bg: '#22C55E', icon: 'trophy',      label: 'Completo',    iconColor: '#fff'    },
            { bg: '#FEE2E2', icon: 'trophy',      label: 'Incompleto',  iconColor: '#EF4444' },
            { bg: '#F3F4F6', icon: 'lock-closed', label: 'Bloqueado',   iconColor: '#C4C9D8' },
          ].map((item) => (
            <View key={item.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as never} size={10} color={item.iconColor} />
              </View>
              <Text style={s.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    // Branco — cobre o safe area do status bar com a mesma cor do header
    // (evita a barra cinza que aparece quando SafeAreaView tem background diferente)
    backgroundColor: '#fff',
  },

  // ── Fixed header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEEF5',
    ...shadows.sm,
  },
  headerMid: { flex: 1 },
  headerNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  childName: {
    fontFamily: fontFamily.extraBold,
    fontSize: 17, color: colors.text.primary,
  },
  levelLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12, color: colors.text.secondary, marginTop: 1,
  },
  xpRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 3,
  },
  xpCurrent: {
    fontFamily: fontFamily.bold, fontSize: 12, color: colors.primary,
  },
  xpNext: {
    fontFamily: fontFamily.semiBold, fontSize: 11, color: colors.text.secondary,
  },

  // ── Scroll content ────────────────────────────────────────────────────────
  scroll: { flex: 1, backgroundColor: colors.background.primary },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 16,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // ── Legend ────────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, justifyContent: 'center',
    paddingVertical: 4,
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  legendDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  legendLabel: {
    fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.text.secondary,
  },
});
