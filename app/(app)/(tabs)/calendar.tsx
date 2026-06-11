/**
 * Calendar screen — pixel-faithful ao design 03-home-dashboard-calendar.zip
 *
 * Layout:
 * - Header fixo: avatar + nome + XP bar
 * - MiloMessage contextual
 * - Stats row: Sequência + Recorde
 * - Mês actual + 3 meses anteriores (lista vertical)
 * - Legenda: Perfeito | Concluído | Perdido | Bloqueado
 * - "Seu progresso": ring mensal + barra semanal + troféu mensal + XP mês
 */

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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

const MONTHS_TO_SHOW = 4;
const DAY_SIZE       = 44;
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

// ─── Supabase + local query ───────────────────────────────────────────────────

interface SessionFallback {
  challenge_date: string;
  status: string;
  is_perfect: boolean;
}

interface CalendarData {
  calDays:    CalendarDay[];
  sessions:   SessionFallback[];
  localComps: LocalCompletion[];
  monthlyXp:  number;
}

async function fetchCalendarData(childId: string): Promise<CalendarData> {
  const now        = new Date();
  const rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_TO_SHOW - 1), 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [calResult, sessResult, xpResult, localComps] = await Promise.all([
    supabase
      .from('calendar_days')
      .select('*')
      .eq('child_id', childId)
      .gte('day_date', toISO(rangeStart))
      .lte('day_date', toISO(rangeEnd)),
    supabase
      .from('challenge_sessions')
      .select('challenge_date, status, is_perfect')
      .eq('child_id', childId)
      .eq('status', 'completed')
      .gte('challenge_date', toISO(rangeStart))
      .lte('challenge_date', toISO(rangeEnd)),
    supabase
      .from('child_xp_ledger')
      .select('amount')
      .eq('child_id', childId)
      .gte('created_at', monthStart.toISOString()),
    challengeService.getLocalCompletions(childId, toISO(rangeStart), toISO(rangeEnd)),
  ]);

  const monthlyXp = ((xpResult.data ?? []) as Array<{ amount: number }>)
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    calDays:    (calResult.data  ?? []) as CalendarDay[],
    sessions:   (sessResult.data ?? []) as SessionFallback[],
    localComps,
    monthlyXp,
  };
}

// ─── Day grid ─────────────────────────────────────────────────────────────────

type DayVariant = 'perfect' | 'completed' | 'late' | 'failed' | 'today' | 'future' | 'missed';

interface DayInfo { day: number; dateStr: string; variant: DayVariant }

