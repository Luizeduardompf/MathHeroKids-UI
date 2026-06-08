/**
 * CorrectOverlay — tela "Acertou!"
 *
 * Confetti burst, círculo spring pop-in, badge +XP float-up, haptic feedback.
 *
 * Nota sobre som: expo-av requer dev client (não roda em Expo Go sem prebuild).
 * O feedback de áudio será adicionado após o EAS build. Por agora: haptic.
 *
 * Layout sem zIndex em Views com filhos animados — em RN isso força
 * overflow:hidden e corta os filhos. Usamos render order puro:
 *   conteúdo primeiro (atrás) → confetti por último (frente).
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

type Piece = { px: number; py: number; color: string; w: number; h: number; rot: number };

function buildConfetti(n: number): Piece[] {
  let s = 99;
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    px:    r() * 100,
    py:    r() * 90,
    color: COLORS[i % COLORS.length] ?? '#2B52E5',
    w:     6 + r() * 8,
    h:     6 + r() * 14,
    rot:   r() * 360,
  }));
}

const CONFETTI = buildConfetti(50);

function ConfettiLayer({ opacity }: { opacity: SharedValue<number> }) {
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[s.confettiAbs, anim] as StyleProp<ViewStyle>}
      pointerEvents="none"
    >
      {CONFETTI.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left:            `${p.px}%` as unknown as number,
            top:             `${p.py}%` as unknown as number,
            width:           p.w,
            height:          p.h,
            borderRadius:    p.h / p.w <= 1.3 ? p.w / 2 : 3,
            backgroundColor: p.color,
            opacity:         0.9,
            transform:       [{ rotate: `${p.rot}deg` as unknown as number }],
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
  const textY           = useSharedValue(14);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // Haptic de sucesso (funciona em Expo Go)
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

  const circleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));
  const badgeAnim = useAnimatedStyle(() => ({
    opacity:   badgeOpacity.value,
    transform: [{ translateY: badgeY.value }],
  }));
  const textAnim = useAnimatedStyle(() => ({
    opacity:   textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  return (
    <View style={s.root}>

      {/* 1. Conteúdo — renderizado antes do confetti (fica atrás) */}
      <View style={s.centerCol}>

        <View style={s.row}>
          {/* Spacer espelho para centrar o círculo visualmente */}
          <View style={s.side} />

          {/* Círculo verde com checkmark */}
          <Animated.View style={[s.circle, circleAnim] as StyleProp<ViewStyle>}>
            <Ionicons name="checkmark" size={68} color="#fff" />
          </Animated.View>

          {/* Badge à direita, alinhado ao topo */}
          <View style={s.side}>
            <Animated.View style={[s.badge, badgeAnim] as StyleProp<ViewStyle>}>
              <Text style={s.badgeText}>+{xpGain} XP</Text>
            </Animated.View>
          </View>
        </View>

        {/* "Acertou!" abaixo do row — gap via s.centerCol */}
        <Animated.View style={[s.labelWrap, textAnim] as StyleProp<ViewStyle>}>
          <Text style={s.label}>Acertou!</Text>
        </Animated.View>

      </View>

      {/* 2. Confetti — renderizado por último (frente) */}
      <ConfettiLayer opacity={confettiOpacity} />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CIRCLE = 130;

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiAbs: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  centerCol: {
    alignItems: 'center',
    gap: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Cada lado = 70px para o círculo ficar centrado e ter espaço pro badge
  side: {
    width: 70,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#166534',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  badge: {
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  badgeText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
  },
  labelWrap: {
    alignItems: 'center',
  },
  label: {
    fontFamily: fontFamily.extraBold,
    fontSize: 36,
    color: '#166534',
    letterSpacing: -0.5,
  },
});
