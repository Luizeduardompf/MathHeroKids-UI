/**
 * CorrectOverlay — tela "Acertou!"
 * Confetti burst, círculo spring pop-in, badge float-up, haptic.
 * Referência: design/exports/04-challenge.zip → correct-feedback.tsx
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Text } from '@/components/ui';
import { fontFamily } from '@/theme';

// ─── Confetti ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#2B52E5','#F5722A','#22C55E','#F59E0B',
  '#EF4444','#8B5CF6','#EC4899','#3AA564','#E0A52B',
];

type Piece = { px: number; py: number; color: string; size: number; aspect: number; rot: number };

function buildConfetti(n: number): Piece[] {
  let s = 42;
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    px:     r() * 100,
    py:     r() * 92,
    color:  COLORS[i % COLORS.length] ?? '#2B52E5',
    size:   6 + r() * 11,
    aspect: r() > 0.55 ? 1 : 1.8 + r() * 1.2,
    rot:    r() * 360,
  }));
}

const CONFETTI = buildConfetti(52);

// Confetti fica em zIndex 0 — o conteúdo principal fica em zIndex 1 acima
function ConfettiLayer({ opacity }: { opacity: SharedValue<number> }) {
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[s.confettiRoot, anim] as StyleProp<ViewStyle>}
      pointerEvents="none"
    >
      {CONFETTI.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left:   `${p.px}%` as unknown as number,
            top:    `${p.py}%` as unknown as number,
            width:  p.size,
            height: p.size * p.aspect,
            borderRadius: p.aspect <= 1.1 ? p.size / 2 : 3,
            backgroundColor: p.color,
            opacity: 0.9,
            transform: [{ rotate: `${p.rot}deg` as unknown as number }],
          }}
        />
      ))}
    </Animated.View>
  );
}

// ─── CorrectOverlay ───────────────────────────────────────────────────────────

export function CorrectOverlay({ xpGain = 10 }: { xpGain?: number }) {
  const confettiOpacity = useSharedValue(0);
  const circleScale     = useSharedValue(0);
  const badgeOpacity    = useSharedValue(0);
  const badgeY          = useSharedValue(16);
  const textOpacity     = useSharedValue(0);
  const textY           = useSharedValue(12);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    confettiOpacity.value = withTiming(1, { duration: 120 });
    circleScale.value     = withSpring(1, { damping: 9, stiffness: 240, mass: 0.9 });

    const t1 = setTimeout(() => {
      badgeOpacity.value = withTiming(1, { duration: 280 });
      badgeY.value       = withTiming(0, { duration: 380 });
    }, 130);
    const t2 = setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 320 });
      textY.value       = withTiming(0, { duration: 380 });
    }, 200);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circleAnim = useAnimatedStyle(() => ({ transform: [{ scale: circleScale.value }] }));
  const badgeAnim  = useAnimatedStyle(() => ({ opacity: badgeOpacity.value, transform: [{ translateY: badgeY.value }] }));
  const textAnim   = useAnimatedStyle(() => ({ opacity: textOpacity.value,  transform: [{ translateY: textY.value  }] }));

  return (
    <View style={s.root}>
      {/* zIndex 0: confetti atrás de tudo */}
      <ConfettiLayer opacity={confettiOpacity} />

      {/* zIndex 1: conteúdo principal na frente do confetti */}
      <View style={s.content}>

        {/* Área do círculo + badge: posicionamento relativo correcto */}
        <View style={s.circleArea}>
          {/* Badge: absolute no canto superior-direito da circleArea */}
          <Animated.View style={[s.badge, badgeAnim] as StyleProp<ViewStyle>}>
            <Text style={s.badgeText}>+{xpGain} XP</Text>
          </Animated.View>

          {/* Círculo com checkmark */}
          <Animated.View style={[s.circle, circleAnim] as StyleProp<ViewStyle>}>
            <Ionicons name="checkmark" size={68} color="#fff" />
          </Animated.View>
        </View>

        {/* Texto "Acertou!" — abaixo do círculo, fora do circleArea */}
        <Animated.View style={[{ marginTop: 28 }, textAnim] as StyleProp<ViewStyle>}>
          <Text style={s.label}>Acertou!</Text>
        </Animated.View>

      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = 130;

const s = StyleSheet.create({
  // Fundo verde menta, full-screen
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Confetti: absoluto full-screen, zIndex 0 (fica atrás do content)
  confettiRoot: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
  },

  // Conteúdo principal: zIndex 1 → aparece na frente do confetti
  content: {
    zIndex: 1,
    alignItems: 'center',
  },

  // circleArea: largura suficiente para conter o badge que transborda à direita
  // Largura = círculo (130) + margem para o badge (~60) = 190
  // O badge tem right:-44 e width ≈ 80, então precisa de pelo menos 50px extra
  circleArea: {
    width: CIRCLE_SIZE + 56,       // espaço para o badge não ser cortado
    height: CIRCLE_SIZE + 24,      // espaço para o badge não ser cortado em cima
    alignItems: 'center',
    justifyContent: 'flex-end',    // círculo alinha na base do circleArea
  },

  // Círculo verde — 130px, shadow para profundidade
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#166534',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  // Badge "+XP" — absolute no topo-direito do circleArea
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 2,
  },
  badgeText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },

  // "Acertou!" — verde escuro, grande
  label: {
    fontFamily: fontFamily.extraBold,
    fontSize: 36,
    color: '#166534',
    letterSpacing: -0.5,
  },
});
