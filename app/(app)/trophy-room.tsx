/**
 * Trophy Room screen — Phase 3.
 * Dados reais de trophies + child_trophies via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { fetchTrophiesWithState, type TrophyWithState } from '@/services/gamification.service';
import { colors, fontFamily, radius, space } from '@/theme';
import type { TrophyCategory, TrophyTier } from '@/types/database.types';

// ─── Rarity config ────────────────────────────────────────────────────────────

const RARITY: Record<TrophyTier, { bg: string; icon: string; chip: string; chipText: string }> = {
  bronze:  { bg: colors.accentLight,         icon: colors.accent,         chip: colors.accentLight,        chipText: colors.accent         },
  silver:  { bg: colors.background.cardAlt,  icon: colors.text.secondary, chip: colors.background.cardAlt, chipText: colors.text.secondary },
  gold:    { bg: colors.trophy.goldLight,     icon: colors.trophy.gold,    chip: colors.trophy.goldLight,   chipText: colors.trophy.gold    },
  diamond: { bg: colors.primaryLight,         icon: colors.primary,        chip: colors.primaryLight,       chipText: colors.primary        },
};

const CATEGORY_ORDER: TrophyCategory[] = ['daily', 'weekly', 'monthly', 'streak', 'special'];

// ─── Trophy card ──────────────────────────────────────────────────────────────

function TrophyCard({ trophy, onPress }: { trophy: TrophyWithState; onPress: () => void }) {
  const { t } = useTranslation();
  const r = RARITY[trophy.tier];

  return (
    <TouchableOpacity style={styles.trophyCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.trophyIconWrap, { backgroundColor: trophy.earned ? r.bg : colors.background.cardAlt }]}>
        <Ionicons
          name={trophy.earned ? 'trophy' : 'lock-closed'}
          size={36}
          color={trophy.earned ? r.icon : colors.text.tertiary}
        />
      </View>

      <Text
        variant="label"
        align="center"
        color={trophy.earned ? colors.text.primary : colors.text.tertiary}
        numberOfLines={2}
        style={styles.trophyName}
      >
        {t(trophy.name_key)}
      </Text>

      <View style={[styles.rarityChip, { backgroundColor: r.chip }]}>
        <Text style={[styles.rarityChipText, { color: r.chipText }]}>
          {t(`trophies.tiers.${trophy.tier}`)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrophyRoomScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child  = useProfileStore(selectActiveChild);

  const { data: trophies = [], isLoading } = useQuery({
    queryKey: ['trophies', child?.id],
    queryFn:  () => fetchTrophiesWithState(child!.id),
    enabled:  !!child?.id,
    staleTime: 60_000,
  });

  const earnedCount = trophies.filter((t) => t.earned).length;

  // Próximo troféu: primeiro não earned com menor requirement_value
  const nextTrophy = trophies.find((t) => !t.earned);

  return (
    <AuthScreen
      title={t('trophies.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('trophies.miloMessage')} />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statPill, styles.statPillGold]}>
          <View style={[styles.statIconWrap, { backgroundColor: `${colors.trophy.gold}25` }]}>
            <Ionicons name="trophy" size={22} color={colors.trophy.gold} />
          </View>
          <View>
            <Text style={styles.statValue}>{earnedCount}</Text>
            <Text variant="caption" color={colors.text.secondary}>{t('trophies.earned')}</Text>
          </View>
        </View>
        <View style={[styles.statPill, styles.statPillOrange]}>
          <View style={[styles.statIconWrap, { backgroundColor: `${colors.accent}20` }]}>
            <Ionicons name="flame" size={22} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.statValue}>{child?.current_streak ?? 0}</Text>
            <Text variant="caption" color={colors.text.secondary}>{t('trophies.streak')}</Text>
          </View>
        </View>
      </View>

      {/* Loading */}
      {isLoading && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.lg }} />
      )}

      {/* Próximo troféu */}
      {!isLoading && nextTrophy && (
        <Card border shadow="sm">
          <Text style={styles.nextLabel}>{t('trophies.nextTrophy')}</Text>
          <View style={styles.nextRow}>
            <View style={[styles.trophyIconWrapSm, { backgroundColor: colors.background.cardAlt }]}>
              <Ionicons name="lock-closed" size={20} color={colors.text.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t(nextTrophy.name_key)}</Text>
              <ProgressBar
                value={Math.min(nextTrophy.progress / nextTrophy.requirement_value, 1)}
                color={colors.warning}
                trackColor={colors.background.primary}
                height={10}
                style={{ marginTop: space.xs }}
              />
              <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 4 }}>
                {nextTrophy.progress} / {nextTrophy.requirement_value}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Categorias */}
      {!isLoading && CATEGORY_ORDER.map((cat) => {
        const list = trophies.filter((t) => t.category === cat);
        if (list.length === 0) return null;
        return (
          <View key={cat} style={styles.category}>
            <Text variant="h3">{t(`trophies.sections.${cat}`)}</Text>
            <View style={styles.trophyGrid}>
              {list.map((trophy) => (
                <TrophyCard
                  key={trophy.id}
                  trophy={trophy}
                  onPress={() => router.push(`/(app)/trophy/${trophy.id}`)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: space.sm },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius['2xl'],
    padding: space.md,
    borderWidth: 1,
  },
  statPillGold:   { backgroundColor: colors.trophy.goldLight, borderColor: `${colors.trophy.gold}30` },
  statPillOrange: { backgroundColor: colors.accentLight,       borderColor: `${colors.accent}25` },
  statIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    color: colors.text.primary,
    lineHeight: 28,
  } as import('react-native').TextStyle,
  nextLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
    color: colors.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  } as import('react-native').TextStyle,
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  trophyIconWrapSm: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  category: { gap: space.sm },
  trophyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  trophyCard: {
    width: '47%',
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
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
  trophyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyName: { lineHeight: 18 },
  rarityChip: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  rarityChipText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
  } as import('react-native').TextStyle,
});
