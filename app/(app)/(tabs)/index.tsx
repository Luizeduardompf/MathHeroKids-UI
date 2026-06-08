import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Badge, Button, Card, ProgressBar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { LEVEL_THRESHOLDS } from '@/constants/config';
import { colors, space } from '@/theme';

/** XP required for the next level, or last threshold if max level. */
function getXpNextLevel(level: number): number {
  const next = LEVEL_THRESHOLDS.find((t) => t.level === level + 1);
  if (next) return next.xpRequired;
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return last?.xpRequired ?? 99999;
}

/** XP at the start of the current level (floor for progress calculation). */
function getXpFloor(level: number): number {
  const current = LEVEL_THRESHOLDS.find((t) => t.level === level);
  return current?.xpRequired ?? 0;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child = useProfileStore(selectActiveChild);

  if (!child) return null; // Guard in (app)/_layout.tsx handles the redirect

  const xpFloor = getXpFloor(child.level);
  const xpCeil = getXpNextLevel(child.level);
  const xpProgress =
    xpCeil > xpFloor ? (child.xp_total - xpFloor) / (xpCeil - xpFloor) : 1;

  const todayDate = new Date().toISOString().split('T')[0]!;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Left: avatar + name ▾ + level */}
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(profile-select)/')}
            activeOpacity={0.7}
            accessibilityLabel={t('home.switchProfile')}
          >
            <Avatar
              avatarId={child.avatar_id}
              displayName={child.display_name}
              size="md"
            />
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text variant="label" color={colors.text.primary} style={styles.nameText}>
                  {child.display_name}
                </Text>
                <Text style={styles.chevron}>▾</Text>
              </View>
              <Text variant="caption" color={colors.text.secondary}>
                {t('common.level', { level: child.level })}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Center/Right: XP progress bar */}
          <TouchableOpacity
            style={styles.xpBlock}
            onPress={() => router.push('/(app)/progression')}
            activeOpacity={0.8}
          >
            <View style={styles.xpRow}>
              <Text variant="caption" color={colors.primary} style={styles.xpValue}>
                {child.xp_total.toLocaleString()} XP
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                {xpCeil.toLocaleString()}
              </Text>
            </View>
            <ProgressBar value={xpProgress} height={6} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1 — Milo */}
        <MiloMessage
          message={
            child.current_streak > 0
              ? t('milo.streak_active', { days: child.current_streak })
              : t('milo.great_job')
          }
        />

        {/* Section 2 — Streak stats */}
        <Card>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text variant="h1" color={colors.accent}>{child.current_streak}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('home.dayStreak')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.streakItem}>
              <Text style={styles.streakEmoji}>🏆</Text>
              <Text variant="h1">{child.best_streak}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('home.bestStreak')}</Text>
            </View>
          </View>
        </Card>

        {/* Section 3 — Today's Challenge */}
        <Card style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Badge label={t('home.challenge.notStarted')} variant="primary" />
            <Text variant="label" color={colors.primary}>+150 XP</Text>
          </View>
          <Text variant="caption" color={colors.text.secondary} style={{ marginTop: space.xs }}>
            {t('home.challenge.todaysChallenge')}
          </Text>
          <Text variant="h2">Multiplication Mountain</Text>
          <Text variant="bodySmall" color={colors.text.secondary}>
            {t('home.challenge.questions', { current: 0, total: 20 })}
          </Text>
          <ProgressBar value={0} color={colors.success} style={{ marginTop: space.xs }} />
          <Button
            label={t('home.challenge.start')}
            onPress={() => router.push(`/(app)/challenge/${todayDate}`)}
            style={{ marginTop: space.md }}
          />
        </Card>

        {/* Section 4 — Recent Trophies (Phase 3 will populate) */}
        <View style={styles.sectionHeader}>
          <Text variant="h3">{t('home.recentTrophies')}</Text>
          <Text
            variant="body"
            color={colors.primary}
            onPress={() => router.push('/(app)/trophy-room')}
          >
            {t('common.seeAll')}
          </Text>
        </View>
        <View style={styles.trophyRow}>
          {(
            [
              { key: 'home.trophy.daily', emoji: '🏅' },
              { key: 'home.trophy.weekly', emoji: '🔒' },
              { key: 'home.trophy.monthly', emoji: '🔒' },
            ] as const
          ).map(({ key, emoji }) => (
            <Card key={key} style={styles.trophyCard} padding={space.md}>
              <Text style={styles.trophyEmoji}>{emoji}</Text>
              <Text variant="caption" color={colors.text.secondary} align="center">
                {t(key)}
              </Text>
            </Card>
          ))}
        </View>

        {/* Section 5 — Statistics (Phase 3 will wire real queries) */}
        <Text variant="h3">{t('home.statistics')}</Text>
        <View style={styles.statsGrid}>
          {(
            [
              { key: 'home.perfectDays' },
              { key: 'home.perfectWeeks' },
              { key: 'home.perfectMonths' },
              { key: 'home.challengesDone' },
            ] as const
          ).map(({ key }) => (
            <Card key={key} style={styles.statCard} padding={space.md}>
              <Text variant="h2">—</Text>
              <Text variant="caption" color={colors.text.secondary}>
                {t(key)}
              </Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  safeHeader: { backgroundColor: colors.background.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.background.card,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  profileBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nameBlock: { gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nameText: { fontSize: 15 },
  chevron: { fontSize: 13, color: colors.text.secondary, marginTop: 1 },
  xpBlock: { flex: 1, gap: 4 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpValue: { fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  streakItem: { alignItems: 'center', gap: space.xs },
  streakEmoji: { fontSize: 24 },
  divider: { width: 1, height: 64, backgroundColor: colors.border.default },
  challengeCard: { gap: space.xs },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trophyRow: { flexDirection: 'row', gap: space.sm },
  trophyCard: { flex: 1, alignItems: 'center', gap: space.xs },
  trophyEmoji: { fontSize: 28 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statCard: { width: '47%' },
});
