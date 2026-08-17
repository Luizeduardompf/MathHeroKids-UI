/**
 * Tabuada Semanal Premiada — visão geral da semana.
 *
 * Mostra a grelha de 7 dias (segunda a domingo) e os 6 "blocos" de hoje — 5 blocos da
 * tabuada + o desafio diário normal, que conta como o 6º — numa lista vertical, um por
 * linha, com desbloqueio sequencial: só o próximo bloco por fazer fica jogável, os
 * seguintes ficam "Bloqueado" até o anterior passar. Mostra a medalha se a semana já
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
import {
  WEEKLY_TABUADA,
  WEEK_DAY_KEYS,
  eurosToCents,
  centsToEuroLabel,
  tabuadaBlockEarnedCents,
  capTabuadaCents,
} from '@/constants/config';
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

/** Soma em cêntimos o ganho dos blocos de um dia — proporcional ao melhor resultado de cada um. */
function sumBlocksEarnedCents(blocksState: TabuadaBlockState[], weeklyReward: number): number {
  return blocksState.reduce((sum, b) => sum + tabuadaBlockEarnedCents(weeklyReward, b.best_correct_count), 0);
}

// ─── Cards ──────────────────────────────────────────────────────────────────────

function TabuadaBlockCard({ block, locked, weeklyReward, onPress }: {
  block: TabuadaBlockState; locked: boolean; weeklyReward: number; onPress: () => void;
}) {
  const { t } = useTranslation();
  const passed = block.status === 'passed';
  const maxed = passed && block.best_correct_count === WEEKLY_TABUADA.QUESTIONS_PER_BLOCK;
  const earnedCents = tabuadaBlockEarnedCents(weeklyReward, block.best_correct_count);

  return (
    <TouchableOpacity
      activeOpacity={maxed || locked ? 1 : 0.85}
      disabled={maxed || locked}
      onPress={onPress}
      style={[styles.blockCard, locked && styles.blockCardLocked]}
    >
      <View style={styles.blockCardArtWrap}>
        <Image
          source={passed ? MILO_CELEBRATE : TABUADA_FRAME}
          style={styles.blockCardArt}
          resizeMode="cover"
        />
        {locked && (
          <View style={styles.blockCardLockOverlay}>
            <Ionicons name="lock-closed" size={30} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.blockCardPanel}>
        <View style={styles.blockCardBadgeRow}>
          <View style={[styles.blockCardBadge, passed && styles.blockCardBadgeSuccess, locked && styles.blockCardBadgeLocked]}>
            <Ionicons name={locked ? 'lock-closed' : passed ? 'checkmark' : 'star'} size={16} color="#fff" />
          </View>
          <Text variant="label" numberOfLines={1} color={locked ? colors.text.tertiary : undefined} style={{ flex: 1 }}>
            {t('tabuadaSemanal.blockLabel', { n: block.block_number })}
          </Text>
          {weeklyReward > 0 && !locked && block.attempts > 0 && (
            <Text variant="label" color={colors.trophy.gold} style={styles.blockCardEarnedBadge}>
              {centsToEuroLabel(earnedCents)}
            </Text>
          )}
        </View>

        {locked ? (
          <Text variant="bodySmall" color={colors.text.tertiary}>
            {t('tabuadaSemanal.blockLocked')}
          </Text>
        ) : (
          <>
            <View style={styles.blockCardScoreRow}>
              <Ionicons name={maxed ? 'star' : 'trophy-outline'} size={12} color={maxed ? colors.trophy.gold : colors.text.tertiary} />
              <Text variant="caption" color={colors.text.secondary}>
                {t('tabuadaSemanal.blockScore', { correct: block.best_correct_count, total: WEEKLY_TABUADA.QUESTIONS_PER_BLOCK })}
              </Text>
              {maxed && (
                <Text variant="bodySmall" color={colors.success} style={styles.blockCardCompleteText}>
                  {t('tabuadaSemanal.blockCompleteBadge')}
                </Text>
              )}
            </View>
            {passed && !maxed && (
              <Text variant="caption" color={colors.success} style={styles.blockCardCompleteText} numberOfLines={1}>
                {t('tabuadaSemanal.blockPassedRetryHint')}
              </Text>
            )}
            {!maxed && (
              <ProgressBar
                value={block.best_correct_count / WEEKLY_TABUADA.QUESTIONS_PER_BLOCK}
                height={6}
              />
            )}
          </>
        )}
      </View>
      {!maxed && !locked && (
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} style={styles.blockCardChevron} />
      )}
    </TouchableOpacity>
  );
}

