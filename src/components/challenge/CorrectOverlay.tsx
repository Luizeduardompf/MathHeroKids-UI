/**
 * CorrectOverlay — tela "Acertou!"
 *
 * Layout: root (absoluto, full-screen verde) → conteúdo centrado (flex col)
 * + confetti por ÚLTIMO no render = on top do conteúdo (comportamento intencional do design).
 *
 * Regra RN: nada de zIndex em Views que têm filhos animados — cria stacking
 * context e força overflow:hidden, cortando os filhos. Usamos render order.
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
import { Audio } from 'expo-av';

import { Text } from '@/components/ui';
import { fontFamily } from '@/theme';

// ─── Som de sucesso ───────────────────────────────────────────────────────────
// WAV sintetizado (C5→E5→G5, 450ms) gerado em build-time — sem rede, sem arquivo externo
const SUCCESS_SOUND = require('../../../assets/sounds/success.wav') as number;

// ─── Confetti ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#2B52E5','#F5722A','#22C55E','#F59E0B',
  '#EF4444','#8B5CF6','#EC4899','#3AA564','#E0A52B',
];

type Piece = { px: number; py: number; color: string; w: number; h: number; rot: number };

function buildConfetti(n: number): Piece[] {
  let s = 99; // seed diferente do anterior para evitar peças centradas no texto
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    px:  r() * 100,
    py:  r() * 90,
    color: COLORS[i % COLORS.length] ?? '#2B52E5',
    w:   6 + r() * 8,          // max 14px — peças menores deixam texto legível
    h:   6 + r() * 14,
    rot: r() * 360,
  }));
}

const CONFETTI = buildConfetti(50);

// Confetti é renderizado POR ÚLTIMO no JSX → fica visualmente por cima (render order)
// pointerEvents="none" garante que não bloqueia toques
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

    // Haptic + som em paralelo (best-effort: erros silenciados)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(SUCCESS_SOUND, { volume: 0.7 });
        await sound.playAsync();
        // Libera memória após tocar (~600ms)
        setTimeout(() => void sound.unloadAsync(), 600);
      } catch { /* silent: dispositivo sem áudio ou permissão negada */ }
    })();

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

      {/* ── 1. Conteúdo (circle + badge + texto) ─────────────────────────────
          Renderizado ANTES do confetti → fica atrás no stack de render.
          SEM zIndex para não criar stacking context / overflow:hidden.      */}
      <View style={s.centerCol}>

        {/* Badge + círculo numa linha horizontal centrada com posição relativa */}
        <View style={s.row}>
          {/* Espaço à esquerda para equilibrar o badge que vai à direita */}
          <View style={s.badgeSpacer} />

          {/* Círculo verde */}
          <Animated.View style={[s.circle, circleAnim] as StyleProp<ViewStyle>}>
            <Ionicons name="checkmark" size={68} color="#fff" />
          </Animated.View>

          {/* Badge à direita do círculo, alinhado ao topo */}
          <View style={s.badgeCol}>
            <Animated.View style={[s.badge, badgeAnim] as StyleProp<ViewStyle>}>
              <Text style={s.badgeText}>+{xpGain} XP</Text>
            </Animated.View>
          </View>
        </View>

        {/* Texto "Acertou!" — separado abaixo do row, sem marginTop animado
            para evitar clip. O translateY do textAnim é para cima (−14→0),
            então o texto nunca sai fora da sua caixa de layout. */}
        <Animated.View style={[s.labelWrap, textAnim] as StyleProp<ViewStyle>}>
          <Text style={s.label}>Acertou!</Text>
        </Animated.View>

      </View>

      {/* ── 2. Confetti (renderizado POR ÚLTIMO = por cima do conteúdo) ──────
          Decorativo; peças menores para não obscurecer todo o texto.        */}
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

  // Coluna central: sem overflow, sem zIndex, sem position
  centerCol: {
    alignItems: 'center',
    gap: 24,  // espaço entre o row e o texto
  },

  // Row: badge + círculo lado a lado, centrados
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',  // badge alinha pelo topo
  },

  // Espaço espelho do badge (para o círculo ficar visualmente centrado)
  badgeSpacer: {
    width: 70,
    height: 1,
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

  // Coluna à direita do círculo — contém o badge alinhado ao topo
  badgeCol: {
    width: 70,
    alignItems: 'flex-start',
    paddingTop: 4,  // desce um pouco para ficar mais centrado visualmente
  },

  badge: {
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
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

  // Wrapper do label: sem overflow, sem posição absoluta
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
