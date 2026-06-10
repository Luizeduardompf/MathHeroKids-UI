/**
 * Progression screen — level, XP, milestones.
 *
 * Real data: child.level + child.xp_total from profileStore (live).
 * Milestones: TODO Phase 3 — wire to level_rewards table via TanStack Query.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, ProgressBar, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { LEVEL_THRESHOLDS } from '@/constants/config';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThreshold(level: number) {
  return LEVEL_THRESHOLDS.find((t) => t.level === level);
}

function getXpRange(level: number) {
  const floor = getThreshold(level)?.xpRequired ?? 0;
  const ceil  = getThreshold(level + 1)?.xpRequired ?? floor + 1000;
  return { floor, ceil };
}

// ─── Mock milestone data (Phase 3: replace with level_rewards query) ─────────

type MilestoneStatus = 'unlocked' | 'current' | 'locked';

const MILESTONES: Array<{ level: number; title: string; reward: string; status: MilestoneStatus }> = [
  { level: 1,  title: 'Explorador',        reward: 'Avatar inicial desbloqueado',   status: 'unlocked' },
  { level: 5,  title: 'Aventureiro',        reward: 'Moldura de Aventureiro',        status: 'unlocked' },
  { level: 10, title: 'Herói',              reward: 'Roupa especial do Milo',        status: 'unlocked' },
  { level: 15, title: 'Mago Aprendiz',      reward: 'Variante de Troféu Dourado',   status: 'current'  },
  { level: 20, title: 'Mago',               reward: 'Celebração especial',          status: 'locked'   },
  { level: 30, title: 'Mago Supremo',       reward: 'Medalha Lendária',             status: 'locked'   },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child  = useProfileStore(selectActiveChild);

  if (!child) return null;

  const { floor, ceil } = getXpRange(child.level);
  const progress = ceil > floor ? (child.xp_total - floor) / (ceil - floor) : 1;
  const xpRemaining = Math.max(0, ceil - child.xp_total);
  const levelNameKey = getThreshold(child.level)?.nameKey ?? 'levels.explorador';
  const levelName = t(levelNameKey);

  const miloMsg = xpRemaining < 300
    ? 'Você está super perto do próximo nível! Bora lá?'
    : 'Continue fazendo desafios para subir de nível!';

  return (
    <AuthScreen
      title="Progressão"
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      {/* ── Level card ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.levelCard}
      >
        {/* Gold level circle */}
        <View style={styles.levelCircleOuter}>
          <View style={styles.levelCircle}>
            <Text style={styles.levelNumber}>{child.level}</Text>
          </View>
          <View style={styles.levelStar}>
            <Ionicons name="star" size={20} color="#fff" />
          </View>
        </View>

        <Text style={styles.levelLabel}>NÍVEL ATUAL</Text>
        <Text style={styles.levelName}>{levelName}</Text>

        {/* XP bar */}
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>{child.xp_total.toLocaleString()} XP</Text>
          <Text style={styles.xpLabelMuted}>{ceil.toLocaleString()}</Text>
        </View>
        <ProgressBar
          value={progress}
          color="rgba(255,255,255,0.95)"
          trackColor="rgba(255,255,255,0.25)"
          height={10}
          style={styles.xpBar}
        />
        <Text style={styles.xpHint}>
          Faltam {xpRemaining.toLocaleString()} XP para o nível {child.level + 1}
        </Text>
      </LinearGradient>

      {/* ── Milo ──────────────────────────────────────────────────────────── */}
      <MiloMessage message={miloMsg} variant="orange" />

      {/* ── Milestones timeline ───────────────────────────────────────────── */}
      <Text variant="h3">Marcos e recompensas</Text>

      <View style={styles.timeline}>
        {/* Vertical line */}
        <View style={styles.timelineLine} />

        {MILESTONES.map((m) => (
          <View key={m.level} style={styles.milestoneRow}>
            {/* Circle indicator */}
            <View style={[
              styles.milestoneCircle,
              m.status === 'unlocked' ? styles.circleUnlocked :
              m.status === 'current'  ? styles.circleCurrent  :
                                        styles.circleLocked,
            ]}>
              {m.status === 'unlocked' ? (
                <Ionicons name="checkmark" size={18} color="#fff" />
              ) : m.status === 'locked' ? (
                <Ionicons name="lock-closed" size={14} color={colors.text.tertiary} />
              ) : (
                <Text style={styles.milestoneLevel}>{m.level}</Text>
              )}
            </View>

            {/* Card */}
            <Card
              border
              shadow="sm"
              style={[
                styles.milestoneCard,
                m.status === 'current' ? styles.milestoneCardCurrent : null,
              ]}
              padding={space.md}
            >
              <View style={styles.milestoneCardInner}>
                <View style={styles.milestoneCardText}>
                  <Text variant="caption" color={colors.text.secondary}>
                    Nível {m.level} · {m.title}
                  </Text>
                  <Text variant="label" color={colors.text.primary}>{m.reward}</Text>
                </View>
                <View style={[
                  styles.rewardIcon,
                  m.status === 'locked'
                    ? styles.rewardIconLocked
                    : styles.rewardIconActive,
                ]}>
                  <Ionicons
                    name={m.status === 'locked' ? 'lock-closed-outline' : 'gift-outline'}
                    size={22}
                    color={m.status === 'locked' ? colors.text.tertiary : colors.accent}
                  />
                </View>
              </View>
            </Card>
          </View>
        ))}
      </View>
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Level card ──────────────────────────────────────────────────────────────
  levelCard: {
    borderRadius: radius['2xl'],
    padding: space.lg,
    alignItems: 'center',
    gap: space.sm,
    overflow: 'hidden',
    ...({
      shadowColor: colors.primary,
      shadowOpacity: 0.30,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    } as object),
  },
  levelCircleOuter: {
    position: 'relative',
    marginBottom: space.xs,
  },
  levelCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.40)',
  },
  levelStar: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  levelNumber: {
    fontFamily: fontFamily.extraBold,
    fontSize: 40,
    color: '#fff',
    includeFontPadding: false,
  } as import('react-native').TextStyle,
  levelLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as import('react-native').TextStyle,
  levelName: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    color: '#fff',
  } as import('react-native').TextStyle,
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: space.xs,
  },
  xpLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#fff',
  } as import('react-native').TextStyle,
  xpLabelMuted: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.60)',
  } as import('react-native').TextStyle,
  xpBar: { width: '100%' },
  xpHint: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
  } as import('react-native').TextStyle,

  // ── Timeline ────────────────────────────────────────────────────────────────
  timeline: {
    paddingLeft: 16,
    position: 'relative',
    gap: space.sm,
  },
  timelineLine: {
    position: 'absolute',
    left: 36,
    top: 24,
    bottom: 24,
    width: 2,
    backgroundColor: colors.border.default,
    borderRadius: 1,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  milestoneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    flexShrink: 0,
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  circleUnlocked: { backgroundColor: colors.success },
  circleCurrent:  { backgroundColor: colors.primary },
  circleLocked:   { backgroundColor: colors.background.cardAlt, borderColor: colors.border.default },
  milestoneLevel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: '#fff',
  } as import('react-native').TextStyle,
  milestoneCard: { flex: 1 },
  milestoneCardCurrent: {
    backgroundColor: colors.primaryLight,
    borderColor: `${colors.primary}40`,
  },
  milestoneCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  milestoneCardText: { flex: 1, gap: 2 },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rewardIconActive: { backgroundColor: colors.accentLight },
  rewardIconLocked: { backgroundColor: colors.background.cardAlt },
});
