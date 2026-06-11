/**
 * Progression screen — level, XP, milestones.
 *
 * Milestone data ported from design/exports/08-gamification-trophy-levels.zip
 * gamification-data.ts. Phase 3: wire to level_rewards table via TanStack Query.
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
import type { IoniconsName } from '@/components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThreshold(level: number) {
  return LEVEL_THRESHOLDS.find((t) => t.level === level);
}

function getXpRange(level: number) {
  const floor = getThreshold(level)?.xpRequired ?? 0;
  const ceil  = getThreshold(level + 1)?.xpRequired ?? floor + 1000;
  return { floor, ceil };
}

// ─── Milestone data (from gamification-data.ts in zip) ───────────────────────

type RewardType = 'frame' | 'outfit' | 'medal' | 'trophy_variant' | 'celebration';
type MilestoneStatus = 'unlocked' | 'current' | 'locked';

interface Milestone {
  level:        number;
  titleKey:     string;  // → levels.*
  rewardNameKey: string; // → progression.milestones.*
  rewardType:   RewardType;
}

const REWARD_ICONS: Record<RewardType, IoniconsName> = {
  frame:          'image-outline',
  outfit:         'shirt-outline',
  medal:          'ribbon-outline',
  trophy_variant: 'trophy-outline',
  celebration:    'sparkles-outline',
};

const MILESTONES: Milestone[] = [
  { level: 1,  titleKey: 'levels.explorador',        rewardNameKey: 'progression.milestones.initialAvatar',   rewardType: 'frame'          },
  { level: 5,  titleKey: 'levels.aventureiro',        rewardNameKey: 'progression.milestones.adventurerFrame', rewardType: 'frame'          },
  { level: 10, titleKey: 'levels.explorador_mestre',  rewardNameKey: 'progression.milestones.starsFrame',      rewardType: 'frame'          },
  { level: 11, titleKey: 'levels.aventureiro',        rewardNameKey: 'progression.milestones.magicCape',       rewardType: 'outfit'         },
  { level: 12, titleKey: 'levels.heroi',              rewardNameKey: 'progression.milestones.silverMedal',     rewardType: 'medal'          },
  { level: 13, titleKey: 'levels.mago_aprendiz',      rewardNameKey: 'progression.milestones.brilliantTrophy', rewardType: 'trophy_variant' },
  { level: 15, titleKey: 'levels.mestre_numeros',     rewardNameKey: 'progression.milestones.galacticHat',     rewardType: 'outfit'         },
  { level: 20, titleKey: 'levels.lenda_matematica',   rewardNameKey: 'progression.milestones.goldenFireworks', rewardType: 'celebration'    },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child  = useProfileStore(selectActiveChild);

  if (!child) return null;

  const { floor, ceil } = getXpRange(child.level);
  const progress    = ceil > floor ? (child.xp_total - floor) / (ceil - floor) : 1;
  const xpRemaining = Math.max(0, ceil - child.xp_total);
  const levelName   = t(getThreshold(child.level)?.nameKey ?? 'levels.explorador');

  const miloMsg = xpRemaining < 300
    ? t('progression.miloNearLevel')
    : t('progression.miloContinue');

  function getMilestoneStatus(m: Milestone): MilestoneStatus {
    if (m.level < child!.level)  return 'unlocked';
    if (m.level === child!.level) return 'current';
    return 'locked';
  }

  return (
    <AuthScreen
      title={t('progression.title')}
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
        {/* Level circle */}
        <View style={styles.levelCircleOuter}>
          <View style={styles.levelCircle}>
            <Text style={styles.levelNumber}>{child.level}</Text>
          </View>
          <View style={styles.levelStar}>
            <Ionicons name="star" size={22} color="#fff" />
          </View>
        </View>

        <Text style={styles.levelLabel}>{t('progression.currentLevel')}</Text>
        <Text style={styles.levelName}>{levelName}</Text>

        <View style={styles.xpRow}>
          <Text style={styles.xpText}>{child.xp_total.toLocaleString()} XP</Text>
          <Text style={styles.xpTextMuted}>{ceil.toLocaleString()}</Text>
        </View>
        <ProgressBar
          value={progress}
          color="rgba(255,255,255,0.95)"
          trackColor="rgba(255,255,255,0.25)"
          height={10}
          style={{ width: '100%' }}
        />
        <Text style={styles.xpHint}>
          {t('progression.xpToNext', { xp: xpRemaining.toLocaleString(), level: child.level + 1 })}
        </Text>
      </LinearGradient>

      {/* ── Milo ──────────────────────────────────────────────────────────── */}
      <MiloMessage message={miloMsg} variant="orange" />

      {/* ── Milestones ────────────────────────────────────────────────────── */}
      <Text variant="h3">{t('progression.milestonesTitle')}</Text>

      <View style={styles.timeline}>
        <View style={styles.timelineLine} />

        {MILESTONES.map((m) => {
          const status = getMilestoneStatus(m);
          const icon   = REWARD_ICONS[m.rewardType];
          return (
            <View key={m.level} style={styles.milestoneRow}>
              {/* Indicator circle */}
              <View style={[
                styles.indicator,
                status === 'unlocked' ? styles.indicatorUnlocked :
                status === 'current'  ? styles.indicatorCurrent  :
                                        styles.indicatorLocked,
              ]}>
                {status === 'unlocked' ? (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                ) : status === 'locked' ? (
                  <Ionicons name="lock-closed" size={13} color={colors.text.tertiary} />
                ) : (
                  <Text style={styles.indicatorLevel}>{m.level}</Text>
                )}
              </View>

              {/* Card */}
              <View style={[
                styles.milestoneCard,
                status === 'current' ? styles.milestoneCardCurrent : null,
              ]}>
                <View style={styles.milestoneCardInner}>
                  <View style={styles.milestoneCardTexts}>
                    <Text variant="caption" color={colors.text.secondary}>
                      {t('common.level', { level: m.level })} · {t(m.titleKey)}
                    </Text>
                    <Text variant="label">{t(m.rewardNameKey)}</Text>
                  </View>
                  <View style={[
                    styles.rewardIcon,
                    status === 'locked' ? styles.rewardIconLocked : styles.rewardIconActive,
                  ]}>
                    <Ionicons
                      name={icon}
                      size={22}
                      color={status === 'locked' ? colors.text.tertiary : colors.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </AuthScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Level card ──────────────────────────────────────────────────────────────
  levelCard: {
    borderRadius: radius['2xl'],
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
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
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.35)',
    ...({
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    } as object),
  },
  levelStar: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  levelNumber: {
    fontFamily: fontFamily.extraBold,
    fontSize: 48,
    color: '#1A1F36',   // dark on gold — matches design exactly
    lineHeight: 56,
    includeFontPadding: false,
  } as import('react-native').TextStyle,
  levelLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as import('react-native').TextStyle,
  levelName: {
    fontFamily: fontFamily.extraBold,
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
  } as import('react-native').TextStyle,
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: space.xs,
  },
  xpText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#fff',
  } as import('react-native').TextStyle,
  xpTextMuted: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
  } as import('react-native').TextStyle,
  xpHint: {
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    marginTop: 4,
  } as import('react-native').TextStyle,

  // ── Timeline ────────────────────────────────────────────────────────────────
  timeline: { position: 'relative', gap: space.sm, paddingLeft: 16 },
  timelineLine: {
    position: 'absolute',
    left: 36,
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: colors.border.default,
    borderRadius: 1,
  },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  indicator: {
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
  indicatorUnlocked: { backgroundColor: colors.success },
  indicatorCurrent:  { backgroundColor: colors.primary },
  indicatorLocked:   {
    backgroundColor: colors.background.cardAlt,
    borderColor: colors.border.default,
  },
  indicatorLevel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: '#fff',
    lineHeight: 18,
  } as import('react-native').TextStyle,

  milestoneCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: space.md,
    ...({
      shadowColor: '#1A1F36',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    } as object),
  },
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
  milestoneCardTexts: { flex: 1, gap: 3 },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rewardIconActive: { backgroundColor: colors.accentLight },
  rewardIconLocked: { backgroundColor: colors.background.primary },
});
