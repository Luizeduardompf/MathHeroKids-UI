/**
 * Tabuada Semanal Premiada — visão geral da semana.
 *
 * Mostra a grelha de 7 dias (segunda a domingo), os 5 blocos de hoje e a medalha se a
 * semana já estiver completa. Módulo independente do desafio diário — sem XP, sem
 * child_fact_mastery (ver CLAUDE.md / migration 020_weekly_tabuada.sql).
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { Badge, Card, ProgressBar, Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { tabuadaSemanalService } from '@/services/tabuada-semanal.service';
import { WEEKLY_TABUADA, WEEK_DAY_KEYS } from '@/constants/config';
import { colors, radius, space } from '@/theme';
import type { TabuadaBlockState } from '@/types/database.types';

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

  if (!child) return null;

  const completedDates = new Set(weekDays.filter((d) => d.completed_at).map((d) => d.day_date));
  const daysCompleted = weekStatus?.days_completed ?? completedDates.size;
  const medalEarned = !!weekStatus?.medal_earned_at;

  const blocksState: TabuadaBlockState[] = dayData?.blocksState ?? [];
  const passedBlocks = blocksState.filter((b) => b.status === 'passed').length;
  const nextPendingBlock = blocksState.find((b) => b.status === 'pending')?.block_number ?? null;

  return (
    <AuthScreen title={t('tabuadaSemanal.title')} subtitle="Math Hero Kids" onBack={() => router.back()}>
      <MiloMessage
        message={
          medalEarned
            ? t('tabuadaSemanal.miloMedalEarned')
            : passedBlocks === WEEKLY_TABUADA.BLOCKS_PER_DAY
              ? t('tabuadaSemanal.miloDayDone')
              : t('tabuadaSemanal.miloEncourage')
        }
        variant="orange"
      />

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

      {/* Blocos de hoje */}
      <Text variant="h3">{t('tabuadaSemanal.todayBlocks')}</Text>

      {loadingDay ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      ) : (
        <View style={styles.blockGrid}>
          {blocksState.map((b) => {
            const passed = b.status === 'passed';
            return (
              <TouchableOpacity
                key={b.block_number}
                activeOpacity={0.8}
                disabled={passed}
                onPress={() => router.push(`/(app)/tabuada-semanal/play/${b.block_number}`)}
                style={[styles.blockCard, passed ? styles.blockCardPassed : null]}
              >
                <View style={styles.blockIconWrap}>
                  <Ionicons
                    name={passed ? 'checkmark-circle' : 'play-circle'}
                    size={28}
                    color={passed ? colors.success : colors.primary}
                  />
                </View>
                <Text variant="label">{t('tabuadaSemanal.blockLabel', { n: b.block_number })}</Text>
                {b.attempts > 0 && (
                  <Badge
                    label={t('tabuadaSemanal.blockScore', { correct: b.best_correct_count, total: WEEKLY_TABUADA.QUESTIONS_PER_BLOCK })}
                    variant={passed ? 'success' : 'warning'}
                    style={{ marginTop: 4 }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
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
  blockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  blockCard: {
    width: '30%',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: space.md,
  },
  blockCardPassed: { backgroundColor: colors.successLight, borderColor: colors.success },
  blockIconWrap: { alignItems: 'center', justifyContent: 'center' },
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
