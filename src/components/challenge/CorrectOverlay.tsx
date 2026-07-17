/**
 * CorrectOverlay — tela "Acertou!"
 *
 * Milo (milo-celebrate.png) é o herói da comemoração — sem arte nova, a pose
 * única ganha vida através de uma coreografia de transforms inspirada em
 * frames de animação de jogos (pop → salto duplo → giro com rasto de brilho →
 * sunburst + shine sweep → estrela companheira flutuante):
 *
 *   0ms    — pop-in elástico (spring overshoot)
 *  100ms   — badge +XP dropa com overshoot
 *  140ms   — selo verde de "certo" aparece
 *  200ms   — título + botão "Continuar" (não bloqueia o avanço da criança)
 *  260ms   — salto duplo com squash & stretch (haptic leve no 1º pouso)
 *  480ms   — badge +XP começa a "respirar" (shimmer contínuo)
 *  620ms   — giro 360° com rasto de sparkles ao redor
 *  980ms   — sunburst atrás do Milo + shine sweep a atravessar o círculo
 * 1300ms   — estrela companheira aparece e flutua/pisca em loop
 *
 * Confetti cai do topo com sway lateral (não é queda reta). Glow + shockwave
 * rings dão o "pop" de luz no impacto. Som: expo-audio → correct.mp3.
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
// @ts-expect-error TS6/RN0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated Easing named-export quirk in this TS config
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withDelay named-export quirk in this TS config
import { withDelay } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withRepeat named-export quirk in this TS config
import { withRepeat } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withSequence named-export quirk in this TS config
import { withSequence } from 'react-native-reanimated'; // eslint-disable-line
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fontFamily } from '@/theme';
import { playSound } from '@/services/sound.service';

const MILO_CELEBRATE = require('../../../assets/images/milo-celebrate.png') as number;

// ─── Constants ────────────────────────────────────────────────────────────────

const MILO_CIRCLE  = 152;
const BADGE_W      = 90;
const BADGE_H      = 36;
const CHECK_BADGE  = 44;
const GLOW         = MILO_CIRCLE * 2.3;
const RAYS_SIZE     = MILO_CIRCLE * 2.0;

// Badge sobreposto: bordo superior-direito do círculo
const BADGE_RIGHT = -(BADGE_W / 2 - 20);
const BADGE_TOP   = -(BADGE_H / 2 + 4);

const PALETTE = [
  '#2B52E5', '#F5722A', '#22C55E', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#FBBF24', '#3AA564',
];

// ─── Confetti (queda do topo, com sway lateral) ────────────────────────────────

type ConfettiPiece = {
  startX:  number;   // % da largura da tela
  startY:  number;   // px negativo — acima da tela
  color:   string;
  w:       number;
  h:       number;
  delay:   number;
  dur:     number;
  swayAmp: number;
  swayDur: number;
  kind:    'shape' | 'sparkle';
};

function buildConfetti(n: number): ConfettiPiece[] {
  let s = 42;
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => ({
    startX:  r() * 95,
    startY:  -(10 + r() * 80),
    color:   PALETTE[i % PALETTE.length] ?? '#2B52E5',
    w:       6 + r() * 8,
    h:       8 + r() * 12,
    delay:   r() * 320,
    dur:     1500 + r() * 900,
    swayAmp: 8 + r() * 14,
    swayDur: 500 + r() * 500,
    kind:    r() < 0.16 ? 'sparkle' : 'shape',
  }));
}

const CONFETTI = buildConfetti(64);

function ConfettoPiece({ piece, fallDistance }: { piece: ConfettiPiece; fallDistance: number }) {
  const y       = useSharedValue(0);
  const rot     = useSharedValue(0);
  const opacity = useSharedValue(1);
  const sway    = useSharedValue(0.5);

  useEffect(() => {
    const run = () => {
      y.value    = withTiming(fallDistance, { duration: piece.dur, easing: Easing.linear });
      rot.value  = withTiming(720, { duration: piece.dur, easing: Easing.linear });
      sway.value = withRepeat(
        withTiming(-0.5, { duration: piece.swayDur, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      const fadeStart = Math.round(piece.dur * 0.65);
      const fadeDur    = piece.dur - fadeStart;
      opacity.value    = withDelay(fadeStart, withTiming(0, { duration: fadeDur, easing: Easing.linear }));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (piece.delay > 0) { timer = setTimeout(run, piece.delay); } else { run(); }
    return () => { if (timer !== undefined) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { translateX: sway.value * piece.swayAmp },
      { rotate: `${rot.value}deg` as unknown as number },
    ],
  }));

  const isRound = piece.h / piece.w <= 1.4;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left:     `${piece.startX}%` as unknown as number,
          top:      piece.startY,
        },
        anim,
      ] as StyleProp<ViewStyle>}
    >
      {piece.kind === 'sparkle'
        ? <Ionicons name="sparkles" size={piece.w + 6} color={piece.color} />
        : (
          <View
            style={{
              width:           piece.w,
              height:          piece.h,
              borderRadius:    isRound ? piece.w / 2 : 3,
              backgroundColor: piece.color,
              opacity:         0.9,
            }}
          />
        )}
    </Animated.View>
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

// ─── Glow pulse — flash radial suave atrás do Milo ─────────────────────────────

function GlowPulse() {
  const scale   = useSharedValue(0.4);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    scale.value   = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    opacity.value = withDelay(80, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[glow.base, anim] as StyleProp<ViewStyle>} pointerEvents="none" />;
}

const glow = StyleSheet.create({
  base: {
    position:        'absolute',
    top:             (MILO_CIRCLE - GLOW) / 2,
    left:            (MILO_CIRCLE - GLOW) / 2,
    width:           GLOW,
    height:          GLOW,
    borderRadius:    GLOW / 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});

// ─── Shockwave ring — anel expandindo e desvanecendo ───────────────────────────

function ShockwaveRing({ delay }: { delay: number }) {
  const scale   = useSharedValue(0.7);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value   = withDelay(delay, withTiming(2.3, { duration: 680, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(delay, withTiming(0,   { duration: 680, easing: Easing.out(Easing.quad) }));
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[ring.base, anim] as StyleProp<ViewStyle>} pointerEvents="none" />;
}

const ring = StyleSheet.create({
  base: {
    position:     'absolute',
    top:          0,
    left:         0,
    width:        MILO_CIRCLE,
    height:       MILO_CIRCLE,
    borderRadius: MILO_CIRCLE / 2,
    borderWidth:  4,
    borderColor:  '#fff',
  },
});

// ─── Sunburst rays — atrás do Milo, fade-in + rotação lenta contínua ──────────

function SunburstRays() {
  const opacity  = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    opacity.value  = withDelay(980, withTiming(0.4, { duration: 260 }));
    rotation.value = withDelay(980, withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    ));
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ rotate: `${rotation.value}deg` as unknown as number }],
  }));

  const NUM = 10;
  return (
    <Animated.View style={[rays.container, anim] as StyleProp<ViewStyle>} pointerEvents="none">
      {Array.from({ length: NUM }, (_, i) => (
        <View key={i} style={[rays.ray, { transform: [{ rotate: `${(i * 180) / NUM}deg` }] }]} />
      ))}
    </Animated.View>
  );
}

const rays = StyleSheet.create({
  container: {
    position:       'absolute',
    top:            (MILO_CIRCLE - RAYS_SIZE) / 2,
    left:           (MILO_CIRCLE - RAYS_SIZE) / 2,
    width:          RAYS_SIZE,
    height:         RAYS_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ray: {
    position:        'absolute',
    width:           3,
    height:          RAYS_SIZE,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

// ─── Shine sweep — brilho diagonal atravessando o círculo (reveal de jogo) ────

function ShineSweep({ startDelay }: { startDelay: number }) {
  const x       = useSharedValue(-MILO_CIRCLE);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(startDelay, withTiming(1, { duration: 60 }));
    x.value       = withDelay(startDelay, withTiming(MILO_CIRCLE * 1.3, { duration: 480, easing: Easing.out(Easing.cubic) }));
    const tOff = setTimeout(() => { opacity.value = withTiming(0, { duration: 160 }); }, startDelay + 380);
    return () => clearTimeout(tOff);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: x.value }, { rotate: '20deg' as unknown as number }],
  }));

  return (
    <Animated.View style={[shine.bar, anim] as StyleProp<ViewStyle>} pointerEvents="none">
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

const shine = StyleSheet.create({
  bar: {
    position: 'absolute',
    top:      -40,
    left:     MILO_CIRCLE / 2 - 22,
    width:    44,
    height:   MILO_CIRCLE + 80,
  },
});

// ─── Trail sparks — rasto de brilho girando com o Milo durante o spin ─────────

type TrailSpec = { angle: number; delay: number };
const TRAIL: TrailSpec[] = Array.from({ length: 6 }, (_, i) => ({ angle: i * 55, delay: i * 55 }));

function TrailSpark({ spec }: { spec: TrailSpec }) {
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const base = 640 + spec.delay;
    opacity.value = withDelay(base, withSequence(withTiming(0.9, { duration: 90 }), withTiming(0, { duration: 220 })));
    scale.value   = withDelay(base, withSequence(withTiming(1,   { duration: 90 }), withTiming(0.6, { duration: 220 })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const rad  = (spec.angle * Math.PI) / 180;
  const r    = MILO_CIRCLE / 2 + 16;
  const top  = MILO_CIRCLE / 2 + Math.sin(rad) * r - 8;
  const left = MILO_CIRCLE / 2 + Math.cos(rad) * r - 8;

  return (
    <Animated.View style={[{ position: 'absolute', top, left }, anim] as StyleProp<ViewStyle>} pointerEvents="none">
      <Ionicons name="sparkles" size={16} color="#FDE68A" />
    </Animated.View>
  );
}

// ─── Star companion — estrela flutuante junto ao Milo (frame "abraça estrela") ─

function StarCompanion() {
  const scale   = useSharedValue(0);
  const floatY  = useSharedValue(0);
  const twinkle = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(1300, withSpring(1, { damping: 9, stiffness: 260 }));
    const tFloat = setTimeout(() => {
      floatY.value  = withRepeat(
        withSequence(
          withTiming(-6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,  { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
      twinkle.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 500 }), withTiming(0.9, { duration: 500 })),
        -1,
        true,
      );
    }, 1550);
    return () => clearTimeout(tFloat);
  }, []);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { scale: scale.value * twinkle.value }],
  }));

  return (
    <Animated.View style={[star.wrap, anim] as StyleProp<ViewStyle>} pointerEvents="none">
      <Ionicons name="star" size={30} color="#FBBF24" />
    </Animated.View>
  );
}

const star = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left:     -16,
    bottom:   10,
  },
});

// ─── Burst — sparkles/estrelas/pontos disparando radialmente (firework) ───────

type BurstSpec = {
  angle:    number;
  distance: number;
  size:     number;
  delay:    number;
  kind:     'dot' | 'sparkle' | 'star';
  color:    string;
};

function buildBurst(n: number): BurstSpec[] {
  let seed = 7;
  const r = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  return Array.from({ length: n }, (_, i) => {
    const roll = r();
    return {
      angle:    (360 / n) * i + (r() - 0.5) * 22,
      distance: 70 + r() * 66,
      size:     roll < 0.4 ? 8 + r() * 6 : 15 + r() * 9,
      delay:    r() * 90,
      kind:     roll < 0.4 ? 'dot' : roll < 0.7 ? 'sparkle' : 'star',
      color:    PALETTE[i % PALETTE.length] ?? '#F59E0B',
    };
  });
}

const BURST = buildBurst(12);

function BurstParticle({ spec }: { spec: BurstSpec }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(spec.delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, []);

  const anim = useAnimatedStyle(() => {
    const rad = (spec.angle * Math.PI) / 180;
    const dx  = Math.cos(rad) * spec.distance * p.value;
    const dy  = Math.sin(rad) * spec.distance * p.value + 34 * p.value * p.value;
    return {
      opacity:   1 - p.value,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale: 1 - 0.25 * p.value },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position:       'absolute',
          top:            MILO_CIRCLE / 2 - spec.size / 2,
          left:           MILO_CIRCLE / 2 - spec.size / 2,
          alignItems:     'center',
          justifyContent: 'center',
        },
        anim,
      ] as StyleProp<ViewStyle>}
    >
      {spec.kind === 'dot'
        ? <View style={{ width: spec.size, height: spec.size, borderRadius: spec.size / 2, backgroundColor: spec.color }} />
        : <Ionicons name={spec.kind === 'star' ? 'star' : 'sparkles'} size={spec.size} color={spec.color} />
      }
    </Animated.View>
  );
}

function BurstLayer() {
  return (
    <>
      {BURST.map((spec, i) => <BurstParticle key={i} spec={spec} />)}
    </>
  );
}

// ─── CorrectOverlay ───────────────────────────────────────────────────────────

export function CorrectOverlay({ xpGain = 10, onContinue }: { xpGain?: number; onContinue: () => void }) {
  const { t } = useTranslation();

  const miloScale = useSharedValue(0);
  const jumpY     = useSharedValue(0);
  const squashX   = useSharedValue(1);
  const squashY   = useSharedValue(1);
  const spinRot   = useSharedValue(0);

  const checkScale   = useSharedValue(0);

  const badgeOpacity = useSharedValue(0);
  const badgeY       = useSharedValue(-20);
  const badgePulse   = useSharedValue(1);

  const textOpacity  = useSharedValue(0);
  const textY        = useSharedValue(14);
  const titleScale   = useSharedValue(0.7);

  const fired = useRef(false);

  // Calcula distância de queda depois de montar (usa dimensões reais via onLayout seria ideal,
  // mas 900px cobre qualquer iPhone sem precisar de Dimensions que tem quirk TS)
  const FALL = 900;

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound('correct');

    // Pop-in elástico do Milo
    miloScale.value = withSpring(1, { damping: 8, stiffness: 260, mass: 0.9 });

    // Salto duplo com squash & stretch — haptic leve no primeiro pouso
    const tHop = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      jumpY.value = withSequence(
        withTiming(-20, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0,   { duration: 130, easing: Easing.in(Easing.quad) }),
        withTiming(-12, { duration: 90,  easing: Easing.out(Easing.quad) }),
        withTiming(0,   { duration: 110, easing: Easing.in(Easing.quad) }),
      );
      squashX.value = withSequence(
        withTiming(1.08, { duration: 90 }), withTiming(0.96, { duration: 110 }),
        withTiming(1.05, { duration: 70 }), withTiming(0.98, { duration: 90 }),
        withTiming(1,    { duration: 90 }),
      );
      squashY.value = withSequence(
        withTiming(0.92, { duration: 90 }), withTiming(1.06, { duration: 110 }),
        withTiming(0.95, { duration: 70 }), withTiming(1.03, { duration: 90 }),
        withTiming(1,    { duration: 90 }),
      );
    }, 260);

    // Giro 360° (rasto de sparkles é disparado internamente pelos TrailSpark)
    const tSpin = setTimeout(() => {
      spinRot.value = withTiming(360, { duration: 380, easing: Easing.inOut(Easing.cubic) });
    }, 620);

    // Badge +XP — drop-in com overshoot
    const t1 = setTimeout(() => {
      badgeOpacity.value = withTiming(1, { duration: 260 });
      badgeY.value       = withTiming(0, { duration: 360, easing: Easing.out(Easing.back(1.8)) });
    }, 100);

    // Selo verde de "certo"
    const tCheck = setTimeout(() => {
      checkScale.value = withSpring(1, { damping: 9, stiffness: 300 });
    }, 140);

    // Badge — shimmer contínuo depois de assentar
    const tPulse = setTimeout(() => {
      badgePulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(1,    { duration: 420, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, 480);

    // Título + botão — pop-in (não bloqueia o avanço da criança)
    const t2 = setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 300 });
      textY.value       = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
      titleScale.value  = withSpring(1, { damping: 11, stiffness: 260, mass: 0.9 });
    }, 200);

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      clearTimeout(tHop); clearTimeout(tSpin);
      clearTimeout(tCheck); clearTimeout(tPulse);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const miloAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: jumpY.value },
      { scale:  miloScale.value },
      { scaleX: squashX.value },
      { scaleY: squashY.value },
      { rotate: `${spinRot.value}deg` as unknown as number },
    ],
  }));
  const checkAnim = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const badgeAnim = useAnimatedStyle(() => ({
    opacity:   badgeOpacity.value,
    transform: [{ translateY: badgeY.value }, { scale: badgePulse.value }],
  }));
  const textAnim = useAnimatedStyle(() => ({
    opacity:   textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));
  const titleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  return (
    <LinearGradient colors={['#ECFDF5', '#BBF7D0']} style={s.root}>

      {/* 1. Conteúdo — atrás do confetti */}
      <View style={s.content}>

        {/* Milo + glow + shockwaves + rays + burst + badges */}
        <View style={s.circleWrapper}>
          <GlowPulse />
          <ShockwaveRing delay={0} />
          <ShockwaveRing delay={110} />
          <SunburstRays />

          <Animated.View style={[s.miloClip, miloAnim] as StyleProp<ViewStyle>}>
            <Image source={MILO_CELEBRATE} style={s.miloImg} resizeMode="contain" />
            <ShineSweep startDelay={980} />
          </Animated.View>

          <Animated.View style={[s.checkBadge, checkAnim] as StyleProp<ViewStyle>}>
            <Ionicons name="checkmark" size={22} color="#fff" />
          </Animated.View>

          <Animated.View style={[s.badge, badgeAnim] as StyleProp<ViewStyle>}>
            <RNText style={s.badgeText} numberOfLines={1}>
              +{xpGain} XP
            </RNText>
          </Animated.View>

          <StarCompanion />

          {TRAIL.map((spec, i) => <TrailSpark key={i} spec={spec} />)}

          <BurstLayer />
        </View>

        <Animated.View style={[textAnim, titleAnim] as StyleProp<ViewStyle>}>
          <RNText style={s.label} numberOfLines={1}>
            {t('challenge.correct')}
          </RNText>
        </Animated.View>

      </View>

      {/* Continuar — mesma posição/tamanho/forma do botão da tela "Desafio concluído" */}
      <Animated.View style={[s.btnWrapper, textAnim] as StyleProp<ViewStyle>}>
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [s.continueBtn, pressed && s.continueBtnPressed]}
          hitSlop={12}
        >
          <RNText style={s.continueBtnText}>{t('common.continue')}</RNText>
        </Pressable>
      </Animated.View>

      {/* 2. Confetti — frente */}
      <ConfettiLayer fallDistance={FALL} />

    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  confettiAbs: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },

  circleWrapper: {
    width:  MILO_CIRCLE,
    height: MILO_CIRCLE,
    // overflow visible (padrão) para glow/rays/burst/badges não serem cortados
  },
  miloClip: {
    width:           MILO_CIRCLE,
    height:          MILO_CIRCLE,
    borderRadius:    MILO_CIRCLE / 2,
    backgroundColor: '#fff',
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#166534',
    shadowOpacity:   0.22,
    shadowRadius:    18,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       10,
  },
  miloImg: {
    width:  MILO_CIRCLE - 6,
    height: MILO_CIRCLE - 6,
  },

  checkBadge: {
    position:          'absolute',
    right:             -4,
    bottom:            -4,
    width:             CHECK_BADGE,
    height:            CHECK_BADGE,
    borderRadius:      CHECK_BADGE / 2,
    backgroundColor:   '#22C55E',
    alignItems:        'center',
    justifyContent:    'center',
    borderWidth:       3,
    borderColor:       '#fff',
    shadowColor:       '#166534',
    shadowOpacity:     0.25,
    shadowRadius:      6,
    shadowOffset:      { width: 0, height: 2 },
    elevation:         4,
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
    lineHeight:         46,
    color:              '#166534',
    letterSpacing:      -0.5,
    includeFontPadding: false,
  },

  btnWrapper: { width: '100%' },
  continueBtn: {
    backgroundColor: '#fff',
    borderRadius:    999,
    height:          58,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.14,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       5,
  },
  continueBtnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.96 }],
  },
  continueBtnText: {
    fontFamily: fontFamily.extraBold,
    fontSize:   18,
    color:      '#16A34A',
  },
});
