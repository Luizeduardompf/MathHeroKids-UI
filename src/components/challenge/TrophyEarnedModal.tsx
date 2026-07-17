/**
 * TrophyEarnedModal — mostra troféus/achievements ganhos após o challenge.
 * Suporta fila: avança para o próximo item ao pressionar.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
// @ts-expect-error RN 0.85 quirk — Modal present at runtime
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { colors, fontFamily, radius, spacing } from '@/theme';
import type { Achievement, Trophy } from '@/types/database.types';
import { playSound } from '@/services/sound.service';

type Item = { type: 'trophy'; data: Trophy } | { type: 'achievement'; data: Achievement };

interface Props {
  items: Item[];
  onDone: () => void;
}

export function TrophyEarnedModal({ items, onDone }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  const visible = items.length > 0;

  function animateIn() {
    scale.value = 0.5;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    playSound('trophy');
  }

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      return;
    }
    animateIn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleNext() {
    const next = index + 1;
    if (next >= items.length) {
      opacity.value = withTiming(0, { duration: 150 });
      setTimeout(onDone, 160);
    } else {
      opacity.value = withTiming(0, { duration: 120 });
      setTimeout(() => {
        setIndex(next);
        animateIn();
      }, 130);
    }
  }

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: S[6],
  }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  const current = items[index];
  if (!current) return null;

  const isTrophy = current.type === 'trophy';
  const accentColor = isTrophy ? colors.trophy.gold : colors.primary;
  const accentLight = isTrophy ? colors.trophy.goldLight : colors.primaryLight;
  const iconName: 'trophy' | 'ribbon' = isTrophy ? 'trophy' : 'ribbon';
  const sectionLabel = isTrophy ? t('trophies.title') : t('achievements.title');
  const counter = items.length > 1 ? ` (${index + 1}/${items.length})` : '';
  const isLast = index + 1 >= items.length;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleNext}>
      <Animated.View style={overlayStyle}>
        <Animated.View style={cardStyle}>
          <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: accentLight, borderColor: accentColor }]}>
            <Ionicons name={iconName} size={40} color={accentColor} />
          </View>

          <Text style={[styles.section, { color: accentColor }]}>
            {sectionLabel.toUpperCase()}{counter}
          </Text>
          <Text style={styles.name}>{t(current.data.name_key)}</Text>
          <Text style={styles.desc}>{t(current.data.description_key)}</Text>

          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.btn,
              { backgroundColor: accentColor },
              pressed && styles.btnPressed,
            ]}
            onPress={handleNext}
          >
            <Text style={styles.btnText}>
              {isLast ? t('common.done') : t('common.continue')}
            </Text>
          </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

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
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: S[1],
  },
  section: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  name: {
    fontFamily: fontFamily.extraBold,
    fontSize: 20,
    color: colors.text.primary,
    textAlign: 'center',
  },
  desc: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
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
