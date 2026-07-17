/**
 * LevelUpModal — celebração animada de subida de nível.
 * Disparado na challenge screen quando result.level_up === true.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// @ts-expect-error RN 0.85 quirk — Modal present at runtime
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated named-export quirks
import { withDelay, withRepeat, withSequence } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { colors, fontFamily, radius, spacing } from '@/theme';
import type { LevelReward } from '@/types/database.types';
import { playSound } from '@/services/sound.service';

// ─── Tier emoji helper ────────────────────────────────────────────────────────

function getLevelEmoji(level: number): string {
  if (level >= 50) return '🌌';
  if (level >= 20) return '⭐';
  if (level >= 15) return '🔮';
  if (level >= 12) return '🧙';
  if (level >= 10) return '🦸';
  if (level >= 5)  return '⚔️';
  return '🌟';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  newLevel: number;
  xpEarned: number;
  unlockedReward?: LevelReward | null;
  onContinue: () => void;
}

export function LevelUpModal({ visible, newLevel, xpEarned, unlockedReward, onContinue }: Props) {
  const { t } = useTranslation();

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.5;
      opacity.value = 0;
      translateY.value = 0;
      return;
    }
    playSound('levelUp');
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    // bounce gentle após entrada
    translateY.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 350 }),
          withTiming(0, { duration: 350 }),
        ),
        3,
        false,
      ),
    );
  }, [visible, scale, opacity, translateY]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: S[6],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const emoji = getLevelEmoji(newLevel);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onContinue}>
      <Animated.View style={overlayStyle}>
        <Animated.View style={cardStyle}>
          <View style={styles.card}>
          {/* Badge do nível */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelEmoji}>{emoji}</Text>
            <Text style={styles.levelNumber}>{newLevel}</Text>
          </View>

          <Text style={styles.title}>{t('levelUp.title')}</Text>
          <Text style={styles.reached}>{t('levelUp.reached', { level: newLevel })}</Text>

          <View style={styles.xpBadge}>
            <Ionicons name="flash" size={16} color={colors.trophy.gold} />
            <Text style={styles.xpText}>+{xpEarned} XP</Text>
          </View>

          {unlockedReward && (
            <View style={styles.rewardBox}>
              <Text style={styles.rewardLabel}>{t('levelUp.reward')}</Text>
              <Text style={styles.rewardName}>{t(unlockedReward.name_key)}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }: { pressed: boolean }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={onContinue}
          >
            <Text style={styles.btnText}>{t('levelUp.continue')}</Text>
          </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = spacing;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S[6],
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    padding: S[6],
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    gap: S[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  levelBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S[1],
    borderWidth: 3,
    borderColor: colors.primary,
  },
  levelEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  levelNumber: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    color: colors.primary,
    lineHeight: 26,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  reached: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[1],
    backgroundColor: colors.trophy.goldLight,
    borderRadius: radius.full,
    paddingHorizontal: S[4],
    paddingVertical: S[1],
  },
  xpText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    color: colors.trophy.gold,
  },
  rewardBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: S[3],
    alignItems: 'center',
    width: '100%',
    gap: S[1],
  },
  rewardLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rewardName: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: colors.primary,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: S[8],
    paddingVertical: S[3],
    marginTop: S[1],
  },
  btnPressed: { opacity: 0.8 },
  btnText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    color: '#fff',
  },
});
