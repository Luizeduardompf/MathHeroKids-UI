/**
 * SplashScreen — tela animada exibida enquanto o app carrega.
 *
 * Animações:
 *  - Símbolos matemáticos flutuando do fundo para o topo
 *  - Mascote: pop-in com spring + float contínuo
 *  - Estrelas orbitando ao redor do card do mascote
 *  - Sparkle pulsando no canto superior-direito
 *  - Título "Math Hero Kids" letra por letra
 *  - 3 pontos dourados saltitantes
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
// @ts-expect-error RN 0.85 — Dimensions presente em runtime mas TS quirk
import { Dimensions } from 'react-native'; // eslint-disable-line
// @ts-expect-error RN 0.85 — Image presente em runtime mas TS quirk
import { Image } from 'react-native'; // eslint-disable-line
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
// @ts-expect-error reanimated 4 — src/index resolve via react-native field, submodules ausentes
import { withRepeat, withSequence, withDelay, cancelAnimation, interpolate, Extrapolation } from 'react-native-reanimated'; // eslint-disable-line
// @ts-expect-error reanimated Easing named-export quirk
import { Easing } from 'react-native-reanimated'; // eslint-disable-line

import { colors } from '@/theme';

const W: number = (Dimensions as { get: (s: string) => { width: number; height: number } }).get('window').width;
const H: number = (Dimensions as { get: (s: string) => { width: number; height: number } }).get('window').height;

const BRAND = colors.primary;       // #2B52E5
const GOLD  = colors.warning;       // #F59E0B
const WHITE = colors.text.inverse;  // #FFFFFF

const TITLE = 'Math Hero Kids';
const TITLE_CHARS = TITLE.split('');

const FLOATERS = [
  { symbol: '+', left: 0.06, size: 22, delay: 0,    dur: 7000, drift: 18,  alpha: 0.28 },
  { symbol: '7', left: 0.14, size: 26, delay: 2100, dur: 9000, drift: -16, alpha: 0.30 },
  { symbol: '−', left: 0.22, size: 18, delay: 1600, dur: 8000, drift: -14, alpha: 0.25 },
  { symbol: '×', left: 0.38, size: 22, delay: 800,  dur: 6500, drift: 22,  alpha: 0.25 },
  { symbol: '3', left: 0.42, size: 22, delay: 2200, dur: 7200, drift: -16, alpha: 0.30 },
  { symbol: '÷', left: 0.52, size: 20, delay: 2400, dur: 7500, drift: -10, alpha: 0.25 },
  { symbol: '=', left: 0.60, size: 20, delay: 400,  dur: 8500, drift: 16,  alpha: 0.25 },
  { symbol: '9', left: 0.68, size: 28, delay: 600,  dur: 8800, drift: 20,  alpha: 0.30 },
  { symbol: '+', left: 0.78, size: 18, delay: 4000, dur: 7000, drift: -12, alpha: 0.25 },
  { symbol: '5', left: 0.82, size: 22, delay: 2800, dur: 6600, drift: -12, alpha: 0.30 },
  { symbol: '×', left: 0.94, size: 18, delay: 1200, dur: 6800, drift: 12,  alpha: 0.25 },
] as const;

const ORBIT_STARS = [
  { angle:   0, radius: 115, size: 18, duration:  9000 },
  { angle: 120, radius: 125, size: 13, duration: 11000 },
  { angle: 240, radius: 105, size: 15, duration: 10000 },
] as const;

const ORBIT_SIZE = 300;

// ─── FloatingSymbol ───────────────────────────────────────────────────────────

type FloaterCfg = typeof FLOATERS[number];

function FloatingSymbol({ symbol, left, size, delay, dur, drift, alpha }: FloaterCfg) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => {
    const p: number = progress.value;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const rotDeg: number = interpolate(p, [0, 1], [0, 180]);
    return {
      position: 'absolute' as const,
      bottom: 0,
      left: W * left,
      fontSize: size,
      color: WHITE,
      fontWeight: '800' as const,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      opacity: interpolate(p, [0, 0.10, 0.88, 1], [0, alpha, alpha, 0], Extrapolation.CLAMP),
      transform: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { translateY: interpolate(p, [0, 0.10, 0.88, 1], [0, -H * 0.04, -H * 0.92, -H * 1.15]) },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { translateX: interpolate(p, [0, 1], [0, drift]) },
        { rotate: `${rotDeg}deg` },
      ],
    };
  });

  return <Animated.Text style={animStyle as StyleProp<TextStyle>}>{symbol}</Animated.Text>;
}

// ─── OrbitStar ────────────────────────────────────────────────────────────────

type StarCfg = typeof ORBIT_STARS[number];

function OrbitStar({ angle: initialAngle, radius, size, duration }: StarCfg) {
  const rotation = useSharedValue(initialAngle);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    rotation.value = withRepeat(withTiming(initialAngle + 360, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const center = ORBIT_SIZE / 2;

  const animStyle = useAnimatedStyle(() => {
    const deg: number = rotation.value;
    return {
      position: 'absolute' as const,
      left: center - size / 2,
      top:  center - size / 2,
      width: size,
      height: size,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      transform: [
        { rotate: `${deg}deg` },
        { translateX: radius },
        { rotate: `${-deg}deg` },
      ],
    };
  });

  return (
    <Animated.View style={animStyle}>
      <Text style={{ color: GOLD, fontSize: size, lineHeight: size + 2 }}>★</Text>
    </Animated.View>
  );
}

// ─── BounceDot ────────────────────────────────────────────────────────────────

function BounceDot({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay( // eslint-disable-line @typescript-eslint/no-unsafe-call
      delay,
      withRepeat( // eslint-disable-line @typescript-eslint/no-unsafe-call
        withSequence( // eslint-disable-line @typescript-eslint/no-unsafe-call
          withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 550, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GOLD,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    opacity: interpolate(progress.value, [0, 1], [0.6, 1]),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -12]) }],
  }));

  return <Animated.View style={animStyle} />;
}

// ─── TitleLetter ─────────────────────────────────────────────────────────────

function TitleLetter({
  char,
  index,
  titleProgress,
}: {
  char: string;
  index: number;
  titleProgress: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const p: number = interpolate(titleProgress.value, [index, index + 1], [0, 1], Extrapolation.CLAMP);
    return {
      fontFamily:    'Nunito_800ExtraBold',
      fontSize:       48,
      lineHeight:     58,
      color:          WHITE,
      letterSpacing: -0.5,
      opacity: p,
      transform: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { translateY: interpolate(p, [0, 1], [22, 0]) },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { scale:      interpolate(p, [0, 1], [0.6, 1]) },
      ],
    };
  });

  return <Animated.Text style={animStyle as StyleProp<TextStyle>}>{char}</Animated.Text>;
}

// ─── SplashScreen ─────────────────────────────────────────────────────────────

export default function SplashScreen() {
  const mascotScale   = useSharedValue(0);
  const floatAnim     = useSharedValue(0);
  const haloAnim      = useSharedValue(0);
  const sparkleAnim   = useSharedValue(0);
  const titleProgress = useSharedValue(0);
  const subtitleAnim  = useSharedValue(0);

  useEffect(() => {
    mascotScale.value = withSpring(1, { damping: 10, stiffness: 160 });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    floatAnim.value   = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    haloAnim.value    = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    sparkleAnim.value = withRepeat(withTiming(1, { duration: 900,  easing: Easing.inOut(Easing.ease) }), -1, true);

    titleProgress.value = withDelay( // eslint-disable-line @typescript-eslint/no-unsafe-call
      900,
      withTiming(TITLE_CHARS.length, { duration: TITLE_CHARS.length * 55, easing: Easing.out(Easing.ease) }),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    subtitleAnim.value = withDelay(1700, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));

    return () => {
      cancelAnimation(mascotScale);
      cancelAnimation(floatAnim);
      cancelAnimation(haloAnim);
      cancelAnimation(sparkleAnim);
      cancelAnimation(titleProgress);
      cancelAnimation(subtitleAnim);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mascotStyle = useAnimatedStyle(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const scale: number = interpolate(mascotScale.value, [0, 0.65, 1], [0, 1.12, 1], Extrapolation.CLAMP);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const floatY: number    = interpolate(floatAnim.value, [0, 1], [0, -14]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const floatRot: number  = interpolate(floatAnim.value, [0, 1], [-1.5, 1.5]);
    return {
      transform: [{ scale }, { translateY: floatY }, { rotate: `${floatRot}deg` }],
    };
  });

  const haloStyle = useAnimatedStyle(() => ({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    opacity: interpolate(haloAnim.value, [0, 1], [0.5, 0.85]),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transform: [{ scale: interpolate(haloAnim.value, [0, 1], [1.3, 1.55]) }],
  }));

  const sparkleStyle = useAnimatedStyle(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const rotDeg: number = interpolate(sparkleAnim.value, [0, 1], [0, 20]);
    return {
      transform: [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        { scale: interpolate(sparkleAnim.value, [0, 1], [0.8, 1.2]) },
        { rotate: `${rotDeg}deg` },
      ],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => ({
    fontFamily: 'Nunito_700Bold',
    fontSize:   18,
    color:      'rgba(255,255,255,0.80)' as const,
    textAlign:  'center' as const,
    opacity: subtitleAnim.value,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transform: [{ translateY: interpolate(subtitleAnim.value, [0, 1], [12, 0]) }],
  }));

  return (
    <View style={styles.container}>
      {/* Glows de fundo */}
      <View style={styles.glowTL} />
      <View style={styles.glowBR} />

      {/* Símbolos flutuantes */}
      <View style={styles.floatersLayer} pointerEvents="none">
        {FLOATERS.map((f, i) => (
          <FloatingSymbol key={i} {...f} />
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Conteúdo central ── */}
      <View style={styles.center}>

        {/* Órbita + mascote */}
        <View style={styles.orbitContainer}>
          <Animated.View style={[styles.halo, haloStyle] as StyleProp<ViewStyle>} />
          {ORBIT_STARS.map((s, i) => <OrbitStar key={i} {...s} />)}

          {/* Mascote: pop-in + float */}
          <Animated.View style={mascotStyle}>
            <View style={styles.mascotCard}>
              <Image
                source={require('../../assets/images/milo-mascot.png')}
                style={styles.mascotImage}
                resizeMode="cover"
              />
            </View>
          </Animated.View>

          {/* Sparkle ✦ canto superior-direito */}
          <Animated.View style={[styles.sparkle, sparkleStyle] as StyleProp<ViewStyle>}>
            <Text style={styles.sparkleText}>✦</Text>
          </Animated.View>
        </View>

        {/* Título letra por letra */}
        <View style={styles.titleRow}>
          {TITLE_CHARS.map((char, i) => (
            <TitleLetter key={i} char={char} index={i} titleProgress={titleProgress} />
          ))}
        </View>

        {/* Subtítulo */}
        <Animated.Text style={subtitleStyle as StyleProp<TextStyle>}>
          Aprender é uma aventura!
        </Animated.Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Indicador de carregamento ── */}
      <View style={styles.bottom}>
        <View style={styles.dotsRow}>
          <BounceDot delay={0}   />
          <BounceDot delay={160} />
          <BounceDot delay={320} />
        </View>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>

      <View style={{ height: 48 }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glowTL: {
    position: 'absolute',
    left: -96, top: -96,
    width: 320, height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glowBR: {
    position: 'absolute',
    right: -80, bottom: -112,
    width: 384, height: 384,
    borderRadius: 192,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  floatersLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    zIndex: 10,
  },
  orbitContainer: {
    width:  ORBIT_SIZE,
    height: ORBIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  halo: {
    position: 'absolute',
    width: 176, height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mascotCard: {
    width: 176, height: 176,
    borderRadius: 36,
    backgroundColor: WHITE,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  mascotImage: {
    width: 176,
    height: 176,
  },
  sparkle: {
    position: 'absolute',
    top:   ORBIT_SIZE / 2 - 88 - 14,
    right: ORBIT_SIZE / 2 - 88 - 18,
    zIndex: 20,
  },
  sparkleText: {
    color: GOLD, fontSize: 28, lineHeight: 32,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  bottom: {
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  loadingText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize:   14,
    color:      'rgba(255,255,255,0.70)',
  },
});
