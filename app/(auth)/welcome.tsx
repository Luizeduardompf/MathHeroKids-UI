import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { colors, radius, space } from '@/theme';

// ─── Feature pills ────────────────────────────────────────────────────────────

const FEATURE_KEYS = [
  { key: 'trophies',   icon: 'trophy'   as const, iconBg: colors.warning },
  { key: 'challenges', icon: 'sparkles' as const, iconBg: colors.accent  },
  { key: 'profiles',   icon: 'star'     as const, iconBg: colors.success },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Mascot ─────────────────────────────────────────────────────── */}
          <View style={styles.mascotWrapper}>
            <View style={styles.starTopLeft}>
              <Ionicons name="star" size={22} color={colors.warning} />
            </View>
            <View style={styles.sparkleTopRight}>
              <Ionicons name="sparkles" size={26} color="rgba(255,255,255,0.6)" />
            </View>

            {/* Outer ring */}
            <View style={styles.mascotRing}>
              {/* Inner circle */}
              <View style={styles.mascotCircle}>
                <Image
                  source={require('../../assets/images/milo-mascot.png')}
                  style={styles.mascotImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          {/* ── Title & subtitle ─────────────────────────────────────────── */}
          <Text variant="display" color={colors.text.inverse} align="center" style={styles.title}>
            {t('auth.welcome.title')}
          </Text>
          <Text
            variant="bodyLarge"
            color="rgba(255,255,255,0.82)"
            align="center"
            style={styles.subtitle}
          >
            {t('auth.welcome.subtitle')}
          </Text>

          {/* ── Feature pills ─────────────────────────────────────────────── */}
          <View style={styles.features}>
            {FEATURE_KEYS.map((f) => (
              <View key={f.key} style={styles.pill}>
                <View style={[styles.pillIcon, { backgroundColor: f.iconBg }]}>
                  <Ionicons name={f.icon} size={20} color="#fff" />
                </View>
                <Text variant="label" color={colors.text.inverse} style={styles.pillLabel}>
                  {t(`auth.welcome.features.${f.key}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <View style={styles.actions}>
            <Button
              label={t('auth.welcome.getStarted')}
              variant="secondary"
              size="lg"
              onPress={() => router.push('/(auth)/register/parent')}
            />
            <Button
              label={t('auth.welcome.signIn')}
              variant="ghost"
              size="lg"
              style={styles.ghostBtn}
              onPress={() => router.push('/(auth)/login')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space['2xl'],
    paddingBottom: space.xl,
  },

  // ── Mascot ──────────────────────────────────────────────────────────────────
  mascotWrapper: {
    position: 'relative',
    marginBottom: space.xl,
  },
  mascotRing: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotCircle: {
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...({
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    } as object),
  },
  mascotImage: { width: 132, height: 132 },
  starTopLeft: { position: 'absolute', top: 6,  left: -16, zIndex: 1 },
  sparkleTopRight: { position: 'absolute', top: 28, right: -20, zIndex: 1 },

  // ── Texts ───────────────────────────────────────────────────────────────────
  title:    { marginBottom: space.sm },
  subtitle: { lineHeight: 26, maxWidth: 320, marginBottom: space.xl },

  // ── Feature pills ───────────────────────────────────────────────────────────
  features: { width: '100%', gap: space.sm, marginBottom: space.xl },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  pillIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: { flex: 1, lineHeight: 20 },

  // ── Actions ─────────────────────────────────────────────────────────────────
  actions: { width: '100%', gap: space.sm, marginTop: 'auto' as never },
  ghostBtn: {
    // Override ghost text to white for dark background
  },
});