function buildDayGrid(
  year: number, month: number,
  calDays: CalendarDay[], sessions: SessionFallback[],
  localComps: LocalCompletion[], today: string,
): Array<DayInfo | null> {
  const byDate      = new Map<string, CalendarDay>(calDays.map((d) => [d.day_date, d]));
  const sessByDate  = new Map<string, SessionFallback>(sessions.map((s) => [s.challenge_date, s]));
  const localByDate = new Map<string, LocalCompletion>(localComps.map((c) => [c.challengeDate, c]));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow    = new Date(year, month, 1).getDay();

  const cells: Array<DayInfo | null> = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const calDay   = byDate.get(dateStr);
    const session  = sessByDate.get(dateStr);
    const localComp = localByDate.get(dateStr);

    let variant: DayVariant;
    if (calDay) {
      if (calDay.state === 'completed' && calDay.is_perfect) variant = 'perfect';
      else if (calDay.state === 'completed') variant = 'completed';
      else variant = 'failed';
    } else if (session) {
      variant = session.is_perfect ? 'perfect' : 'completed';
    } else if (localComp) {
      if (localComp.isRetroactive) variant = 'late';
      else variant = localComp.isPerfect ? 'perfect' : 'completed';
    } else if (dateStr === today) {
      variant = 'today';
    } else if (dateStr > today) {
      variant = 'future';
    } else {
      variant = 'missed';
    }
    cells.push({ day: d, dateStr, variant });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Day cell — pixel-faithful ────────────────────────────────────────────────

/**
 * Cores e ícones exatos do design:
 * perfect  → amber #F59E0B bg, white star
 * completed→ green #4ADE80 bg, white trophy
 * failed   → rose  #FECDD3 bg, coral #F87171 trophy
 * today    → blue  #2B52E5 bg, white "18\nHOJE"
 * future   → gray  #E5E7EB bg, gray  #9CA3AF lock
 * missed   → gray  #E5E7EB bg, gray  #9CA3AF lock
 */
const DAY_STYLE: Record<DayVariant, { bg: string; iconColor: string; icon?: string }> = {
  perfect:   { bg: '#F59E0B', iconColor: '#fff',     icon: 'star'        },
  completed: { bg: '#4ADE80', iconColor: '#fff',     icon: 'trophy'      },
  late:      { bg: '#FDE68A', iconColor: '#92400E',  icon: 'time'        }, // Feito atrasado — âmbar claro
  failed:    { bg: '#FECDD3', iconColor: '#F87171',  icon: 'trophy'      },
  today:     { bg: '#2B52E5', iconColor: '#fff'                          },
  future:    { bg: '#E5E7EB', iconColor: '#9CA3AF',  icon: 'lock-closed' },
  missed:    { bg: '#FECDD3', iconColor: '#F87171',  icon: 'trophy'      }, // Perdido
};

function DayCell({ info, today }: { info: DayInfo | null; today: string }) {
  const router = useRouter();
  if (!info) return <View style={dc.cell} />;

  const st = DAY_STYLE[info.variant];

  // Dias clicáveis: passados não completados (failed/missed) + hoje
  // Retroactive: qualquer dia passado não completado nos últimos 7 dias
  const isTappable = info.variant === 'today' ||
    info.variant === 'failed' ||
    (info.variant === 'missed' && info.dateStr !== undefined && info.dateStr >= getPastCutoff(today));

  function handlePress() {
    if (!info?.dateStr) return;
    const isRetro = info.dateStr !== today;
    router.push(`/(app)/challenge/${info.dateStr}${isRetro ? '?retroactive=1' : ''}` as never);
  }

  if (info.variant === 'today') {
    return (
      <Pressable style={[dc.cell, { backgroundColor: st.bg }]} onPress={handlePress}>
        <RNText style={dc.todayNum}>{info.day}</RNText>
        <RNText style={dc.todayLbl}>HOJE</RNText>
      </Pressable>
    );
  }

  if (isTappable) {
    return (
      <Pressable
        style={({ pressed }) => [dc.cell, { backgroundColor: st.bg }, pressed && { opacity: 0.75 }]}
        onPress={handlePress}
      >
        {st.icon && <Ionicons name={st.icon as never} size={17} color={st.iconColor} />}
        <RNText style={[dc.num, { color: st.iconColor }]}>{info.day}</RNText>
      </Pressable>
    );
  }

  return (
    <View style={[dc.cell, { backgroundColor: st.bg }]}>
      {st.icon && <Ionicons name={st.icon as never} size={17} color={st.iconColor} />}
      <RNText style={[dc.num, { color: st.iconColor }]}>{info.day}</RNText>
    </View>
  );
}

function getPastCutoff(today: string): string {
  const d = new Date(today);
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0]!;
}

const dc = StyleSheet.create({
  cell:     { width: DAY_SIZE, height: DAY_SIZE, borderRadius: DAY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  num:      { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 13 },
  todayNum: { fontFamily: fontFamily.extraBold, fontSize: 12, lineHeight: 13, color: '#fff' },
  todayLbl: { fontFamily: fontFamily.extraBold, fontSize: 8,  lineHeight: 10, color: '#fff', letterSpacing: 0.3 },
});

// ─── Month calendar card ──────────────────────────────────────────────────────

function MonthCalendar({ year, month, calDays, sessions, localComps, today }: {
  year: number; month: number;
  calDays: CalendarDay[]; sessions: SessionFallback[];
  localComps: LocalCompletion[]; today: string;
}) {
  const grid = buildDayGrid(year, month, calDays, sessions, localComps, today);
  return (
    <View style={mc.card}>
      <Text style={mc.title}>{MONTH_NAMES_PT[month]} {year}</Text>
      <View style={mc.dowRow}>
        {DOW_LABELS.map((lbl, i) => (
          <RNText key={i} style={mc.dowLbl}>{lbl}</RNText>
        ))}
      </View>
      <View style={mc.grid}>
        {grid.map((info, i) => <DayCell key={i} info={info} today={today} />)}
      </View>
    </View>
  );
}
const mc = StyleSheet.create({
  card:   { backgroundColor: '#fff', borderRadius: radius['2xl'], padding: 16, ...shadows.md },
  title:  { fontFamily: fontFamily.extraBold, fontSize: 18, color: colors.text.primary, textAlign: 'center', marginBottom: 14 },
  dowRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  dowLbl: { width: DAY_SIZE, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 12, color: colors.text.secondary },
  grid:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 8 },
});

