/**
 * Achievements screen.
 *
 * TODO Phase 3: wire to child_achievements via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Mock achievement data (Phase 3: replace with child_achievements query) ───

type AchievementIcon =
  | 'star-outline'
  | 'flame-outline'
  | 'flash-outline'
  | 'ribbon-outline'
  | 'calendar-outline'
  | 'medal-outline'
  | 'sparkles-outline'
  | 'trophy-outline';

interface Achievement {
  id: string;
  /** i18n key — Phase 3: comes from DB name_key column. */
  nameKey: string;
  descKey: string;
  /** i18n key for category label */
  categoryKey: string;
  icon: AchievementIcon;
  earned: boolean;
}

/**
 * Static achievements catalog — Phase 3: replace with child_achievements DB query.
 * nameKey / descKey / categoryKey map to i18n keys (same as DB name_key convention).
 */
const ACHIEVEMENTS: Achievement[] = [
  // Primeiros passos
  { id: 'a1', nameKey: 'achievements.items.a1.name', descKey: 'achievements.items.a1.desc', icon: 'star-outline',     categoryKey: 'achievements.categories.primeiros_passos', earned: true  },
  { id: 'a2', nameKey: 'achievements.items.a2.name', descKey: 'achievements.items.a2.desc', icon: 'sparkles-outline', categoryKey: 'achievements.categories.primeiros_passos', earned: true  },
  // Sequências
  { id: 'a3', nameKey: 'achievements.items.a3.name', descKey: 'achievements.items.a3.desc', icon: 'flame-outline',    categoryKey: 'achievements.categories.sequencias',       earned: true  },
  { id: 'a4', nameKey: 'achievements.items.a4.name', descKey: 'achievements.items.a4.desc', icon: 'flame-outline',    categoryKey: 'achievements.categories.sequencias',       earned: false },
  // Desempenho
  { id: 'a5', nameKey: 'achievements.items.a5.name', descKey: 'achievements.items.a5.desc', icon: 'flash-outline',    categoryKey: 'achievements.categories.desempenho',       earned: false },
  { id: 'a6', nameKey: 'achievements.items.a6.name', descKey: 'achievements.items.a6.desc', icon: 'flash-outline',    categoryKey: 'achievements.categories.desempenho',       earned: false },
  // Coleção
  { id: 'a7', nameKey: 'achievements.items.a7.name', descKey: 'achievements.items.a7.desc', icon: 'trophy-outline',   categoryKey: 'achievements.categories.colecao',          earned: false },
  { id: 'a8', nameKey: 'achievements.items.a8.name', descKey: 'achievements.items.a8.desc', icon: 'ribbon-outline',   categoryKey: 'achievements.categories.colecao',          earned: false },
];

// ─── Achievement card ─────────────────────────────────────────────────────────

function AchievementCard({ a }: { a: Achievement }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.achCard, a.earned ? styles.achCardEarned : styles.achCardLocked]}>
      <View style={[
        styles.achIcon,
        a.earned ? styles.achIconEarned : styles.achIconLocked,
      ]}>
        <Ionicons
          name={a.earned ? a.icon : 'lock-closed-outline'}
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
        {t(a.nameKey)}
      </Text>
      <Text
        variant="caption"
        align="center"
        color={colors.text.tertiary}
        style={styles.achDesc}
        numberOfLines={3}
      >
        {t(a.descKey)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const earned = ACHIEVEMENTS.filter((a) => a.earned).length;
  const total  = ACHIEVEMENTS.length;
  const pct    = Math.round((earned / total) * 100);

  const categories = Array.from(new Set(ACHIEVEMENTS.map((a) => a.categoryKey)));

  return (
    <AuthScreen
      title={t('achievements.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('milo.achievements')} />

      {/* ── Overall progress ──────────────────────────────────────────────── */}
      <Card border shadow="sm">
        <View style={styles.progressHeader}>
          <Text variant="h3">{t('achievements.collection')}</Text>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
        <ProgressBar
          value={earned / total}
          color={colors.primary}
          trackColor={colors.background.primary}
          height={12}
          style={styles.progressBar}
        />
        <Text variant="body" color={colors.text.secondary} style={styles.progressHint}>
          {t('achievements.unlocked', { count: earned, total })}
        </Text>
      </Card>

      {/* ── Category sections ─────────────────────────────────────────────── */}
      {categories.map((cat) => (
        <View key={cat} style={styles.category}>
          <Text variant="h3">{t(cat)}</Text>
          <View style={styles.achGrid}>
            {ACHIEVEMENTS.filter((a) => a.categoryKey === cat).map((a) => (
              <AchievementCard key={a.id} a={a} />
            ))}
          </View>
        </View>
      ))}
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Progress card ────────────────────────────────────────────────────────────
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

  // ── Achievement grid ─────────────────────────────────────────────────────────
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
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  achIconEarned: { backgroundColor: colors.primaryLight },
  achIconLocked: { backgroundColor: colors.background.primary },
  achName: { lineHeight: 18 },
  achDesc: { lineHeight: 16, fontSize: 11 },
});