function DailyChallengeBlockCard({ done, locked, onPress }: { done: boolean; locked: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={done || locked ? 1 : 0.85}
      disabled={done || locked}
      onPress={onPress}
      style={[styles.blockCard, locked && styles.blockCardLocked]}
    >
      <View style={styles.blockCardArtWrap}>
        <LinearGradient
          colors={done ? [colors.success, '#166534'] : ['#16A34A', '#14532D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.blockCardArt}
        >
          <Ionicons name={done ? 'checkmark-circle' : 'flash'} size={40} color="rgba(255,255,255,0.95)" />
        </LinearGradient>
        {locked && (
          <View style={styles.blockCardLockOverlay}>
            <Ionicons name="lock-closed" size={30} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.blockCardPanel}>
        <View style={styles.blockCardBadgeRow}>
          <View style={[styles.blockCardBadge, { backgroundColor: '#16A34A' }, locked && styles.blockCardBadgeLocked]}>
            <Ionicons name={locked ? 'lock-closed' : done ? 'checkmark' : 'flash'} size={16} color="#fff" />
          </View>
          <Text variant="label" numberOfLines={1} color={locked ? colors.text.tertiary : undefined} style={{ flex: 1 }}>
            {t('tabuadaSemanal.dailyChallengeLabel')}
          </Text>
        </View>
        {locked ? (
          <Text variant="bodySmall" color={colors.text.tertiary}>
            {t('tabuadaSemanal.blockLocked')}
          </Text>
        ) : done ? (
          <Text variant="bodySmall" color={colors.success} style={styles.blockCardCompleteText}>
            {t('tabuadaSemanal.dailyChallengeDone')}
          </Text>
        ) : (
          <Text variant="caption" color={colors.text.secondary}>
            {t('tabuadaSemanal.dailyChallengePending')}
          </Text>
        )}
      </View>
      {!done && !locked && (
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} style={styles.blockCardChevron} />
      )}
    </TouchableOpacity>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

type OrderedItem =
  | { kind: 'tabuada'; block: TabuadaBlockState }
  | { kind: 'daily'; done: boolean };

export default function TabuadaSemanalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child = useProfileStore(selectActiveChild);
  const today = todayLocalDate();
  const weekStart = mondayOfWeek(today);

  const tabuadaEnabled = !!child?.tabuada_enabled;

  const { data: dayData, isLoading: loadingDay } = useQuery({
    queryKey: ['tabuada-today', child?.id, today],
    queryFn: () => tabuadaSemanalService.startDay(child!.id),
    enabled: !!child?.id && tabuadaEnabled,
    staleTime: 30_000,
  });

  const { data: weekStatus } = useQuery({
    queryKey: ['tabuada-week-status', child?.id, weekStart],
    queryFn: () => tabuadaSemanalService.getWeekStatus(child!.id, weekStart),
    enabled: !!child?.id && tabuadaEnabled,
    staleTime: 30_000,
  });

  const { data: weekDays = [] } = useQuery({
    queryKey: ['tabuada-week-days', child?.id, weekStart],
    queryFn: () => tabuadaSemanalService.getWeekDays(child!.id, weekStart),
    enabled: !!child?.id && tabuadaEnabled,
    staleTime: 30_000,
  });

  const { data: dailyChallengeDone = false } = useQuery({
    queryKey: ['tabuada-daily-challenge-status', child?.id, today],
    queryFn: () => fetchTodayCalendarState(child!.id, today),
    enabled: !!child?.id && tabuadaEnabled,
    staleTime: 30_000,
  });

  if (!child) return null;

  if (!tabuadaEnabled) {
    return (
      <AuthScreen title={t('tabuadaSemanal.title')} subtitle="Math Hero Kids" onBack={() => router.back()}>
        <MiloMessage message={t('tabuadaSemanal.disabledMessage')} variant="orange" />
      </AuthScreen>
    );
  }

  const completedDates = new Set(weekDays.filter((d) => d.completed_at).map((d) => d.day_date));
  const daysCompleted = weekStatus?.days_completed ?? completedDates.size;
  const medalEarned = !!weekStatus?.medal_earned_at;
  const todayFullyComplete = completedDates.has(today);

  const blocksState: TabuadaBlockState[] = dayData?.blocksState ?? [];
  const tabuadaBlocksPassed = blocksState.length > 0 && blocksState.every((b) => b.status === 'passed');
  const onlyDailyChallengeLeft = tabuadaBlocksPassed && !dailyChallengeDone;

  // Desbloqueio sequencial: cada item só fica jogável quando o anterior está feito.
  const orderedItems: OrderedItem[] = [
    ...blocksState.map((block): OrderedItem => ({ kind: 'tabuada', block })),
    { kind: 'daily', done: dailyChallengeDone },
  ];
  let unlockedSoFar = true;
  const itemsWithLock = orderedItems.map((item) => {
    // O desafio diário é o módulo padrão do app — independente, nunca bloqueado por aqui.
    if (item.kind === 'daily') return { item, locked: false };
    const locked = !unlockedSoFar;
    unlockedSoFar = unlockedSoFar && item.block.status === 'passed';
    return { item, locked };
  });

  const weeklyReward = Number(child.tabuada_weekly_reward ?? 0);
  const todayEarnedCentsRaw = sumBlocksEarnedCents(blocksState, weeklyReward);
  const weekEarnedCentsRaw = weekDays.reduce((sum, d) => {
    if (d.day_date === today) return sum; // hoje entra pela via ao vivo (dayData), não pela cópia de weekDays
    return sum + sumBlocksEarnedCents(d.blocks_state, weeklyReward);
  }, todayEarnedCentsRaw);
  // Limite duro: mesmo com deriva de arredondamento ao somar até 35 blocos, o total exibido
  // nunca pode ultrapassar o valor configurado pelo pai.
  const todayEarnedCents = capTabuadaCents(todayEarnedCentsRaw, weeklyReward);
  const weekEarnedCents = capTabuadaCents(weekEarnedCentsRaw, weeklyReward);

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

        {weeklyReward > 0 && (
          <View style={styles.rewardRow}>
            <Ionicons name="cash-outline" size={20} color="#B8860B" />
            <Text variant="label" style={{ flex: 1 }}>
              {t('tabuadaSemanal.rewardEarned', {
                earned: centsToEuroLabel(weekEarnedCents),
                total: centsToEuroLabel(eurosToCents(weeklyReward)),
              })}
            </Text>
          </View>
        )}
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

      {/* Blocos de hoje — 5 da tabuada + o desafio diário normal (o "6º bloco"), um por linha */}
      <View style={styles.sectionHeaderRow}>
        <Text variant="h3">{t('tabuadaSemanal.todayBlocks')}</Text>
        {weeklyReward > 0 && (
          <Text variant="label" color={colors.trophy.gold}>
            {t('tabuadaSemanal.todayEarned', { earned: centsToEuroLabel(todayEarnedCents) })}
          </Text>
        )}
      </View>

      {loadingDay ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      ) : (
        <View style={styles.blockList}>
          {itemsWithLock.map(({ item, locked }) => {
            if (item.kind === 'tabuada') {
              return (
                <TabuadaBlockCard
                  key={`block-${item.block.block_number}`}
                  block={item.block}
                  locked={locked}
                  weeklyReward={weeklyReward}
                  onPress={() => router.push(`/(app)/tabuada-semanal/play/${item.block.block_number}`)}
                />
              );
            }
            return (
              <DailyChallengeBlockCard
                key="daily-challenge"
                done={item.done}
                locked={locked}
                onPress={() => router.push(`/(app)/challenge/${today}`)}
              />
            );
          })}
        </View>
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
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  almostDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#16A34A',
    borderRadius: radius.xl,
    padding: space.md,
  },

  // ── Cards dos blocos — lista vertical, um por linha ───────────────────────────
  blockList: { gap: space.sm },
  blockCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  blockCardChevron: { marginRight: space.md },
  blockCardEarnedBadge: { fontFamily: fontFamily.extraBold } as import('react-native').TextStyle,
  blockCardLocked: { opacity: 0.75 },
  blockCardArtWrap: { width: 96, height: 96 },
  blockCardArt: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCardLockOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26,31,54,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCardPanel: {
    flex: 1,
    padding: space.sm,
    gap: 4,
    justifyContent: 'center',
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
  blockCardBadgeLocked: { backgroundColor: colors.text.tertiary },
  blockCardCompleteText: { fontFamily: fontFamily.bold } as import('react-native').TextStyle,
  blockCardScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
});
