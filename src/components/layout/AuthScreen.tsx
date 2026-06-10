import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, space } from '@/theme';

interface AuthScreenProps {
  /** Large bold white title in the header */
  title: string;
  /** Small subtitle above the title (e.g. "Math Hero Kids" or "Passo 1 de 2") */
  subtitle?: string;
  /** Called when back button is pressed. Omit to hide the back button. */
  onBack?: () => void;
  children: React.ReactNode;
  /** Extra style applied to the scrollable content container */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Two-tone layout for all auth screens.
 *
 * ┌──────────────────────────────┐
 * │  LinearGradient header (blue)│  ← back btn + subtitle + title
 * ├──────────────────────────────┤
 * │  Light scrollable body       │  ← children
 * └──────────────────────────────┘
 */
export function AuthScreen({
  title,
  subtitle,
  onBack,
  children,
  contentStyle,
}: AuthScreenProps) {
  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.headerContent}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text.inverse} />
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
            <View style={styles.headerTexts}>
              {subtitle ? (
                <Text variant="caption" style={styles.headerSubtitle}>
                  {subtitle}
                </Text>
              ) : null}
              <Text variant="h2" style={styles.headerTitle}>
                {title}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Body ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.body, contentStyle] as StyleProp<ViewStyle>}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom safe area */}
      <SafeAreaView edges={['bottom']} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  flex: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerGradient: {
    // Shadow casted downward onto the body
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  headerSafe: {},
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backBtnPressed: { backgroundColor: 'rgba(255,255,255,0.30)' },
  headerTexts: { flex: 1, gap: 2 },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '600',
    fontSize: 13,
  } as import('react-native').TextStyle,
  headerTitle: {
    color: colors.text.inverse,
    fontWeight: '800',
  } as import('react-native').TextStyle,

  // ── Body ────────────────────────────────────────────────────────────────────
  body: {
    flexGrow: 1,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
});