// ─── Stats cards (Sequência + Recorde) ───────────────────────────────────────

function StreakCard({ value }: { value: number }) {
  const { t } = useTranslation();
  return (
    <LinearGradient colors={['#F5722A','#D45A18']} start={{x:0,y:0}} end={{x:1,y:1}} style={sc.card}>
      <View style={sc.iconCircleOrange}><Ionicons name="flame" size={22} color="#F5722A" /></View>
      <View style={sc.col}>
        <Text style={sc.valueWhite}>{value}</Text>
        <Text style={sc.labelWhite}>{t('calendar.streak')}</Text>
      </View>
    </LinearGradient>
  );
}

function RecordCard({ value }: { value: number }) {
  const { t } = useTranslation();
  return (
    <View style={[sc.card, sc.cardWhite]}>
      <View style={sc.iconCircleAmber}><Ionicons name="trophy" size={22} color="#F59E0B" /></View>
      <View style={sc.col}>
        <Text style={sc.valueAmber}>{value}</Text>
        <Text style={sc.labelGray}>{t('calendar.record')}</Text>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card:           { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.xl, paddingHorizontal: 16, paddingVertical: 16, ...shadows.md },
  cardWhite:      { backgroundColor: '#fff' },
  iconCircleOrange: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  iconCircleAmber:  { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' },
  col:            { gap: 2 },
  valueWhite:     { fontFamily: fontFamily.extraBold, fontSize: 36, lineHeight: 40, color: '#fff' },
  valueAmber:     { fontFamily: fontFamily.extraBold, fontSize: 36, lineHeight: 40, color: '#F59E0B' },
  labelWhite:     { fontFamily: fontFamily.semiBold, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  labelGray:      { fontFamily: fontFamily.semiBold, fontSize: 14, color: '#6B7280' },
});

// ─── Circular progress ring ───────────────────────────────────────────────────

function RingProgress({ pct, size = 80, stroke = 9, color = '#22C55E' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const deg     = clamped * 3.6;
  const R       = size / 2;
  const inner   = size - stroke * 2;
  const gray    = '#E5E7EB';

  // Two-half technique: right half covers 0–50%, left half covers 50–100%
  const rightRot = Math.min(deg, 180) - 180; // from -180 to 0
  const leftRot  = Math.max(0, deg - 180);   // from 0 to 180

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius: R, borderWidth: stroke, borderColor: gray }} />

      {/* Right half (0–50%) */}
      <View style={{ position:'absolute', top:0, left:R, width:R, height:size, overflow:'hidden' }}>
        <View style={{
          position:'absolute', top:0, left:-R, width:size, height:size,
          borderRadius:R, borderWidth:stroke,
          borderColor: clamped > 0 ? color : gray,
          transform:[{ rotate:`${rightRot}deg` }],
        }} />
      </View>

      {/* Left half (50–100%), only shown when > 50% */}
      {deg > 180 && (
        <View style={{ position:'absolute', top:0, left:0, width:R, height:size, overflow:'hidden' }}>
          <View style={{
            position:'absolute', top:0, right:0, width:size, height:size,
            borderRadius:R, borderWidth:stroke, borderColor:color,
            transform:[{ rotate:`${leftRot}deg` }],
          }} />
        </View>
      )}

      {/* White center + text */}
      <View style={{
        position:'absolute', top:stroke, left:stroke,
        width:inner, height:inner, borderRadius:inner/2,
        backgroundColor:'#fff', alignItems:'center', justifyContent:'center',
      }}>
        <RNText style={{ fontFamily:fontFamily.extraBold, fontSize:size*0.20, color, lineHeight:size*0.24 }}>
          {Math.round(clamped)}%
        </RNText>
      </View>
    </View>
  );
}

