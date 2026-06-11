/**
 * Trophy Detail screen — Phase 3.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { Card, ProgressBar, Text } from '@/components/ui';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { fetchTrophiesWithState } from '@/services/gamification.service';
import { colors, fontFamily, radius, space } from '@/theme';
import type { TrophyTier } from '@/types/database.types';

const RARITY_COLOR: Record<TrophyTier, { bg: string; icon: string; border: string }> = {
  bronze:  { bg: colors.accentLight,        icon: colors.accent,         border: colors.accent },
  silver:  { bg: colors.background.cardAlt, icon: colors.text.secondary, border: colors.text.secondary },
  gold:    { bg: colors.trophy.goldLight,    icon: colors.trophy.gold,    border: colors.trophy.gold },
  diamond: { bg: colors.primaryLight,        icon: colors.primary,        border: colors.primary },
};

export default function TrophyDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useProfileStore(selectActiveChild);

  const { data: trophies = [], isLoading } = useQuery({
    queryKey: ['trophies', child?.id],
    queryFn:  () => fetchTrophiesWithState(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  const trophy = trophies.find((tr) => tr.id === id);
  const r = trophy ? RARITY_COLOR[trophy.tier] : null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <AuthScreen
      title={t('trophies.detailTitle')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      {isLoading && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      )}

      {!isLoading && trophy && r && (
        <>
          <View style={styles.iconSection}>
            <View style={[styles.iconWrap, { backgroundColor: r.bg, borderColor: r.border }]}>
              <Ionicons
                name={trophy.earned ? 'trophy' : 'lock-closed'}
                size={56}
                color={trophy.earned ? r.icon : colors.text.tertiary}
              />
            </View>
            <Text style={styles.name}>{t(trophy.name_key)}</Text>
            <View style={[styles.tierBadge, { backgroundColor: r.bg }]}>
              <Text style={[styles.tierText, { color: r.icon }]}>
                {t(`trophies.tiers.${trophy.tier}`).toUpperCase()}
              </Text>
            </View>
          </View>

          <Card border>
            <Text variant="label" color={colors.text.secondary} style={{ marginBottom: space.xs }}>
              {t('trophies.howToEarn')}
            </Text>
            <Text>{t(trophy.description_key)}</Text>
          </Card>

          <Card border>
            {trophy.earned ? (
              <View style={styles.earnedRow}>
                <View style={[styles.earnedIcon, { backgroundColor: `${colors.success}20` }]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </View>
                <View>
                  <Text variant="label">{t('trophies.earnedOn')}</Text>
                  {trophy.earned_at && (
                    <Text variant="caption" color={colors.text.secondary}>
                      {formatDate(trophy.earned_at)}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={{ gap: space.xs }}>
                <Text variant="label" color={colors.text.secondary}>{t('trophies.nextTrophy')}</Text>
                <ProgressBar
                  value={Math.min(trophy.progress / trophy.requirement_value, 1)}
                  color={r.icon}
                  trackColor={colors.background.primary}
                  height={12}
                />
                <Text variant="caption" color={colors.text.secondary}>
                  {trophy.progress} / {trophy.requirement_value}
                </Text>
              </View>
            )}
          </Card>
        </>
      )}

      {!isLoading && !trophy && (
        <Text align="center" color={colors.text.secondary} style={{ marginTop: space.lg }}>
          {t('errors.notFound')}
        </Text>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  iconSection: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  iconWrap: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, marginBottom: space.xs,
  },
  name: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    color: colors.text.primary,
    textAlign: 'center',
  } as import('react-native').TextStyle,
  tierBadge: { borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.xs },
  tierText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 12,
    letterSpacing: 1,
  } as import('react-native').TextStyle,
  earnedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  earnedIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
