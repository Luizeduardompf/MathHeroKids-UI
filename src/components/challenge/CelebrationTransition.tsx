/**
 * CelebrationTransition — animação de 3s entre a tela de sucesso e a submissão.
 * Porta fiel do celebration-transition.tsx do design reference.
 *
 * Sequência:
 *    0ms  — background flash escala de 0 → tela inteira (600ms)
 *  400ms  — sun rays aparecem + iniciam rotação lenta (8s/volta)
 *  450ms  — trophy card: scale 0 → 1.3 → 1, rotate -180 → 0 (800ms)
 *  500ms  — burst ring expande e funde
 *  900ms  — sparkles pulsam em loop
 * 1000ms  — título "Troféu Conquistado!" spring in
 * 1200ms  — trophy wobble ±8°
 * 1300ms  — subtítulo sobe
 * 3000ms  — auto-avança chamando onComplete
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
// @ts-expect-error reanimated withDelay named-export quirk
import { withDelay } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated Easing named-export quirk
import { Easing } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withRepeat named-export quirk
import { withRepeat } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated withSequence named-export quirk
import { withSequence } from 'react-native-reanimated'; // eslint-disable-line

import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { fontFamily } from '@/theme';
import { playSound } from '@/services/sound.service';

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#2B52E5', '#F5722A', '#22C55E', '#EF4444',
  '#F59E0B', '#8B5CF6', '#EC4899', '#FFFFFF',
];

type CPiece = { x: number; color: string; size: number; aspect: number; delay: number; dur: number };

function buildConfetti(n: number): CPiece[] {
  let seed = 17;
  const r = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
  return Array.from({ length: n }, (_, i) => ({
    x:      r() * 96,
    color:  CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    size:   7 + r() * 9,
    aspect: r() > 0.5 ? 1 : 2.5,
    delay:  r() * 500,
    dur:    1600 + r() * 1200,
  }));
}

const PIECES = buildConfetti(120);

function ConfettoPiece({ piece }: { piece: CPiece }) {
  const y       = useSharedValue(-20);
  const rot     = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const run = () => {
      y.value       = withTiming(980, { duration: piece.dur, easing: Easing.linear });
      rot.value     = withTiming(720, { duration: piece.dur, easing: Easing.linear });
      const fadeAt  = Math.round(piece.dur * 0.65);
      opacity.value = withDelay(
        fadeAt,
        withTiming(0, { duration: piece.dur - fadeAt, easing: Easing.linear }),
      );
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    if (piece.delay > 0) { t = setTimeout(run, piece.delay); } else { run(); }
    return () => { if (t !== undefined) clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { rotate: `${rot.value}deg` as unknown as number },
    ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return (
    <Animated.View
      style={[
        cc.piece,
        {
          left:            `${piece.x}%` as unknown as number,
          width:           piece.size,
          height:          piece.size * piece.aspect,
          borderRadius:    piece.aspect <= 1.4 ? piece.size / 2 : 3,
          backgroundColor: piece.color,
        },
        anim,
      ]}
    />
  );
}

function Confetti() {
  return (
    <View style={cc.container} pointerEvents="none">
      {PIECES.map((p, i) => <ConfettoPiece key={i} piece={p} />)}
    </View>
  );
}

const cc = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  piece:     { position: 'absolute', top: 0 },
});

// ─── Sun Rays ─────────────────────────────────────────────────────────────────

function SunRays() {
  const rotation = useSharedValue(0);
  const opacity  = useSharedValue(0);

  useEffect(() => {
    opacity.value  = withDelay(400, withTiming(1, { duration: 300 }));
    rotation.value = withDelay(400, withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    ));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ rotate: `${rotation.value}deg` as unknown as number }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  const NUM = 12;
  return (
    <Animated.View
      style={[rays.container, anim]}
      pointerEvents="none"
    >
      {Array.from({ length: NUM }, (_, i) => (
        <View
          key={i}
          style={[rays.ray, { transform: [{ rotate: `${(i * 180) / NUM}deg` }] }]}
        />
      ))}
    </Animated.View>
  );
}

const rays = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position:        'absolute',
    width:           4,
    height:          1200,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});

// ─── Burst Ring ────────────────────────────────────────────────────────────────

function BurstRing() {
  const size    = useSharedValue(80);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    size.value    = withDelay(500, withTiming(520, { duration: 1000, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(500, withTiming(0,   { duration: 1000, easing: Easing.out(Easing.quad) }));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anim = useAnimatedStyle(() => ({
    width:        size.value,
    height:       size.value,
    borderRadius: size.value / 2,
    opacity:      opacity.value,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return (
    <Animated.View style={[ring.base, anim]} pointerEvents="none" />
  );
}

const ring = StyleSheet.create({
  base: {
    position:    'absolute',
    borderWidth: 6,
    borderColor: '#fff',
    alignSelf:   'center',
  },
});

// ─── Sparkle item ─────────────────────────────────────────────────────────────

function SparkleItem({ top, bottom, left, right, delay, icon }: {
  top?:    number;
  bottom?: number;
  left?:   number;
  right?:  number;
  delay:   number;
  icon:    'sparkles' | 'star';
}) {
  const scale = useSharedValue(0);
  const op    = useSharedValue(0);

  useEffect(() => {
    op.value    = withDelay(delay, withTiming(1, { duration: 200 }));
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.3, { duration: 300 }),
        withTiming(1.0, { duration: 300 }),
        withTiming(1.3, { duration: 300 }),
        withTiming(0.8, { duration: 300 }),
      ),
      -1,
      false,
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   op.value,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return (
    <Animated.View
      style={[
        sparkle.base,
        { top, bottom, left, right },
        anim,
      ]}
    >
      <Ionicons name={icon} size={26} color="#FDE68A" />
    </Animated.View>
  );
}

const sparkle = StyleSheet.create({
  base: { position: 'absolute' },
});

// ─── Trophy Card ──────────────────────────────────────────────────────────────

function TrophyCard() {
  const scale  = useSharedValue(0);
  const rotate = useSharedValue(-180);
  const y      = useSharedValue(40);
  const wobble = useSharedValue(0);

  useEffect(() => {
    // Entrada: 0 → 1.3 → 1 over 800ms (delay 450ms)
    scale.value  = withDelay(450, withSequence(
      withTiming(1.3, { duration: 560, easing: Easing.out(Easing.back(2)) }),
      withTiming(1.0, { duration: 240, easing: Easing.out(Easing.quad) }),
    ));
    rotate.value = withDelay(450, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
    y.value      = withDelay(450, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // Wobble (1200ms)
    wobble.value = withDelay(1200, withSequence(
      withTiming(-8, { duration: 90 }),
      withTiming( 8, { duration: 100 }),
      withTiming(-5, { duration: 90 }),
      withTiming( 5, { duration: 90 }),
      withTiming( 0, { duration: 80 }),
    ));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { scale:      scale.value },
      { rotate:     `${rotate.value}deg` as unknown as number },
    ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trophyAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value}deg` as unknown as number }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return (
    <Animated.View style={[tc.card, cardAnim]}>
      <Animated.View style={trophyAnim}>
        <Ionicons name="trophy" size={88} color="#F5722A" />
      </Animated.View>

      {/* Sparkles around the card — positioned outside via negative offsets */}
      <SparkleItem icon="sparkles" top={-20}  left={-18} delay={900}  />
      <SparkleItem icon="star"     top={-16}  right={-22} delay={1050} />
      <SparkleItem icon="star"     bottom={-18} left={-12} delay={1150} />
      <SparkleItem icon="sparkles" bottom={-20} right={-16} delay={1250} />
    </Animated.View>
  );
}

