/**
 * Calendar screen — pixel-faithful ao design 03-home-dashboard-calendar.zip
 *
 * Mostra:
 * - Header com avatar, nome, XP/level
 * - Stats: sequência atual + recorde
 * - MiloMessage contextual
 * - Calendário mensal com estados por dia
 * - Navegação entre meses
 *
 * Dados: calendar_days via Supabase + TanStack Query (leitura directa, sem EF)
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
// @ts-expect-error RN 0.85 — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, ProgressBar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { LEVEL_THRESHOLDS } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import type { CalendarDay } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getXpFloor(level: number): number {
  return LEVEL_THRESHOLDS.find((t) => t.level === level)?.xpRequired ?? 0;
}
function getXpCeil(level: number): number {
  return LEVEL_THRESHOLDS.find((t) => t.level === level + 1)?.xpRequired
    ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]?.xpRequired
    ?? 99999;
}

/** ISO date → "YYYY-MM-DD" */
function toISO(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** First day of month (day = 1), last day of month */
function monthBounds(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  return { first: toISO(first), last: toISO(last) };
}

/** Day-of-week of the 1st of the month (0 = Sun, 6 = Sat) */
function startDow(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DOW_LABELS = ['D','S','T','Q','Q','S','S'];

// ─── Supabase query ───────────────────────────────────────────────────────────

async function fetchCalendarDays(childId: string, year: number, month: number): Promise<CalendarDay[]> {
  const { first, last } = monthBounds(year, month);
  const { data, error } = await supabase
    .from('calendar_days')
    .select('*')
    .eq('child_id', childId)
    .gte('day_date', first)
    .lte('day_date', last);

  if (error) throw error;
  return (data ?? []) as CalendarDay[];
}

// ─── Day cell logic ───────────────────────────────────────────────────────────

type DayVariant = 'perfect' | 'completed' | 'failed' | 'today' | 'future' | 'missed' | 'empty';

interface DayInfo {
  day: number;          // 1–31
  dateStr: string;      // YYYY-MM-DD
  variant: DayVariant;
  calDay?: CalendarDay;
}

function buildDayGrid(
  year: number,
  month: number,
  calDays: CalendarDay[],
  today: string,
): Array<DayInfo | null> {
  const byDate = new Map<string, CalendarDay>(calDays.map((d) => [d.day_date, d]));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dow = startDow(year, month);

  const cells: Array<DayInfo | null> = Array(dow).fill(null); // leading nulls

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const calDay  = byDate.get(dateStr);

    let variant: DayVariant;
    if (dateStr === today) {
      variant = 'today';
    } else if (dateStr > today) {
      variant = 'future';
    } else if (!calDay) {
      variant = 'missed';
    } else if (calDay.state === 'completed' && calDay.is_perfect) {
      variant = 'perfect';
    } else if (calDay.state === 'completed') {
      variant = 'completed';
    } else {
      // failed / in_progress / abandoned
      variant = 'failed';
    }

    cells.push({ day: d, dateStr, variant, calDay });
  }

  // Pad to complete last row (multiple of 7)
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Day cell styles ──────────────────────────────────────────────────────────

const DAY_SIZE = 40;

const DAY_CFG: Record<DayVariant, { bg: string; iconColor: string; textColor: string }> = {
  perfect:   { bg: '#F59E0B', iconColor: '#fff',     textColor: '#fff'     },
  completed: { bg: '#22C55E', iconColor: '#fff',     textColor: '#fff'     },
  failed:    { bg: '#FEE2E2', iconColor: '#EF4444',  textColor: '#EF4444'  },
  today:     { bg: '#2B52E5', iconColor: '#fff',     textColor: '#fff'     },
  future:    { bg: '#F3F4F6', iconColor: '#9CA3AF',  textColor: '#9CA3AF'  },
  missed:    { bg: '#F3F4F6', iconColor: '#9CA3AF',  textColor: '#9CA3AF'  },
  empty:     { bg: 'transparent', iconColor: 'transparent', textColor: 'transparent' },
};

function DayIcon({ variant }: { variant: DayVariant }) {
  if (variant === 'today') return null;
  if (variant === 'future' || variant === 'missed') {
    return <Ionicons name="lock-closed" size={16} color={DAY_CFG[variant].iconColor} />;
  }
  if (variant === 'perfect') {
    return <Ionicons name="star" size={16} color={DAY_CFG.perfect.iconColor} />;
  }
  if (variant === 'completed') {
    return <Ionicons name="trophy" size={16} color={DAY_CFG.completed.iconColor} />;
  }
  if (variant === 'failed') {
    return <Ionicons name="trophy" size={16} color={DAY_CFG.failed.iconColor} />;
  }
  return null;
}

function DayCell({ info }: { info: DayInfo | null }) {
  if (!info) {
    return <View style={dc.cell} />;
  }

  const cfg = DAY_CFG[info.variant];

  return (
    <View style={[dc.cell, { backgroundColor: cfg.bg }, info.variant === 'today' && dc.todayRing]}>
      <DayIcon variant={info.variant} />

      {info.variant === 'today' ? (
        <>
          <Text style={[dc.num, { color: '#fff', fontSize: 11, fontFamily: fontFamily.extraBold }]}>
            {info.day}
          </Text>
          <Text style={dc.todayLabel}>HOJE</Text>
        </>
      ) : (
        <Text style={[dc.num, { color: cfg.textColor }]}>{info.day}</Text>
      )}
    </View>
  );
}

const dc = StyleSheet.create({
  cell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  num: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 14,
  },
  todayLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  todayRing: {
    borderWidth: 0,
  },
});

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, gradient,
}: {
  icon: string; label: string; value: number; gradient?: [string, string];
}) {
  const content = (
    <View style={st.inner}>
      <View style={st.iconWrap}>
        <Ionicons name={icon as never} size={22} color={gradient ? '#fff' : '#F59E0B'} />
      </View>
      <Text style={[st.value, gradient ? st.valueLight : st.valueAmber]}>{value}</Text>
      <Text style={[st.label, gradient ? st.labelLight : st.labelDark]}>{label}</Text>
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.card}
      >
        {content}
      </LinearGradient>
    );
  }

  return <View style={[st.card, st.cardWhite]}>{content}</View>;
}

