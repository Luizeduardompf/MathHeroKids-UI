/**
 * Parent PIN verification screen.
 *
 * Shown when the user navigates to parent-area and a PIN is set.
 * Design: lock icon, 4 dots, numeric keypad, "Esqueci o PIN" link.
 * Pixel-faithful to the "Controle dos pais" design mockup.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
// @ts-expect-error RN 0.85 quirk — Alert present at runtime
import { Alert } from 'react-native'; // eslint-disable-line
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { pinService } from '@/services/pin.service';
import { colors, fontFamily, shadows } from '@/theme';

// ─── PIN dot indicator ────────────────────────────────────────────────────────

function PinDots({ count, total = 4 }: { count: number; total?: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[dots.dot, i < count ? dots.dotFilled : dots.dotEmpty]}
        />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 16, alignItems: 'center' },
  dot:       { width: 18, height: 18, borderRadius: 9 },
  dotFilled: { backgroundColor: colors.primary },
  dotEmpty:  { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#CBD5E1' },
});

// ─── Numeric keypad (same visual style as challenge keypad) ───────────────────

function PinKeypad({
  onDigit,
  onDelete,
  disabled,
}: {
  onDigit: (d: number) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const topKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  return (
    <View style={kp.keypad}>
      {topKeys.map((k) => (
        <Pressable
          key={k}
          style={({ pressed }) => [kp.key, pressed && !disabled ? kp.keyPressed : null]}
          onPress={() => { if (!disabled) onDigit(k); }}
          accessibilityLabel={String(k)}
        >
          <Text style={kp.keyText}>{k}</Text>
        </Pressable>
      ))}
      {/* Row 4: empty | 0 | ⌫ */}
      <View style={kp.key} />
      <Pressable
        style={({ pressed }) => [kp.key, pressed && !disabled ? kp.keyPressed : null]}
        onPress={() => { if (!disabled) onDigit(0); }}
        accessibilityLabel="0"
      >
        <Text style={kp.keyText}>0</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [kp.key, kp.keyMuted, pressed && !disabled ? kp.keyPressed : null]}
        onPress={() => { if (!disabled) onDelete(); }}
        accessibilityLabel="Apagar"
      >
        <Ionicons name="backspace-outline" size={26} color="#6B7280" />
      </Pressable>
    </View>
  );
}

const kp = StyleSheet.create({
  keypad:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },
  key:       { width: '30%', height: 72, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  keyMuted:  { backgroundColor: '#EDEEF5' },
  keyPressed:{ opacity: 0.7, transform: [{ scale: 0.95 }] },
  keyText:   { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, color: '#1A1F36', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
});

// ─── Main screen ──────────────────────────────────────────────────────────────

interface Props {
  /** Called when PIN is verified (or no PIN is set). */
  onSuccess: () => void;
}

export default function PinScreen({ onSuccess }: Props) {
  const { t }    = useTranslation();
  const router   = useRouter();
  const parentId = useAuthStore(selectParentId);
  const user     = useAuthStore((s) => s.user);

  const [digits,  setDigits]  = useState<number[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleDigit = useCallback((d: number) => {
    setError(null);
    setDigits((prev) => {
      if (prev.length >= 4) return prev;
      const next = [...prev, d];
      if (next.length === 4) {
        // Auto-verify when 4 digits entered
        void verify(next.join(''));
      }
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(() => {
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  async function verify(pin: string) {
    if (!parentId) return;
    const ok = await pinService.verify(parentId, pin);
    if (ok) {
      onSuccess();
    } else {
      setDigits([]);
      setError(t('parentArea.pin.wrongPin'));
    }
  }

  async function handleForgotPin() {
    const email = user?.email;
    if (!email) return;
    setSending(true);
    try {
      await pinService.sendForgotPinEmail(email);
      Alert.alert(
        t('parentArea.pin.emailSentTitle'),
        t('parentArea.pin.emailSentMsg', { email }),
        [{ text: t('common.ok') }],
      );
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.headerSub}>Math Hero Kids</Text>
            <Text style={s.headerTitle}>Controle dos pais</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Content */}
      <View style={s.content}>
        {/* Lock icon */}
        <View style={s.lockCircle}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.primary} />
        </View>

        <Text style={s.title}>Área dos pais</Text>
        <Text style={s.subtitle}>Digite o PIN para continuar</Text>

        {/* PIN dots */}
        <PinDots count={digits.length} />

        {/* Error message */}
        {error ? (
          <Text style={s.errorText}>{error}</Text>
        ) : (
          <View style={{ height: 20 }} />
        )}

        {/* Keypad */}
        <PinKeypad onDigit={handleDigit} onDelete={handleDelete} />

        {/* Forgot PIN */}
        <Pressable onPress={handleForgotPin} disabled={sending} style={s.forgotBtn} hitSlop={8}>
          {sending
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Text style={s.forgotText}>Esqueci o PIN</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  headerSafe:  { backgroundColor: colors.primary },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8, gap: 12, backgroundColor: colors.primary },
  backBtn:     { padding: 4 },
  headerText:  { flex: 1 },
  headerSub:   { fontFamily: fontFamily.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 24, color: '#fff' },

  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    gap: 20,
  },

  // Lock icon
  lockCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  title:    { fontFamily: fontFamily.extraBold, fontSize: 26, color: '#1A1F36', textAlign: 'center' },
  subtitle: { fontFamily: fontFamily.regular, fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: -8 },

  errorText: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.error, textAlign: 'center', height: 20 },

  forgotBtn: { marginTop: 8 },
  forgotText:{ fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primary },
});