const tc = StyleSheet.create({
  card: {
    width:           176,
    height:          176,
    borderRadius:    28,
    backgroundColor: '#fff',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.22,
    shadowRadius:    20,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       12,
    overflow:        'visible',
  },
});

// ─── CelebrationTransition ────────────────────────────────────────────────────

export function CelebrationTransition({ onComplete, isRetroactive }: { onComplete: () => void; isRetroactive?: boolean }) {
  const { t } = useTranslation();

  // Auto-advance after 3s
  useEffect(() => {
    const t = setTimeout(onComplete, 3000);
    return () => clearTimeout(t);
  }, [onComplete]);

  // Som do troféu — sincronizado com a entrada do cartão (450ms)
  useEffect(() => {
    const t = setTimeout(() => playSound('trophy'), 450);
    return () => clearTimeout(t);
  }, []);

  // Flash background
  const bgScale = useSharedValue(0);
  useEffect(() => {
    bgScale.value = withTiming(6, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgAnim = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // Title
  const titleScale = useSharedValue(0);
  const titleOp    = useSharedValue(0);
  const subY       = useSharedValue(14);
  const subOp      = useSharedValue(0);

  useEffect(() => {
    titleScale.value = withDelay(1000, withSpring(1, { stiffness: 260, damping: 16 }));
    titleOp.value    = withDelay(1000, withTiming(1, { duration: 200 }));
    subY.value       = withDelay(1300, withTiming(0, { duration: 300 }));
    subOp.value      = withDelay(1300, withTiming(1, { duration: 300 }));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const titleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
    opacity:   titleOp.value,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: subY.value }],
    opacity:   subOp.value,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;

  return (
    <View style={cs.root}>
      {/* Flash background circle que escala até cobrir o ecrã */}
      <Animated.View style={[cs.flashBg, bgAnim]} pointerEvents="none" />

      {/* Gradient overlay */}
      <LinearGradient
        colors={['rgba(255,220,60,0.0)', 'rgba(43,82,229,0.5)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={cs.gradientOverlay}
        pointerEvents="none"
      />

      {/* Confetti */}
      <Confetti />

      {/* Sun rays */}
      <SunRays />

      {/* Burst ring */}
      <BurstRing />

      {/* Centro: trophy + texto */}
      <View style={cs.center}>
        <TrophyCard />

        <Animated.View style={titleAnim}>
          <Text style={cs.title}>{t('challenge.celebration.title')}</Text>
        </Animated.View>

        <Animated.View style={subAnim}>
          <Text style={cs.subtitle}>
            {t(isRetroactive ? 'challenge.celebration.subtitlePast' : 'challenge.celebration.subtitle')}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  root: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F59E0B',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          100,
    overflow:        'hidden',
  },
  flashBg: {
    position:        'absolute',
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: '#FDE68A',
    alignSelf:       'center',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  center: {
    alignItems: 'center',
    zIndex:     10,
  },
  title: {
    fontFamily:       fontFamily.extraBold,
    fontSize:         40,
    lineHeight:       48,
    color:            '#fff',
    textAlign:        'center',
    marginTop:        36,
    textShadowColor:  'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontFamily: fontFamily.bold,
    fontSize:   18,
    lineHeight: 26,
    color:      'rgba(255,255,255,0.9)',
    textAlign:  'center',
    marginTop:  8,
  },
});
