/**
 * Rewards screen — Phase 3.
 * Recompensas de nível desbloqueadas via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { Card, Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { fetchLevelRewards, type LevelRewardWithState } from '@/services/gamification.service';
import { colors, fontFamily, radius, space } from '@/theme';
import type { RewardType } from '@/types/database.types';

const REWARD_ICON: Record<RewardType, string> = {
  frame:         'images-outline',
  outfit:        'shirt-outline',
  medal:         'medal-outline',
  trophy_variant:'trophy-outline',
  celebration:   'sparkles-outline',
};

// ─── Reward card ──────────────────────────────────────────────────────────────

function RewardCard({ r, childLevel }: { r: LevelRewardWithState; childLevel: number }) {
  const { t } = useTranslation();
  const locked = !r.unlocked && childLevel < r.unlock_level;
  const iconName = (REWARD_ICON[r.reward_type] ?? 'gift-outline') as 'medal-outline';
  const bgColor = r.unlocked ? colors.primaryLight : colors.background.cardAlt;
  const iconColor = r.unlocked ? colors.primary : colors.text.tertiary;

  return (
    <View style={[styles.rewardCard, r.unlocked ? styles.rewardCardUnlocked : styles.rewardCardLocked]}>
      <View style={[styles.rewardIcon, { backgroundColor: bgColor }]}>
        <Ionicons
          name={locked ? 'lock-closed-outline' : iconName}
          size={28}
          color={iconColor}
        />
      </View>
      <Text
        variant="label"
        align="center"
        color={r.unlocked ? colors.text.primary : colors.text.tertiary}
        numberOfLines={2}
        style={styles.rewardName}
      >
        {t(r.name_key)}
      </Text>
      <View style={[styles.levelBadge, { backgroundColor: r.unlocked ? colors.primary : colors.background.primary }]}>
        <Text style={[styles.levelText, { color: r.unlocked ? '#fff' : colors.text.tertiary }]}>
          Nv. {r.unlock_level}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RewardsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child = useProfileStore(selectActiveChild);

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['level-rewards', child?.id],
    queryFn:  () => fetchLevelRewards(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  const unlockedCount = rewards.filter((r) => r.unlocked).length;
  const childLevel = child?.level ?? 1;

  // Próxima recompensa bloqueada
  const nextReward = rewards.find((r) => !r.unlocked);

  return (
    <AuthScreen
      title={t('progression.rewards.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('progression.rewards.miloMessage', { defaultValue: 'Complete desafios para desbloquear recompensas!' })} />

      {/* Stats */}
      <Card border shadow="sm">
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{unlockedCount}</Text>
            <Text variant="caption" color={colors.text.secondary}>{t('progression.rewards.unlocked', { defaultValue: 'Desbloqueadas' })}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{rewards.length}</Text>
            <Text variant="caption" color={colors.text.secondary}>{t('progression.rewards.total', { defaultValue: 'Total' })}</Text>
          </View>
          {nextReward && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{nextReward.unlock_level}</Text>
                <Text variant="caption" color={colors.text.secondary}>{t('progression.rewards.nextLevel', { defaultValue: 'Próximo nível' })}</Text>
              </View>
            </>
          )}
        </View>
      </Card>

      {isLoading && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      )}

      {/* Rewards grid */}
      {!isLoading && (
        <View style={styles.grid}>
          {rewards.map((r) => (
            <RewardCard key={r.id} r={r} childLevel={childLevel} />
          ))}
        </View>
      )}
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: space.xs },
  statValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
    color: colors.text.primary,
    lineHeight: 32,
  } as import('react-native').TextStyle,
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rewardCard: {
    width: '47%',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: space.sm,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  rewardCardUnlocked: {
    backgroundColor: colors.background.card,
    borderColor: `${colors.primary}40`,
  },
  rewardCardLocked: {
    backgroundColor: `${colors.background.cardAlt}CC`,
    borderColor: colors.border.default,
  },
  rewardIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  rewardName: { lineHeight: 18 },
  levelBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  levelText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
  } as import('react-native').TextStyle,
});
