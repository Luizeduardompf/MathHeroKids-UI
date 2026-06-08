/**
 * CorrectOverlay — tela "Acertou!"
 *
 * - Confetti: partículas nascem acima da tela e caem com withTiming
 * - Círculo: spring pop-in
 * - Badge +XP: posição absoluta no bordo superior-direito do círculo,
 *              anima de cima para baixo (drop-in)
 * - "Acertou!": fade + slide-up
 * - Som: expo-av → assets/sounds/success.wav
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated Easing named-export quirk in this TS config
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fontFamily } from '@/theme';

// ─── Sound helper ─────────────────────────────────────────────────────────────
// expo-av não está disponível no Expo Go (native module removido).
// Usa `isAvailableAsync` para verificar antes de tentar reproduzir.

// TODO: reativar após `npx expo install expo-av && pod install && npx expo run:ios`
// async function playSuccessSound() { ... }

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCLE  = 130;
const BADGE_W = 90;
const BADGE_H = 36;

// Badge sobreposto: bordo superior-direito do círculo
const BADGE_RIGHT = -(BADGE_W / 2 - 18);
const BADGE_TOP   = -(BADGE_H / 2 + 6);

// ─── Confetti ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#2B52E5','#F5722A','#22C55E','#F59E0B',
  '#EF4444','#8B5CF6','#EC4899','#3AA564',
];

type Piece = {
  startX: number;   // % da largura da tela
  startY: number;   // px negativo — acima da tela
  color:  string;
  w:      number;
  h:      number;
  delay:  number;   // ms antes de iniciar
  dur:    number;   // ms para percorrer a tela
};

function buildConfetti(n: number): Piece[] {
  let s = 42;
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    startX: r() * 95,
    startY: -(10 + r() * 80),
    color:  COLORS[i % COLORS.length] ?? '#2B52E5',
    w:      6  + r() * 8,
    h:      8  + r() * 12,
    delay:  r() * 320,
    dur:    1500 + r() * 900,
  }));
}

const CONFETTI = buildConfetti(60);

// Componente por peça — hooks usados correctamente fora de .map()
function ConfettoPiece({ piece, fallDistance }: { piece: Piece; fallDistance: number }) {
  const y   = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    const run = () => {
      y.value   = withTiming(fallDistance, { duration: piece.dur, easing: Easing.linear });
      rot.value = withTiming(720, { duration: piece.dur, easing: Easing.linear });
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (piece.delay > 0) {
      timer = setTimeout(run, piece.delay);
    } else {
      run();
    }
    return () => { if (timer !== undefined) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { rotate: `${rot.value}deg` as unknown as number },
    ],
  }));

  const isRound = piece.h / piece.w <= 1.4;

  return (
    <Animated.View
      style={[
        {
          position:        'absolute',
          left:            `${piece.startX}%` as unknown as number,
          top:             piece.startY,
          width:           piece.w,
          height:          piece.h,
          borderRadius:    isRound ? piece.w / 2 : 3,
          backgroundColor: piece.color,
          opacity:         0.9,
        },
        anim,
      ] as StyleProp<ViewStyle>}
    />
  );
}

function ConfettiLayer({ fallDistance }: { fallDistance: number }) {
  return (
    <View style={s.confettiAbs} pointerEvents="none">
      {CONFETTI.map((piece, i) => (
        <ConfettoPiece key={i} piece={piece} fallDistance={fallDistance} />
      ))}
    </View>
  );
}

// ─── CorrectOverlay ───────────────────────────────────────────────────────────

export function CorrectOverlay({ xpGain = 10 }: { xpGain?: number }) {
  const circleScale  = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const badgeY       = useSharedValue(-20);
  const textOpacity  = useSharedValue(0);
  const textY        = useSharedValue(14);
  const fired        = useRef(false);

  // Calcula distância de queda depois de montar (usa dimensões reais via onLayout seria ideal,
  // mas 900px cobre qualquer iPhone sem precisar de Dimensions que tem quirk TS)
  const FALL = 900;

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // void playSuccessSound(); // reativar após expo install expo-av + pod install

    circleScale.value = withSpring(1, { damping: 9, stiffness: 240, mass: 0.9 });

    const t1 = setTimeout(() => {
      badgeOpacity.value = withTiming(1, { duration: 260 });
      badgeY.value       = withTiming(0, {
        duration: 360,
        easing: Easing.out(Easing.back(1.6)),
      });
    }, 100);

    const t2 = setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 300 });
      textY.value       = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
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

      {/* 1. Conteúdo — atrás do confetti */}
      <View style={s.centerCol}>

        {/* Círculo + badge absoluto */}
        <View style={s.circleWrapper}>
          <Animated.View style={[s.circle, circleAnim] as StyleProp<ViewStyle>}>
            <Ionicons name="checkmark" size={72} color="#fff" />
          </Animated.View>

          <Animated.View style={[s.badge, badgeAnim] as StyleProp<ViewStyle>}>
            <RNText style={s.badgeText} numberOfLines={1}>
              +{xpGain} XP
            </RNText>
          </Animated.View>
        </View>

        {/* "Acertou!" */}
        <Animated.View style={textAnim as StyleProp<ViewStyle>}>
          <RNText style={s.label} numberOfLines={1}>
            Acertou!
          </RNText>
        </Animated.View>

      </View>

      {/* 2. Confetti — frente */}
      <ConfettiLayer fallDistance={FALL} />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiAbs: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },

  centerCol: {
    alignItems: 'center',
    gap: 28,
  },

  circleWrapper: {
    width:    CIRCLE,
    height:   CIRCLE,
    // overflow visible (padrão) para o badge sobreposto não ser cortado
  },
  circle: {
    width:           CIRCLE,
    height:          CIRCLE,
    borderRadius:    CIRCLE / 2,
    backgroundColor: '#22C55E',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#166534',
    shadowOpacity:   0.25,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       8,
  },

  badge: {
    position:        'absolute',
    right:           BADGE_RIGHT,
    top:             BADGE_TOP,
    width:           BADGE_W,
    height:          BADGE_H,
    backgroundColor: '#F59E0B',
    borderRadius:    BADGE_H / 2,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 10,
    shadowColor:     '#92400e',
    shadowOpacity:   0.2,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },
  badgeText: {
    fontFamily:         fontFamily.extraBold,
    fontSize:           15,
    color:              '#fff',
    letterSpacing:      0.3,
    includeFontPadding: false,
  },

  label: {
    fontFamily:         fontFamily.extraBold,
    fontSize:           38,
    color:              '#166534',
    letterSpacing:      -0.5,
    includeFontPadding: false,
  },
});