// ─── Progress section ─────────────────────────────────────────────────────────

function computeProgress(
  calDays: CalendarDay[], sessions: SessionFallback[],
  localComps: LocalCompletion[], monthlyXp: number, today: string,
) {
  const now = new Date(today + 'T12:00:00');
  const currentMonth = today.slice(0, 7); // YYYY-MM

  // Build set of completed dates (all sources)
  const completedSet = new Set<string>();
  for (const d of calDays) {
    if (d.state === 'completed') completedSet.add(d.day_date);
  }
  for (const s of sessions) completedSet.add(s.challenge_date);
  for (const l of localComps) completedSet.add(l.challengeDate);

  // Monthly progress
  const daysElapsed = now.getDate(); // day of month (1–31)
  let completedThisMonth = 0;
  for (const dateStr of completedSet) {
    if (dateStr.startsWith(currentMonth) && dateStr <= today) completedThisMonth++;
  }
  const monthPct = daysElapsed > 0 ? Math.round((completedThisMonth / daysElapsed) * 100) : 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Weekly progress (Mon → Sun)
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek);
  let completedThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    if (toISO(d) > today) break;
    if (completedSet.has(toISO(d))) completedThisWeek++;
  }
  const daysElapsedInWeek = Math.min(7, dayOfWeek + 1);

  // Monthly trophy progress (goal: 30 days)
  const TROPHY_GOAL = 30;

  // XP fallback: if ledger empty but localComps, estimate
  const estimatedXp = monthlyXp > 0
    ? monthlyXp
    : localComps.filter((l) => l.challengeDate.startsWith(currentMonth)).length * 200;

  return {
    monthPct,
    completedThisMonth,
    daysElapsed,
    daysInMonth,
    completedThisWeek,
    daysElapsedInWeek,
    trophyProgress: completedThisMonth,
    trophyGoal: TROPHY_GOAL,
    monthlyXp: estimatedXp,
    monthProgressMsg: monthPct >= 90 ? 'Você completou quase todos os dias. Incrível!'
      : monthPct >= 70 ? 'Você completou seus desafios em quase todos os dias. Continue assim!'
      : monthPct >= 50 ? 'Boa metade do mês! Continue o ritmo.'
      : monthPct >= 25 ? 'Bom começo! Tenta completar mais dias.'
      : 'Vamos começar a marcar este mês!',
  };
}

