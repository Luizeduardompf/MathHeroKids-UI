/**
 * Achievements screen — Phase 3.
 * Dados reais de achievements + child_achievements via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { fetchAchievementsWithState, type AchievementWithState } from '@/services/gamification.service';
import { colors, fontFamily, radius, space } from '@/theme';
import type { AchievementCategory } from '@/types/database.types';

const CATEGORY_ORDER: AchievementCategory[] = [
  'primeiros_passos',
  'sequencias',
  'habilidades',
  'especiais',
];

const CATEGORY_ICON: Record<AchievementCategory, string> = {
  primeiros_passos: 'star-outline',
  sequencias:       'flame-outline',
  habilidades:      'flash-outline',
  especiais:        'ribbon-outline',
};

// ─── Achievement card ─────────────────────────────────────────────────────────

function AchievementCard({ a }: { a: AchievementWithState }) {
  const { t } = useTranslation();
  const iconName = (CATEGORY_ICON[a.category] ?? 'star-outline') as 'star-outline';

  return (
    <View style={[styles.achCard, a.earned ? styles.achCardEarned : styles.achCardLocked]}>
      <View style={[styles.achIcon, a.earned ? styles.achIconEarned : styles.achIconLocked]}>
        <Ionicons
          name={a.earned ? iconName : 'lock-closed-outline'}
          size={28}
          color={a.earned ? colors.primary : colors.text.tertiary}
        />
      </View>
      <Text
        variant="label"
        align="center"
        color={a.earned ? colors.text.primary : colors.text.tertiary}
        style={styles.achName}
        numberOfLines={2}
      >
        {t(a.name_key)}
      </Text>
      <Text
        variant="caption"
        align="center"
        color={colors.text.tertiary}
        style={styles.achDesc}
        numberOfLines={3}
      >
        {t(a.description_key)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const child = useProfileStore(selectActiveChild);

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements', child?.id],
    queryFn:  () => fetchAchievementsWithState(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  const earned = achievements.filter((a) => a.earned).length;
  const total  = achievements.length;
  const pct    = total > 0 ? Math.round((earned / total) * 100) : 0;

  return (
    <AuthScreen
      title={t('achievements.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('achievements.miloMessage')} />

      {/* Overall progress */}
      <Card border shadow="sm">
        <View style={styles.progressHeader}>
          <Text variant="h3">{t('achievements.collection')}</Text>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
        <ProgressBar
          value={total > 0 ? earned / total : 0}
          color={colors.primary}
          trackColor={colors.background.primary}
          height={12}
          style={styles.progressBar}
        />
        <Text variant="body" color={colors.text.secondary} style={styles.progressHint}>
          {t('achievements.unlocked', { count: earned, total })}
        </Text>
      </Card>

      {isLoading && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      )}

      {/* Category sections */}
      {!isLoading && CATEGORY_ORDER.map((cat) => {
        const list = achievements.filter((a) => a.category === cat);
        if (list.length === 0) return null;
        return (
          <View key={cat} style={styles.category}>
            <Text variant="h3">{t(`achievements.categories.${cat}`)}</Text>
            <View style={styles.achGrid}>
              {list.map((a) => <AchievementCard key={a.id} a={a} />)}
            </View>
          </View>
        );
      })}
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  pctText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    color: colors.primary,
  } as import('react-native').TextStyle,
  progressBar: { marginBottom: space.sm },
  progressHint: { marginTop: 2 },
  category: { gap: space.sm },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  achCard: {
    width: '47%',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    padding: space.md,
    alignItems: 'center',
    gap: space.xs,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  achCardEarned: {
    backgroundColor: colors.background.card,
    borderColor: colors.border.default,
  },
  achCardLocked: {
    backgroundColor: `${colors.background.cardAlt}CC`,
    borderColor: colors.border.default,
  },
  achIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: space.xs,
  },
  achIconEarned: { backgroundColor: colors.primaryLight },
  achIconLocked: { backgroundColor: colors.background.primary },
  achName: { lineHeight: 18 },
  achDesc: { lineHeight: 16, fontSize: 11 },
});
