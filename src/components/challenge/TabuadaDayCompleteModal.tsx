/**
 * TabuadaDayCompleteModal — celebração ao fechar o dia da Tabuada Semanal Premiada (5 blocos
 * + desafio diário normal, ver backend/functions/_shared/tabuada.ts:tryCompleteDay). Reusada
 * em app/(app)/tabuada-semanal/play/[block].tsx e app/(app)/challenge/[date].tsx — o dia pode
 * fechar por qualquer um dos dois caminhos, consoante a ordem em que a criança os termina.
 * Mesmo padrão visual do LevelUpModal (spring-in sobre overlay escuro), mas tema dourado e
 * sempre a falar de dinheiro/recompensa, nunca XP.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// @ts-expect-error RN 0.85 quirk — Modal present at runtime
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
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
import { centsToEuroLabel } from '@/constants/config';
import { playSound } from '@/services/sound.service';

interface Props {
  visible: boolean;
  earnedCents: number;
  medalEarned: boolean;
  parentWillBeNotified: boolean;
  onContinue: () => void;
}

export function TabuadaDayCompleteModal({ visible, earnedCents, medalEarned, parentWillBeNotified, onContinue }: Props) {
  const { t } = useTranslation();

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.5;
      opacity.value = 0;
      wobble.value = 0;
      return;
    }
    playSound('trophy');
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    wobble.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300 }),
          withTiming(6, { duration: 300 }),
          withTiming(0, { duration: 200 }),
        ),
        2,
        false,
      ),
    );
  }, [visible, scale, opacity, wobble]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: S[6],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value}deg` as unknown as number }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onContinue}>
      <Animated.View style={overlayStyle}>
        <Animated.View style={cardStyle}>
          <View style={styles.card}>
            <Animated.View style={[styles.badge, badgeStyle] as StyleProp<ViewStyle>}>
              <Ionicons name={medalEarned ? 'medal' : 'trophy'} size={44} color="#fff" />
            </Animated.View>

            <Text style={styles.title}>
              {t(medalEarned ? 'tabuadaSemanal.dayCompleteModal.titleMedal' : 'tabuadaSemanal.dayCompleteModal.titleDay')}
            </Text>
            <Text style={styles.subtitle}>
              {t(medalEarned ? 'tabuadaSemanal.dayCompleteModal.subtitleMedal' : 'tabuadaSemanal.dayCompleteModal.subtitleDay')}
            </Text>

            {earnedCents > 0 && (
              <View style={styles.earnedBadge}>
                <Ionicons name="cash" size={18} color="#7A5A00" />
                <Text style={styles.earnedText}>{centsToEuroLabel(earnedCents)}</Text>
              </View>
            )}

            {parentWillBeNotified && (
              <View style={styles.parentNote}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={styles.parentNoteText}>
                  {t('tabuadaSemanal.dayCompleteModal.parentNotified')}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }: { pressed: boolean }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={onContinue}
            >
              <Text style={styles.btnText}>{t('common.continue')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const S = spacing;

const styles = StyleSheet.create({
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
  badge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.trophy.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S[1],
    borderWidth: 3,
    borderColor: '#B8860B',
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  earnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[1],
    backgroundColor: colors.trophy.goldLight,
    borderRadius: radius.full,
    paddingHorizontal: S[4],
    paddingVertical: S[1],
  },
  earnedText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
    color: '#7A5A00',
  },
  parentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: S[2],
    backgroundColor: '#F0FDF4',
    borderRadius: radius.lg,
    padding: S[3],
    width: '100%',
  },
  parentNoteText: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: '#166534',
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