function ProgressSection({ data, today }: {
  data: CalendarData; today: string;
}) {
  const { t } = useTranslation();
  const prog = computeProgress(
    data.calDays, data.sessions, data.localComps, data.monthlyXp, today,
  );

  return (
    <View style={ps.wrap}>
      <Text style={ps.sectionTitle}>{t('calendar.progress.title')}</Text>

      {/* Progresso do mês */}
      <View style={ps.card}>
        <RingProgress pct={prog.monthPct} size={78} stroke={9} color="#22C55E" />
        <View style={ps.cardText}>
          <View style={ps.cardTitleRow}>
            <Ionicons name="calendar-outline" size={16} color="#22C55E" />
            <RNText style={ps.cardTitle}>{t('calendar.progress.monthProgress')}</RNText>
          </View>
          <RNText style={ps.cardDesc}>{prog.monthProgressMsg}</RNText>
        </View>
      </View>

      {/* Esta semana */}
      <View style={ps.card}>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={ps.weekHeader}>
            <View style={ps.weekLeft}>
              <Ionicons name="calendar-outline" size={16} color="#F5722A" />
              <RNText style={ps.weekTitle}>{t('calendar.progress.thisWeek')}</RNText>
            </View>
            <RNText style={ps.weekCount}>{prog.completedThisWeek}/7 dias</RNText>
          </View>
          <View style={ps.weekTrack}>
            <View style={[ps.weekFill, { width: `${(prog.completedThisWeek / 7) * 100}%` as `${number}%` }]} />
          </View>
        </View>
      </View>

      {/* Bottom row: Troféu mensal + XP no mês */}
      <View style={ps.bottomRow}>
        {/* Troféu mensal */}
        <View style={[ps.card, ps.cardHalf]}>
          <View style={ps.trophyIcon}>
            <Ionicons name="trophy" size={22} color="#F59E0B" />
          </View>
          <RNText style={ps.trophyTitle}>{t('calendar.progress.monthlyTrophy')}</RNText>
          <RNText style={ps.trophySub}>{prog.trophyProgress} de {prog.trophyGoal} dias</RNText>
          <View style={ps.trophyTrack}>
            <View style={[ps.trophyFill, { width: `${Math.min(100, (prog.trophyProgress / prog.trophyGoal) * 100)}%` as `${number}%` }]} />
          </View>
        </View>

        {/* XP no mês */}
        <LinearGradient
          colors={['#2B52E5','#1A3DB8']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={[ps.card, ps.cardHalf, ps.xpCard]}
        >
          <View style={ps.xpIconWrap}>
            <Ionicons name="flash" size={22} color="#fff" />
          </View>
          <RNText style={ps.xpValue}>+{prog.monthlyXp.toLocaleString('pt-BR')}</RNText>
          <RNText style={ps.xpLabel}>{t('calendar.xpThisMonthLabel')}</RNText>
        </LinearGradient>
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  wrap:         { gap: 12 },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 22, color: colors.text.primary },

  card:         { backgroundColor: '#fff', borderRadius: radius.xl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadows.sm },
  cardText:     { flex: 1, gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle:    { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  cardDesc:     { fontFamily: fontFamily.regular, fontSize: 13, color: colors.text.secondary, lineHeight: 18 },

  weekHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLeft:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekTitle:    { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary },
  weekCount:    { fontFamily: fontFamily.extraBold, fontSize: 15, color: '#F5722A' },
  weekTrack:    { height: 10, backgroundColor: '#FEE8D6', borderRadius: 999, overflow: 'hidden' },
  weekFill:     { height: 10, backgroundColor: '#F5722A', borderRadius: 999 },

  bottomRow:    { flexDirection: 'row', gap: 12 },
  cardHalf:     { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 4 },

  trophyIcon:   { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  trophyTitle:  { fontFamily: fontFamily.extraBold, fontSize: 14, color: colors.text.primary },
  trophySub:    { fontFamily: fontFamily.regular, fontSize: 12, color: colors.text.secondary },
  trophyTrack:  { width: '100%', height: 6, backgroundColor: '#F3F4F6', borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  trophyFill:   { height: 6, backgroundColor: '#F59E0B', borderRadius: 999 },

  xpCard:       { alignItems: 'center' },
  xpIconWrap:   { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  xpValue:      { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' },
  xpLabel:      { fontFamily: fontFamily.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.80)' },
});

// ─── Milo message ─────────────────────────────────────────────────────────────

function streakMessage(streak: number): string {
  if (streak === 0)  return 'Comece hoje e construa sua sequência! Eu acredito em você.';
  if (streak <= 2)   return `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}! Ótimo começo, continue assim!`;
  if (streak <= 6)   return 'Você está pegando o ritmo! Não pare agora.';
  if (streak <= 13)  return 'Sua sequência está incrível! Não perca hoje.';
  if (streak <= 29)  return `${streak} dias! Você é um verdadeiro herói da matemática!`;
  return `INCRÍVEL! ${streak} dias sem parar. Você é uma lenda!`;
}

// ─── Legend row (i18n-aware, includes 'late' state) ──────────────────────────

function LegendRow() {
  const { t } = useTranslation();
  const items = [
    { bg: '#F59E0B', icon: 'star',        label: t('calendar.legend.perfect'),   iconColor: '#fff'     },
    { bg: '#4ADE80', icon: 'trophy',      label: t('calendar.legend.completed'), iconColor: '#fff'     },
    { bg: '#FDE68A', icon: 'time',        label: t('calendar.legend.late'),      iconColor: '#92400E'  },
    { bg: '#FECDD3', icon: 'trophy',      label: t('calendar.legend.failed'),    iconColor: '#F87171'  },
    { bg: '#E5E7EB', icon: 'lock-closed', label: t('calendar.legend.locked'),    iconColor: '#9CA3AF'  },
  ] as const;
  return (
    <View style={[s.legend, { flexWrap: 'wrap', justifyContent: 'center', gap: 8 }]}>
      {items.map((item) => (
        <View key={item.label} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: item.bg }]}>
            <Ionicons name={item.icon as never} size={16} color={item.iconColor} />
          </View>
          <RNText style={s.legendLabel}>{item.label}</RNText>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarioScreen() {
  const child        = useProfileStore(selectActiveChild);
  const insets       = useSafeAreaInsets();
  const queryClient  = useQueryClient();
  const today        = useMemo(() => toISO(new Date()), []);
  const months       = useMemo(() => monthsToShow(), []);

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

  const calDays    = data?.calDays    ?? [];
  const sessions   = data?.sessions   ?? [];
  const localComps = data?.localComps ?? [];

  // Meses com pelo menos 1 desafio realizado + sempre o mês actual
  const completedMonths = useMemo(() => {
    const hasActivity = (year: number, month: number): boolean => {
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      return (
        calDays.some((d)    => d.day_date.startsWith(prefix)) ||
        sessions.some((s)   => s.challenge_date.startsWith(prefix)) ||
        localComps.some((l) => l.challengeDate.startsWith(prefix))
      );
    };
    const currentMonth = months[0]!; // índice 0 = mês actual
    return months.filter(
      (m, i) => i === 0 || hasActivity(m.year, m.month),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calDays, sessions, localComps, months]);

  const xpFloor    = getXpFloor(child.level);
  const xpCeil     = getXpCeil(child.level);
  const xpProgress = xpCeil > xpFloor ? (child.xp_total - xpFloor) / (xpCeil - xpFloor) : 1;

  return (
    <View style={s.safe}>

      {/* ── Fixed header ──────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Avatar avatarId={child.avatar_id} displayName={child.display_name} size="md" />
        <View style={s.headerMid}>
          <Text style={s.childName}>{child.display_name}</Text>
          <Text style={s.levelLabel}>Nível {child.level}</Text>
          <ProgressBar value={xpProgress} color={colors.primary} trackColor="#E4E5EF" height={6} style={{ marginTop: 4 }} />
          <View style={s.xpRow}>
            <Text style={s.xpCurrent}>{child.xp_total.toLocaleString('pt-BR')} XP</Text>
            <Text style={s.xpNext}>{xpCeil.toLocaleString('pt-BR')}</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable content ────────────────────────────────────── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <MiloMessage message={streakMessage(child.current_streak)} variant="blue" />

        {/* Stats row */}
        <View style={s.statsRow}>
          <StreakCard value={child.current_streak} />
          <RecordCard value={child.best_streak} />
        </View>

        {/* Calendars — só meses com actividade + mês actual */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 32 }} />
        ) : (
          completedMonths.map(({ year, month }) => (
            <MonthCalendar
              key={`${year}-${month}`}
              year={year} month={month}
              calDays={calDays} sessions={sessions}
              localComps={localComps} today={today}
            />
          ))
        )}

        {/* Legenda */}
        <LegendRow />

        {/* Seu progresso */}
        {data && <ProgressSection data={data} today={today} />}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EDEEF5' },
  headerMid:    { flex: 1 },
  childName:    { fontFamily: fontFamily.extraBold, fontSize: 17, color: colors.text.primary },
  levelLabel:   { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  xpRow:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  xpCurrent:    { fontFamily: fontFamily.bold, fontSize: 12, color: colors.primary },
  xpNext:       { fontFamily: fontFamily.semiBold, fontSize: 11, color: colors.text.secondary },

  scroll:  { flex: 1, backgroundColor: colors.background.primary },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },

  statsRow: { flexDirection: 'row', gap: 12 },

  // Legenda: uma única linha, círculos iguais aos dias do calendário
  legend:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  legendLabel:{ fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.text.secondary },
});