const st = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.md,
  },
  cardWhite: { backgroundColor: '#fff' },
  inner: { gap: 2 },
  iconWrap: { marginBottom: 4 },
  value: {
    fontFamily: fontFamily.extraBold,
    fontSize: 32,
    lineHeight: 36,
  },
  valueAmber:  { color: '#F59E0B' },
  valueLight:  { color: '#fff' },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  labelDark:   { color: '#6B7280' },
  labelLight:  { color: 'rgba(255,255,255,0.85)' },
});

// ─── Milo streak message ──────────────────────────────────────────────────────

function streakMessage(streak: number): string {
  if (streak === 0)  return 'Comece hoje e construa sua sequência! Eu acredito em você.';
  if (streak <= 2)   return `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}! Ótimo começo, continue assim!`;
  if (streak <= 6)   return `${streak} dias seguidos! Você está pegando o ritmo!`;
  if (streak <= 13)  return `Sua sequência está incrível! Não perca hoje.`;
  if (streak <= 29)  return `${streak} dias! Você é um verdadeiro herói da matemática!`;
  return `INCRÍVEL! ${streak} dias sem parar. Você é uma lenda!`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarioScreen() {
  const child = useProfileStore(selectActiveChild);

  const today = useMemo(() => toISO(new Date()), []);
  const todayDate = useMemo(() => new Date(), []);

  const [year, setYear]   = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth()); // 0-indexed

  const { data: calDays = [], isLoading } = useQuery({
    queryKey: ['calendar_days', child?.id, year, month],
    queryFn: () => fetchCalendarDays(child!.id, year, month),
    enabled: !!child?.id,
    staleTime: 60_000,
  });

  if (!child) return null;

  const xpFloor   = getXpFloor(child.level);
  const xpCeil    = getXpCeil(child.level);
  const xpProgress = xpCeil > xpFloor
    ? (child.xp_total - xpFloor) / (xpCeil - xpFloor)
    : 1;

  const grid = buildDayGrid(year, month, calDays, today);

  // Navegação de mês
  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = todayDate;
    // Não avançar além do mês actual
    if (year === now.getFullYear() && month === now.getMonth()) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const isCurrentMonth = year === todayDate.getFullYear() && month === todayDate.getMonth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Avatar
            avatarId={child.avatar_id}
            displayName={child.display_name}
            size="md"
          />
          <View style={styles.headerMid}>
            <Text style={styles.childName}>{child.display_name}</Text>
            <Text style={styles.levelLabel}>Nível {child.level}</Text>
            <ProgressBar
              value={xpProgress}
              color={colors.primary}
              trackColor={colors.background.cardAlt}
              height={6}
              style={{ marginTop: 4 }}
            />
            <View style={styles.xpRow}>
              <Text style={styles.xpCurrent}>{child.xp_total.toLocaleString('pt-BR')} XP</Text>
              <Text style={styles.xpNext}>{xpCeil.toLocaleString('pt-BR')}</Text>
            </View>
          </View>
        </View>

        {/* ── Milo message ────────────────────────────────────────────── */}
        <MiloMessage
          message={streakMessage(child.current_streak)}
          variant="blue"
          style={styles.milo}
        />

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="flame"
            label="Sequência"
            value={child.current_streak}
            gradient={['#F5722A', '#E55B17']}
          />
          <StatCard
            icon="trophy"
            label="Recorde"
            value={child.best_streak}
          />
        </View>

        {/* ── Calendar card ────────────────────────────────────────────── */}
        <View style={styles.calCard}>

          {/* Month nav */}
          <View style={styles.monthRow}>
            <Pressable style={styles.navBtn} onPress={prevMonth} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
            </Pressable>

            <Text style={styles.monthTitle}>
              {MONTH_NAMES_PT[month]} {year}
            </Text>

            <Pressable
              style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
              onPress={nextMonth}
              hitSlop={8}
              disabled={isCurrentMonth}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isCurrentMonth ? '#D1D5DB' : colors.text.primary}
              />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.dowRow}>
            {DOW_LABELS.map((lbl, i) => (
              <Text key={i} style={styles.dowLabel}>{lbl}</Text>
            ))}
          </View>

          {/* Loading state */}
          {isLoading ? (
            <ActivityIndicator
              color={colors.primary}
              size="small"
              style={{ marginVertical: 24 }}
            />
          ) : (
            /* Day grid */
            <View style={styles.grid}>
              {grid.map((info, i) => (
                <DayCell key={i} info={info} />
              ))}
            </View>
          )}
        </View>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <View style={styles.legend}>
          {[
            { color: '#F59E0B', icon: 'star',        label: 'Perfeito' },
            { color: '#22C55E', icon: 'trophy',      label: 'Completo' },
            { color: '#FEE2E2', icon: 'trophy',      label: 'Incompleto', iconColor: '#EF4444' },
            { color: '#F3F4F6', icon: 'lock-closed', label: 'Bloqueado', iconColor: '#9CA3AF' },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]}>
                <Ionicons
                  name={item.icon as never}
                  size={10}
                  color={item.iconColor ?? '#fff'}
                />
              </View>
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: 14,
    ...shadows.sm,
  },
  headerMid: {
    flex: 1,
  },
  childName: {
    fontFamily: fontFamily.extraBold,
    fontSize: 17,
    color: colors.text.primary,
  },
  levelLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  xpCurrent: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.primary,
  },
  xpNext: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: colors.text.secondary,
  },

  // ── Milo ──────────────────────────────────────────────────────────────────
  milo: {},

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // ── Calendar card ──────────────────────────────────────────────────────────
  calCard: {
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    padding: 16,
    ...shadows.md,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  monthTitle: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
    color: colors.text.primary,
  },
  dowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dowLabel: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.text.secondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 8,
  },

  // ── Legend ────────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: colors.text.secondary,
  },
});
