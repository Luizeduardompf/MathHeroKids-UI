import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Image present at runtime
import { Image } from 'react-native'; // eslint-disable-line
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui';
import { colors, radius, space } from '@/theme';

// ─── Feature pills ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    key: 'trophies',
    icon: 'trophy' as const,
    iconBg: colors.warning,
    label: 'Ganhe troféus e suba de nível',
  },
  {
    key: 'challenges',
    icon: 'sparkles' as const,
    iconBg: colors.accent,
    label: 'Desafios diários com o Milo',
  },
  {
    key: 'profiles',
    icon: 'star' as const,
    iconBg: colors.success,
    label: 'Vários perfis para a família toda',
  },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Mascot ── */}
          <View style={styles.mascotWrapper}>
            <View style={styles.starTopLeft}>
              <Ionicons name="star" size={22} color={colors.warning} />
            </View>
            <View style={styles.sparkleTopRight}>
              <Ionicons name="sparkles" size={26} color="rgba(255,255,255,0.6)" />
            </View>

            <View style={styles.mascotCard}>
              <Image
                source={require('../../assets/images/milo-mascot.png')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* ── Title & subtitle ── */}
          <Text variant="display" color={colors.text.inverse} align="center" style={styles.title}>
            {t('auth.welcome.title')}
          </Text>
          <Text
            variant="bodyLarge"
            color="rgba(255,255,255,0.85)"
            align="center"
            style={styles.subtitle}
          >
            {t('auth.welcome.subtitle')}
          </Text>

          {/* ── Feature pills ── */}
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.key} style={styles.pill}>
                <View style={[styles.pillIcon, { backgroundColor: f.iconBg }]}>
                  <Ionicons name={f.icon} size={20} color="#fff" />
                </View>
                <Text variant="label" color={colors.text.inverse} style={styles.pillLabel}>
                  {f.label}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Actions ── */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              onPress={() => router.push('/(auth)/register/parent')}
              accessibilityRole="button"
            >
              <Text variant="button" color={colors.primary}>
                {t('auth.welcome.getStarted')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
            >
              <Text variant="button" color={colors.text.inverse}>
                {t('auth.welcome.signIn')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space['2xl'],
    paddingBottom: space.xl,
  },

  // ── Mascot
  mascotWrapper: {
    position: 'relative',
    marginBottom: space.xl,
  },
  mascotCard: {
    width: 176,
    height: 176,
    borderRadius: radius.xl,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  mascotImage: {
    width: 152,
    height: 152,
  },
  starTopLeft: {
    position: 'absolute',
    top: 4,
    left: -18,
    zIndex: 1,
  },
  sparkleTopRight: {
    position: 'absolute',
    top: 24,
    right: -22,
    zIndex: 1,
  },

  // ── Texts
  title:    { marginBottom: space.sm },
  subtitle: { lineHeight: 26, maxWidth: 320, marginBottom: space.xl },

  // ── Feature pills
  features: { width: '100%', gap: space.sm, marginBottom: space.xl },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius['2xl'],
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

  // ── Actions
  actions: { width: '100%', gap: space.sm, marginTop: 'auto' as never },
  btnPrimary: {
    height: 56,
    width: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    height: 56,
    width: '100%',
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
