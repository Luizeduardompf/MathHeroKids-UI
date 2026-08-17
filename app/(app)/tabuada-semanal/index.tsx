/**
 * Tabuada Semanal Premiada — visão geral da semana.
 *
 * Mostra a grelha de 7 dias (segunda a domingo), os 6 "blocos" de hoje (5 blocos da
 * tabuada + o desafio diário normal, que conta como o 6º) e a medalha se a semana já
 * estiver completa. Módulo independente do desafio diário quanto a XP/mastery — mas o dia
 * só fecha (e conta para os 7 dias da medalha) quando os 6 estiverem feitos, ver
 * backend/functions/_shared/tabuada.ts:tryCompleteDay.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import { useQuery } from '@tanstack/react-query';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { Card, ProgressBar, Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { tabuadaSemanalService } from '@/services/tabuada-semanal.service';
import { supabase } from '@/lib/supabase';
import { WEEKLY_TABUADA, WEEK_DAY_KEYS } from '@/constants/config';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import type { TabuadaBlockState } from '@/types/database.types';

const TABUADA_FRAME = require('../../../assets/images/tabuada-block-frame.png') as number;
const MILO_CELEBRATE = require('../../../assets/images/milo-celebrate.png') as number;

function todayLocalDate(): string {
  return new Date().toISOString().split('T')[0]!;
}

function mondayOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Dom..6=Sáb
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchTodayCalendarState(childId: string, today: string): Promise<boolean> {
  const { data } = await supabase
    .from('calendar_days')
    .select('state')
    .eq('child_id', childId)
    .eq('day_date', today)
    .maybeSingle();
  return data?.state === 'completed';
}

// ─── Cards ──────────────────────────────────────────────────────────────────────

function TabuadaBlockCard({ block, onPress }: { block: TabuadaBlockState; onPress: () => void }) {
  const { t } = useTranslation();
  const passed = block.status === 'passed';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={passed}
      onPress={onPress}
      style={styles.blockCard}
    >
      <Image
        source={passed ? MILO_CELEBRATE : TABUADA_FRAME}
        style={styles.blockCardArt}
        resizeMode="cover"
      />
      <View style={styles.blockCardPanel}>
        <View style={styles.blockCardBadgeRow}>
          <View style={[styles.blockCardBadge, passed && styles.blockCardBadgeSuccess]}>
            <Ionicons name={passed ? 'checkmark' : 'star'} size={16} color="#fff" />
          </View>
          <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {t('tabuadaSemanal.blockLabel', { n: block.block_number })}
          </Text>
        </View>

        {passed ? (
          <>
            <Text variant="bodySmall" color={colors.success} style={styles.blockCardCompleteText}>
              {t('tabuadaSemanal.blockCompleteBadge')}
            </Text>
            <View style={styles.blockCardScoreRow}>
              <Ionicons name="star" size={12} color={colors.trophy.gold} />
              <Text variant="caption" color={colors.text.secondary}>
                {t('tabuadaSemanal.blockScore', { correct: block.best_correct_count, total: WEEKLY_TABUADA.QUESTIONS_PER_BLOCK })}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.blockCardScoreRow}>
              <Ionicons name="trophy-outline" size={12} color={colors.text.tertiary} />
              <Text variant="caption" color={colors.text.secondary}>
                {t('tabuadaSemanal.blockScore', { correct: block.best_correct_count, total: WEEKLY_TABUADA.QUESTIONS_PER_BLOCK })}
              </Text>
            </View>
            <ProgressBar
              value={block.best_correct_count / WEEKLY_TABUADA.QUESTIONS_PER_BLOCK}
              height={6}
              style={{ marginBottom: space.sm }}
            />
            <View style={styles.blockCardPlayBtn}>
              <Ionicons name="play" size={12} color="#fff" />
              <Text style={styles.blockCardPlayBtnText} numberOfLines={1}>
                {t('tabuadaSemanal.playBlockCta', { n: block.block_number })}
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function DailyChallengeBlockCard({ done, onPress }: { done: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={done} onPress={onPress} style={styles.blockCard}>
      <LinearGradient
        colors={done ? [colors.success, '#166534'] : ['#16A34A', '#14532D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.blockCardArt}
      >
        <Ionicons name={done ? 'checkmark-circle' : 'flash'} size={40} color="rgba(255,255,255,0.95)" />
      </LinearGradient>
      <View style={styles.blockCardPanel}>
        <View style={styles.blockCardBadgeRow}>
          <View style={[styles.blockCardBadge, { backgroundColor: '#16A34A' }]}>
            <Ionicons name={done ? 'checkmark' : 'flash'} size={16} color="#fff" />
          </View>
          <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {t('tabuadaSemanal.dailyChallengeLabel')}
          </Text>
        </View>
        {done ? (
          <Text variant="bodySmall" color={colors.success} style={styles.blockCardCompleteText}>
            {t('tabuadaSemanal.dailyChallengeDone')}
          </Text>
        ) : (
          <>
            <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: space.sm }}>
              {t('tabuadaSemanal.dailyChallengePending')}
            </Text>
            <View style={[styles.blockCardPlayBtn, { backgroundColor: '#16A34A' }]}>
              <Ionicons name="play" size={12} color="#fff" />
              <Text style={styles.blockCardPlayBtnText} numberOfLines={1}>
                {t('tabuadaSemanal.dailyChallengeCta')}
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function TabuadaSemanalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child = useProfileStore(selectActiveChild);
  const today = todayLocalDate();
  const weekStart = mondayOfWeek(today);

  const { data: dayData, isLoading: loadingDay } = useQuery({
    queryKey: ['tabuada-today', child?.id, today],
    queryFn: () => tabuadaSemanalService.startDay(child!.id),
    enabled: !!child?.id,
    staleTime: 30_000,
  });

  const { data: weekStatus } = useQuery({
    queryKey: ['tabuada-week-status', child?.id, weekStart],
    queryFn: () => tabuadaSemanalService.getWeekStatus(child!.id, weekStart),
    enabled: !!child?.id,
    staleTime: 30_000,
  });

  const { data: weekDays = [] } = useQuery({
    queryKey: ['tabuada-week-days', child?.id, weekStart],
    queryFn: () => tabuadaSemanalService.getWeekDays(child!.id, weekStart),
    enabled: !!child?.id,
    staleTime: 30_000,
  });

  const { data: dailyChallengeDone = false } = useQuery({
    queryKey: ['tabuada-daily-challenge-status', child?.id, today],
    queryFn: () => fetchTodayCalendarState(child!.id, today),
    enabled: !!child?.id,
    staleTime: 30_000,
  });

  if (!child) return null;

  const completedDates = new Set(weekDays.filter((d) => d.completed_at).map((d) => d.day_date));
  const daysCompleted = weekStatus?.days_completed ?? completedDates.size;
  const medalEarned = !!weekStatus?.medal_earned_at;
  const todayFullyComplete = completedDates.has(today);

  const blocksState: TabuadaBlockState[] = dayData?.blocksState ?? [];
  const tabuadaBlocksPassed = blocksState.length > 0 && blocksState.every((b) => b.status === 'passed');
  const nextPendingBlock = blocksState.find((b) => b.status === 'pending')?.block_number ?? null;
  const onlyDailyChallengeLeft = tabuadaBlocksPassed && !dailyChallengeDone;

  const miloMessage = medalEarned
    ? t('tabuadaSemanal.miloMedalEarned')
    : todayFullyComplete
      ? t('tabuadaSemanal.miloDayDone')
      : onlyDailyChallengeLeft
        ? t('tabuadaSemanal.miloAlmostDone')
        : t('tabuadaSemanal.miloEncourage');

  return (
    <AuthScreen title={t('tabuadaSemanal.title')} subtitle="Math Hero Kids" onBack={() => router.back()}>
      <MiloMessage message={miloMessage} variant="orange" />

      {medalEarned && (
        <LinearGradient
          colors={[colors.trophy.gold, '#B8860B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.medalCard}
        >
          <Ionicons name="medal" size={40} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text variant="h3" color={colors.text.inverse}>{t('tabuadaSemanal.medalEarnedTitle')}</Text>
            <Text variant="bodySmall" color="rgba(255,255,255,0.85)">{t('tabuadaSemanal.medalEarnedSubtitle')}</Text>
          </View>
        </LinearGradient>
      )}

      {/* Grelha da semana — segunda a domingo */}
      <Card>
        <Text variant="label" color={colors.text.secondary} style={{ marginBottom: space.sm }}>
          {t('tabuadaSemanal.weekProgress', { days: daysCompleted, total: WEEKLY_TABUADA.DAYS_TO_COMPLETE_WEEK })}
        </Text>
        <ProgressBar
          value={daysCompleted / WEEKLY_TABUADA.DAYS_TO_COMPLETE_WEEK}
          color={colors.trophy.gold}
          style={{ marginBottom: space.md }}
        />
        <View style={styles.weekRow}>
          {WEEK_DAY_KEYS.map((key, idx) => {
            const date = addDays(weekStart, idx);
            const isDone = completedDates.has(date);
            const isToday = date === today;
            const isFuture = date > today;
            return (
              <View key={key} style={styles.dayCol}>
                <Text variant="caption" color={colors.text.tertiary}>{t(`tabuadaSemanal.weekDays.${key}`)}</Text>
                <View
                  style={[
                    styles.dayDot,
                    isDone ? styles.dayDotDone : null,
                    isToday && !isDone ? styles.dayDotToday : null,
                    isFuture ? styles.dayDotFuture : null,
                  ]}
                >
                  {isDone ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {onlyDailyChallengeLeft && (
        <TouchableOpacity
          style={styles.almostDoneBanner}
          activeOpacity={0.85}
          onPress={() => router.push(`/(app)/challenge/${today}`)}
        >
          <Ionicons name="flash" size={20} color="#fff" />
          <Text variant="label" color={colors.text.inverse} style={{ flex: 1 }}>
            {t('tabuadaSemanal.almostDoneBanner')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Blocos de hoje — 5 da tabuada + o desafio diário normal (o "6º bloco") */}
      <Text variant="h3">{t('tabuadaSemanal.todayBlocks')}</Text>

      {loadingDay ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      ) : (
        <View style={styles.blockGrid}>
          {blocksState.map((b) => (
            <TabuadaBlockCard
              key={b.block_number}
              block={b}
              onPress={() => router.push(`/(app)/tabuada-semanal/play/${b.block_number}`)}
            />
          ))}
          <DailyChallengeBlockCard
            done={dailyChallengeDone}
            onPress={() => router.push(`/(app)/challenge/${today}`)}
          />
        </View>
      )}

      {nextPendingBlock && (
        <TouchableOpacity
          style={styles.playCta}
          activeOpacity={0.85}
          onPress={() => router.push(`/(app)/tabuada-semanal/play/${nextPendingBlock}`)}
        >
          <Ionicons name="play" size={20} color={colors.text.inverse} />
          <Text variant="button" color={colors.text.inverse}>
            {t('tabuadaSemanal.playBlockCta', { n: nextPendingBlock })}
          </Text>
        </TouchableOpacity>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  medalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius['2xl'],
    padding: space.lg,
  },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: space.xs },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  dayDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dayDotToday: { borderColor: colors.primary },
  dayDotFuture: { opacity: 0.4 },

  almostDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#16A34A',
    borderRadius: radius.xl,
    padding: space.md,
  },

  // ── Cards dos blocos ─────────────────────────────────────────────────────────
  blockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  blockCard: {
    width: '47%',
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  blockCardArt: {
    width: '100%',
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCardPanel: {
    padding: space.sm,
    gap: 4,
  },
  blockCardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockCardBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCardBadgeSuccess: { backgroundColor: colors.success },
  blockCardCompleteText: { fontFamily: fontFamily.bold } as import('react-native').TextStyle,
  blockCardScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  blockCardPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 8,
  },
  blockCardPlayBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: '#fff',
  } as import('react-native').TextStyle,

  playCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: 56,
    marginTop: space.sm,
  },
});
