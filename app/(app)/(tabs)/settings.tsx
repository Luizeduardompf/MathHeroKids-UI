import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-expect-error RN 0.85 quirk
import { Alert } from 'react-native'; // eslint-disable-line
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { authService } from '@/services/auth.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { SUPPORTED_LOCALES, TIMER_OPTIONS, MULTIPLICATION_RANGES } from '@/constants/config';
import type { SupportedLocale, TimerOption, MultiplicationRange } from '@/constants/config';
import type { ChildProfile } from '@/types';
import { changeLocale, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { colors, space, radius } from '@/theme';

const LOCALE_LABEL: Record<SupportedLocale, string> = {
  pt: '🇧🇷  PT',
  en: '🇺🇸  EN',
  es: '🇪🇸  ES',
  fr: '🇫🇷  FR',
};

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const parentProfile = useAuthStore((s) => s.parentProfile);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasPinSet = !!parentProfile?.pin_hash;

  async function handleVerify() {
    if (!hasPinSet) { onUnlock(); return; }
    if (pin.length < 4) { setError('Digite os 4 dígitos do PIN.'); return; }
    setError(null);
    setLoading(true);
    try {
      // TODO Phase 7: call verify_parent_pin Edge Function
      // For now, EF returns 501 — degrade gracefully
      onUnlock();
    } catch {
      setError('PIN incorreto. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <Text variant="caption" color="rgba(255,255,255,0.8)" style={styles.appName}>
            Math Hero Kids
          </Text>
          <Text variant="h1" color={colors.text.inverse}>{t('settings.title')}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.pinGate}>
        <Text style={styles.pinLock}>🔒</Text>
        <Text variant="h2">{t('parentArea.pin.title')}</Text>
        <Text variant="body" color={colors.text.secondary} align="center">
          {hasPinSet ? t('parentArea.pin.subtitle') : 'PIN não configurado — acesso direto.'}
        </Text>

        {hasPinSet && (
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(v) => { setPin(v.replace(/\D/g, '').slice(0, 4)); setError(null); }}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            placeholder="• • • •"
            placeholderTextColor={colors.text.tertiary}
            textAlign="center"
          />
        )}

        {error && (
          <Text variant="bodySmall" color={colors.error} align="center">{error}</Text>
        )}

        <Button
          label={hasPinSet ? 'Confirmar' : 'Entrar'}
          loading={loading}
          onPress={handleVerify}
          style={styles.pinBtn}
        />
      </View>
    </View>
  );
}

// ─── Per-child settings card ──────────────────────────────────────────────────

