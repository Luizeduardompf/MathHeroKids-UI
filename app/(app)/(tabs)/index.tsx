import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Badge, Button, Card, ProgressBar, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { LEVEL_THRESHOLDS } from '@/constants/config';
import { colors, radius, space } from '@/theme';

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

          {/* Right: XP progress */}
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
        <View style={styles.streakRow}>
          {/* Current streak — orange gradient pill */}
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakPillAccent}
          >
            <View style={styles.streakIconCircleLight}>
              <Ionicons name="flame" size={20} color={colors.text.inverse} />
            </View>
            <View>
              <Text variant="h2" color={colors.text.inverse}>{child.current_streak}</Text>
              <Text variant="caption" color="rgba(255,255,255,0.85)">{t('home.dayStreak')}</Text>
            </View>
          </LinearGradient>
          {/* Best streak — white pill */}
          <View style={styles.streakPillNeutral}>
            <View style={styles.streakIconCircleGold}>
              <Ionicons name="trophy" size={20} color={colors.warning} />
            </View>
            <View>
              <Text variant="h2">{child.best_streak}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('home.bestStreak')}</Text>
            </View>
          </View>
        </View>

        {/* Section 3 — Today's Challenge */}
        <LinearGradient
          colors={['#16A34A', '#14532D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.challengeCard}
        >
          {/* Decorative circles */}
          <View style={styles.challengeDecoTR} pointerEvents="none" />
          <View style={styles.challengeDecoBL} pointerEvents="none" />

          <View style={styles.challengeHeader}>
            <View style={styles.challengeStatusBadge}>
              <Ionicons name="sparkles" size={12} color={colors.text.inverse} />
              <Text variant="caption" style={styles.challengeStatusText}>
                {t('home.challenge.notStarted')}
              </Text>
            </View>
            <View style={styles.xpBadge}>
              <Text variant="caption" style={styles.xpBadgeText}>+150 XP</Text>
            </View>
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.70)" style={{ marginTop: space.sm }}>
            {t('home.challenge.todaysChallenge')}
          </Text>
          <Text variant="h2" color={colors.text.inverse} style={styles.challengeTitle}>
            Multiplication Mountain
          </Text>
          <Text variant="bodySmall" color="rgba(255,255,255,0.70)">
            {t('home.challenge.questions', { current: 0, total: 20 })}
          </Text>
          <ProgressBar
            value={0}
            color="rgba(255,255,255,0.9)"
            trackColor="rgba(255,255,255,0.25)"
            style={{ marginTop: space.xs }}
          />
          <Button
            label={t('home.challenge.start')}
            variant="secondary"
            onPress={() => router.push(`/(app)/challenge/${todayDate}`)}
            style={{ marginTop: space.md }}
          />
        </LinearGradient>

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
              { key: 'home.trophy.daily', icon: 'medal-outline' as const, color: colors.warning },
              { key: 'home.trophy.weekly', icon: 'lock-closed-outline' as const, color: colors.text.tertiary },
              { key: 'home.trophy.monthly', icon: 'lock-closed-outline' as const, color: colors.text.tertiary },
            ]
          ).map(({ key, icon, color }) => (
            <Card key={key} style={styles.trophyCard} padding={space.md}>
              <Ionicons name={icon} size={28} color={color} />
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
              { key: 'home.perfectDays',    icon: 'calendar-outline' as const,   iconBg: colors.primaryLight,  iconColor: colors.primary  },
              { key: 'home.perfectWeeks',   icon: 'calendar-outline' as const,   iconBg: colors.accentLight,   iconColor: colors.accent   },
              { key: 'home.perfectMonths',  icon: 'ribbon-outline'   as const,   iconBg: colors.successLight,  iconColor: colors.success  },
              { key: 'home.challengesDone', icon: 'trophy-outline'   as const,   iconBg: colors.warningLight,  iconColor: colors.warning  },
            ] as const
          ).map(({ key, icon, iconBg, iconColor }) => (
            <Card key={key} style={styles.statCard} padding={space.md}>
              <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={20} color={iconColor} />
              </View>
              <Text variant="h2" style={styles.statValue}>—</Text>
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

  // ── Streak ──────────────────────────────────────────────────────────────────
  streakRow: { flexDirection: 'row', gap: space.sm },
  streakPillAccent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    ...({
      shadowColor: colors.accent,
      shadowOpacity: 0.30,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    } as object),
  },
  streakPillNeutral: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.background.card,
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as object),
  },
  streakIconCircleLight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakIconCircleGold: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Challenge card ───────────────────────────────────────────────────────────
  challengeCard: {
    borderRadius: radius['2xl'],
    padding: space.lg,
    gap: space.xs,
    overflow: 'hidden',
    ...({
      shadowColor: '#14532D',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    } as object),
  },
  challengeDecoTR: {
    position: 'absolute',
    top: -32,
    right: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  challengeDecoBL: {
    position: 'absolute',
    bottom: -40,
    left: -24,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  challengeStatusText: {
    color: colors.text.inverse,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as import('react-native').TextStyle,
  xpBadge: {
    backgroundColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  xpBadgeText: {
    color: '#7A2E06',
    fontWeight: '900',
    fontSize: 12,
  } as import('react-native').TextStyle,
  challengeTitle: { marginTop: 2 },

  // ── Trophies ────────────────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trophyRow: { flexDirection: 'row', gap: space.sm },
  trophyCard: { flex: 1, alignItems: 'center', gap: space.xs },

  // ── Stats ───────────────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statCard: { width: '47%' },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  statValue: { marginBottom: 2 },
});
