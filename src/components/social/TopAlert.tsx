/**
 * TopAlert — toast global para nova mensagem de amigo / pedido de amizade.
 *
 * Desliza do topo com efeito de mola, fica visível por 5s e desaparece
 * sozinho, ou navega + desaparece de imediato se tocado.
 *
 * Montado uma única vez em app/(app)/_layout.tsx, por cima da Stack.
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useSocialAlertStore, type SocialAlertKind } from '@/stores/social-alert.store';
import { colors, fontFamily, radius, shadows } from '@/theme';

const AUTO_DISMISS_MS = 5000;
const SPRING = { damping: 12, stiffness: 260, mass: 0.8 };
const HIDDEN_Y = -160;

const ALERT_ICONS: Record<SocialAlertKind, React.ComponentProps<typeof Ionicons>['name']> = {
  message: 'chatbubble',
  friend_request: 'person-add',
  ranking_overtaken: 'trending-down',
  ranking_overtook: 'trophy',
};

export function TopAlert(): React.JSX.Element {
  const current = useSocialAlertStore((s) => s.current);
  const dismiss = useSocialAlertStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(HIDDEN_Y);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (current) {
      translateY.value = withSpring(0, SPRING);
      timerRef.current = setTimeout(() => {
        translateY.value = withTiming(HIDDEN_Y, { duration: 220 });
        setTimeout(dismiss, 220);
      }, AUTO_DISMISS_MS);
    } else {
      translateY.value = withTiming(HIDDEN_Y, { duration: 200 });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handlePress = () => {
    if (!current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    current.onPress();
    translateY.value = withTiming(HIDDEN_Y, { duration: 180 });
    setTimeout(dismiss, 180);
  };

  return (
    <View
      style={[styles.wrapper, { top: insets.top + 8 }]}
      pointerEvents={current ? 'box-none' : 'none'}
    >
      <Animated.View style={[styles.card, animStyle] as StyleProp<ViewStyle>}>
        {current && (
          <Pressable onPress={handlePress} style={styles.pressable} hitSlop={4}>
            <Avatar avatarId={current.avatarId} displayName={current.avatarDisplayName} size="sm" />
            <View style={styles.textBlock}>
              <View style={styles.titleRow}>
                <Ionicons
                  name={ALERT_ICONS[current.kind]}
                  size={13}
                  color={colors.accent}
                />
                <Text style={styles.title} numberOfLines={1}>
                  {current.title}
                </Text>
              </View>
              {!!current.subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {current.subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 100,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,
    color: colors.text.primary,
    flexShrink: 1,
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
    color: colors.text.secondary,
  },
});