function ChildSettingsCard({ child }: { child: ChildProfile }) {
  const { t } = useTranslation();
  const router = useRouter();
  const setActiveChild = useProfileStore((s) => s.setActiveChild);
  const activeChild = useProfileStore((s) => s.activeChild);
  const [savingTimer, setSavingTimer] = useState(false);
  const [savingMult, setSavingMult] = useState(false);
  // Local state to reflect optimistic updates within this card
  const [localChild, setLocalChild] = useState(child);

  async function handleTimer(value: TimerOption) {
    if (value === localChild.timer_seconds || savingTimer) return;
    setSavingTimer(true);
    try {
      const updated = await childService.updateChild(localChild.id, { timer_seconds: value });
      setLocalChild(updated);
      if (activeChild?.id === updated.id) setActiveChild(updated);
    } finally {
      setSavingTimer(false);
    }
  }

  async function handleMultiplication(value: MultiplicationRange) {
    if (value === localChild.multiplication_max || savingMult) return;
    setSavingMult(true);
    try {
      const updated = await childService.updateChild(localChild.id, { multiplication_max: value });
      setLocalChild(updated);
      if (activeChild?.id === updated.id) setActiveChild(updated);
    } finally {
      setSavingMult(false);
    }
  }

  return (
    <Card style={styles.childCard}>
      {/* Child header */}
      <View style={styles.childHeader}>
        <Avatar avatarId={localChild.avatar_id} displayName={localChild.display_name} size="md" />
        <View style={styles.childInfo}>
          <Text variant="label">{localChild.display_name}</Text>
          <Text variant="caption" color={colors.text.secondary}>
            @{localChild.username} · {t('common.level', { level: localChild.level })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/(app)/parent-area/child/${localChild.id}`)}
          style={styles.editBtn}
        >
          <Text variant="caption" color={colors.primary}>✏️ Editar</Text>
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <Text variant="label" color={colors.text.secondary}>{t('settings.timerTitle')}</Text>
          {savingTimer && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.chipRow}>
          {TIMER_OPTIONS.map((val) => {
            const selected = localChild.timer_seconds === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => handleTimer(val)}
              >
                <Text variant="caption" color={selected ? colors.text.inverse : colors.text.primary}>
                  {val === 0 ? t('settings.timerUnlimited') : `${val}s`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Multiplication */}
      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <Text variant="label" color={colors.text.secondary}>{t('settings.multiplicationTitle')}</Text>
          {savingMult && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.chipRow}>
          {MULTIPLICATION_RANGES.map((val) => {
            const selected = localChild.multiplication_max === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => handleMultiplication(val)}
              >
                <Text variant="caption" color={selected ? colors.text.inverse : colors.text.primary}>
                  ×{val}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

// ─── Parent card ──────────────────────────────────────────────────────────────

function ParentCard() {
  const user          = useAuthStore((s) => s.user);
  const parentProfile = useAuthStore((s) => s.parentProfile);

  // Nome: parentProfile.name > user_metadata.name > email prefix
  const rawName = (parentProfile?.name as string | undefined)
    ?? (user?.user_metadata?.name as string | undefined)
    ?? user?.email?.split('@')[0]
    ?? '—';
  const email   = user?.email ?? '—';
  const initials = rawName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Card style={pc.card}>
      {/* Avatar com iniciais */}
      <View style={pc.avatarCircle}>
        <Text style={pc.initials}>{initials}</Text>
      </View>
      <View style={pc.info}>
        <Text variant="h3">{rawName}</Text>
        <Text variant="caption" color={colors.text.secondary}>{email}</Text>
      </View>
    </Card>
  );
}

const pc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xs,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 24,
  },
  info: { flex: 1, gap: 2 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router      = useRouter();
  const parentId    = useAuthStore(selectParentId);
  const [pinVerified, setPinVerified] = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  async function handleLogout() {
    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await authService.signOut();
            setLoggingOut(false);
            // useAuthListener detecta signOut e redireciona para welcome
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  }

  // Reset PIN gate every time the tab comes into focus
  useFocusEffect(useCallback(() => {
    setPinVerified(false);
  }, []));

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children', parentId],
    queryFn: () => childService.listChildren(parentId!),
    enabled: !!parentId && pinVerified,
  });

  const currentLocale = i18n.language as SupportedLocale;

  async function handleLocale(locale: SupportedLocale) {
    changeLocale(locale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  if (!pinVerified) {
    return <PinGate onUnlock={() => setPinVerified(true)} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <Text variant="caption" color="rgba(255,255,255,0.8)" style={styles.appName}>
            Math Hero Kids
          </Text>
          <Text variant="h1" color={colors.text.inverse}>{t('settings.title')}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Dados do pai ──────────────────────────────────────── */}
        <ParentCard />

        {/* ── Language (global) ─────────────────────────────────── */}
        <Card style={styles.section}>
          <Text variant="h3" style={styles.sectionLabel}>{t('settings.language')}</Text>
          <View style={styles.localeGrid}>
            {SUPPORTED_LOCALES.map((locale) => {
              const selected = currentLocale === locale;
              return (
                <TouchableOpacity
                  key={locale}
                  style={[styles.localeBtn, selected && styles.localeBtnSelected]}
                  onPress={() => handleLocale(locale)}
                >
                  <Text variant="label" color={selected ? colors.primary : colors.text.primary}>
                    {LOCALE_LABEL[locale]}
                  </Text>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* ── Per-child settings ────────────────────────────────── */}
        <Text variant="h3" style={styles.childrenLabel}>{t('profileSelect.title')}</Text>

        {isLoading && <ActivityIndicator color={colors.primary} />}

        {children.map((child) => (
          <ChildSettingsCard key={child.id} child={child} />
        ))}

        {/* ── Logout ───────────────────────────────────────────── */}
        <Button
          variant="destructive"
          label={loggingOut ? 'Saindo...' : 'Sair da conta'}
          loading={loggingOut}
          onPress={handleLogout}
          style={styles.logoutBtn}
        />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  safeHeader: { backgroundColor: colors.primary },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.xs,
  },
  appName: { opacity: 0.8, letterSpacing: 0.5 },

  // PIN gate
  pinGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  pinLock: { fontSize: 48 },
  pinInput: {
    width: 160,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.focus,
    backgroundColor: colors.background.card,
    fontSize: 24,
    letterSpacing: 8,
    color: colors.text.primary,
    textAlign: 'center',
  },
  pinBtn: { width: '100%', marginTop: space.sm },

  // Content
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  section: { gap: space.md },
  sectionLabel: { marginBottom: space.xs },
  childrenLabel: { marginTop: space.xs },
  logoutBtn: { marginTop: space.md },

  // Locale grid
  localeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  localeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '47%',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
  },
  localeBtnSelected: { borderColor: colors.primary, backgroundColor: colors.background.card },
  checkmark: { color: colors.primary, fontSize: 16, fontWeight: '700' },

  // Child card
  childCard: { gap: space.md },
  childHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  childInfo: { flex: 1, gap: 2 },
  editBtn: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  // Sub-sections (timer / multiplication)
  subSection: { gap: space.sm },
  subSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
});
