import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Avatar, Button, Card, ConfirmDialog, Text } from '@/components/ui';
import { childService, getChildLocalSettings, setChildLocalSettings } from '@/services/child.service';
import { authService } from '@/services/auth.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { SUPPORTED_LOCALES, TIMER_OPTIONS, MULTIPLICATION_RANGES, QUESTION_COUNT_OPTIONS } from '@/constants/config';
import type { SupportedLocale, TimerOption, MultiplicationRange, QuestionCountOption } from '@/constants/config';
import type { ChildProfile } from '@/types';
import { changeLocale, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { colors, fontFamily, radius, space } from '@/theme';

// ─── Locale labels ────────────────────────────────────────────────────────────

const LOCALE_LABEL: Record<SupportedLocale, { flag: string; code: string }> = {
  pt: { flag: '🇧🇷', code: 'PT' },
  en: { flag: '🇺🇸', code: 'EN' },
  es: { flag: '🇪🇸', code: 'ES' },
  fr: { flag: '🇫🇷', code: 'FR' },
};

// ─── Section header row ───────────────────────────────────────────────────────

import type { IoniconsName } from '@/components/ui';

function SectionIcon({
  name,
  bg,
  color,
}: {
  name: IoniconsName;
  bg: string;
  color: string;
}) {
  return (
    <View style={[sectionIconStyles.wrap, { backgroundColor: bg }]}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
}

const sectionIconStyles = StyleSheet.create({
  wrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Settings header ──────────────────────────────────────────────────────────

function SettingsHeader({ title }: { title: string }) {
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text variant="caption" style={styles.appName}>Math Hero Kids</Text>
          <Text variant="h1" color={colors.text.inverse}>{title}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const router        = useRouter();
  const parentProfile = useAuthStore((s) => s.parentProfile);
  const user          = useAuthStore((s) => s.user);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const hasPinSet = !!parentProfile?.pin_hash;
  const rawName = (parentProfile?.name as string | undefined)
    ?? (user?.user_metadata?.name as string | undefined)
    ?? user?.email?.split('@')[0] ?? '—';
  const email   = user?.email ?? '—';
  const initials = rawName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  async function handleVerify() {
    if (!hasPinSet) { onUnlock(); return; }
    if (pin.length < 4) { setError('Digite os 4 dígitos do PIN.'); return; }
    setError(null);
    setLoading(true);
    try {
      // TODO Phase 7: call verify_parent_pin Edge Function
      onUnlock();
    } catch {
      setError('PIN incorreto. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmLogout() {
    setShowLogoutModal(false);
    setLoggingOut(true);
    await authService.signOut();
    setLoggingOut(false);
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={styles.root}>
      <ConfirmDialog
        visible={showLogoutModal}
        title="Sair da conta?"
        message="Você precisará fazer login novamente para acessar o app."
        primaryLabel="Continuar"
        primaryVariant="primary"
        onPrimary={() => setShowLogoutModal(false)}
        confirmLabel="Sair"
        confirmVariant="destructive"
        onConfirm={() => { void confirmLogout(); }}
        layout="stack"
      />

      <SettingsHeader title={t('settings.title')} />

      <ScrollView
        contentContainerStyle={styles.pinGateScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Parent info card */}
        <Card border shadow="sm" style={styles.parentCard}>
          <View style={styles.parentAvatar}>
            <Text style={styles.parentInitials}>{initials}</Text>
          </View>
          <View style={styles.parentInfo}>
            <Text variant="h3">{rawName}</Text>
            <Text variant="caption" color={colors.text.secondary}>{email}</Text>
          </View>
        </Card>

        {/* PIN gate */}
        <Card border shadow="sm" style={styles.pinCard}>
          <Text style={styles.pinLock}>🔒</Text>
          <Text variant="h2" align="center">{t('parentArea.pin.title')}</Text>
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

          {error && <Text variant="bodySmall" color={colors.error} align="center">{error}</Text>}

          <Button
            label={hasPinSet ? 'Confirmar' : 'Entrar nas configurações'}
            loading={loading}
            onPress={handleVerify}
          />
        </Card>

        <Button
          variant="destructive"
          label={loggingOut ? 'Saindo...' : 'Sair da conta'}
          loading={loggingOut}
          onPress={() => setShowLogoutModal(true)}
        />
      </ScrollView>
    </View>
  );
}

// ─── Per-child settings card ──────────────────────────────────────────────────

function ChildSettingsCard({ child }: { child: ChildProfile }) {
  const { t } = useTranslation();
  const router = useRouter();
  const setActiveChild = useProfileStore((s) => s.setActiveChild);
  const activeChild    = useProfileStore((s) => s.activeChild);
  const [savingTimer,     setSavingTimer]     = useState(false);
  const [savingMult,      setSavingMult]      = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [localChild,      setLocalChild]      = useState(child);
  const [questionsCount,  setQuestionsCount]  = useState<QuestionCountOption>(20);

  // Carregar setting local de questões ao montar
  useEffect(() => {
    void getChildLocalSettings(child.id).then((s) => setQuestionsCount(s.questions_count));
  }, [child.id]);

  async function handleQuestions(value: QuestionCountOption) {
    if (value === questionsCount || savingQuestions) return;
    setSavingQuestions(true);
    try {
      await setChildLocalSettings(child.id, { questions_count: value });
      setQuestionsCount(value);
    } finally { setSavingQuestions(false); }
  }

  async function handleTimer(value: TimerOption) {
    if (value === localChild.timer_seconds || savingTimer) return;
    setSavingTimer(true);
    try {
      const updated = await childService.updateChild(localChild.id, { timer_seconds: value });
      setLocalChild(updated);
      if (activeChild?.id === updated.id) setActiveChild(updated);
    } finally { setSavingTimer(false); }
  }

  async function handleMultiplication(value: MultiplicationRange) {
    if (value === localChild.multiplication_max || savingMult) return;
    setSavingMult(true);
    try {
      const updated = await childService.updateChild(localChild.id, { multiplication_max: value });
      setLocalChild(updated);
      if (activeChild?.id === updated.id) setActiveChild(updated);
    } finally { setSavingMult(false); }
  }

  return (
    <Card border shadow="sm" style={styles.childCard}>
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
          style={styles.editChildBtn}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text variant="caption" color={colors.primary}>Editar</Text>
        </TouchableOpacity>
      </View>

      {/* Nº de questões */}
      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <View style={styles.subSectionTitle}>
            <SectionIcon name="list-outline" bg={colors.primaryLight} color={colors.primary} />
            <Text variant="label">Questões por sessão</Text>
          </View>
          {savingQuestions && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.chipRow}>
          {QUESTION_COUNT_OPTIONS.map((val) => {
            const selected = questionsCount === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => void handleQuestions(val)}
              >
                <Text
                  variant="caption"
                  color={selected ? colors.text.inverse : colors.text.primary}
                  style={selected ? styles.chipTextSelected : null}
                >
                  {val === 0 ? 'AUTO' : String(val)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Timer */}
      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <View style={styles.subSectionTitle}>
            <SectionIcon name="timer-outline" bg={colors.accentLight} color={colors.accent} />
            <Text variant="label">{t('settings.timerTitle')}</Text>
          </View>
          {savingTimer && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.chipRow}>
          {TIMER_OPTIONS.map((val) => {
            const selected = localChild.timer_seconds === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => handleTimer(val)}
              >
                <Text
                  variant="caption"
                  color={selected ? colors.text.inverse : colors.text.primary}
                  style={selected ? styles.chipTextSelected : null}
                >
                  {val === 0 ? 'AUTO' : `${val}s`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Multiplication */}
      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <View style={styles.subSectionTitle}>
            <SectionIcon name="close-outline" bg={colors.successLight} color={colors.success} />
            <Text variant="label">{t('settings.multiplicationTitle')}</Text>
          </View>
          {savingMult && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.chipRow}>
          {MULTIPLICATION_RANGES.map((val) => {
            const selected = localChild.multiplication_max === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => handleMultiplication(val)}
              >
                <Text
                  variant="caption"
                  color={selected ? colors.text.inverse : colors.text.primary}
                  style={selected ? styles.chipTextSelected : null}
                >
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
  const router        = useRouter();
  const user          = useAuthStore((s) => s.user);
  const parentProfile = useAuthStore((s) => s.parentProfile);

  const rawName = (parentProfile?.name as string | undefined)
    ?? (user?.user_metadata?.name as string | undefined)
    ?? user?.email?.split('@')[0] ?? '—';
  const email   = user?.email ?? '—';
  const initials = rawName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Card border shadow="sm" style={styles.parentCardMain}>
      <View style={styles.parentAvatar}>
        <Text style={styles.parentInitials}>{initials}</Text>
      </View>
      <View style={styles.parentInfo}>
        <Text variant="h3">{rawName}</Text>
        <Text variant="caption" color={colors.text.secondary}>{email}</Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push('/(app)/parent-area/edit-profile')}
        style={styles.editParentBtn}
        accessibilityLabel="Editar dados do responsável"
      >
        <Ionicons name="create-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
    </Card>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router      = useRouter();
  const parentId    = useAuthStore(selectParentId);
  const [pinVerified, setPinVerified] = useState(false);

  useFocusEffect(useCallback(() => { setPinVerified(false); }, []));

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

  if (!pinVerified) return <PinGate onUnlock={() => setPinVerified(true)} />;

  return (
    <View style={styles.root}>
      <SettingsHeader title={t('settings.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Parent card ──────────────────────────────────────────── */}
        <ParentCard />

        {/* ── Language ─────────────────────────────────────────────── */}
        <Card border shadow="sm" style={styles.section}>
          <View style={styles.sectionTitle}>
            <SectionIcon name="globe-outline" bg={colors.primaryLight} color={colors.primary} />
            <Text variant="h3">{t('settings.language')}</Text>
          </View>
          <View style={styles.localeGrid}>
            {SUPPORTED_LOCALES.map((locale) => {
              const selected = currentLocale === locale;
              const { flag, code } = LOCALE_LABEL[locale];
              return (
                <TouchableOpacity
                  key={locale}
                  style={[styles.localeBtn, selected ? styles.localeBtnSelected : null]}
                  onPress={() => handleLocale(locale)}
                >
                  <View style={styles.localeBtnLeft}>
                    <Text style={styles.localeFlag}>{flag}</Text>
                    <Text
                      variant="label"
                      color={selected ? colors.primary : colors.text.primary}
                    >
                      {code}
                    </Text>
                  </View>
                  {selected && (
                    <View style={styles.localeCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* ── Per-child settings ────────────────────────────────────── */}
        <View style={styles.sectionTitle}>
          <SectionIcon name="people-outline" bg={colors.primaryLight} color={colors.primary} />
          <Text variant="h3">{t('profileSelect.title')}</Text>
        </View>

        {isLoading && <ActivityIndicator color={colors.primary} />}
        {children.map((child) => <ChildSettingsCard key={child.id} child={child} />)}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },

  header: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.xs,
  },
  appName: {
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  } as import('react-native').TextStyle,

  // ── PIN gate ────────────────────────────────────────────────────────────────
  pinGateScroll: { padding: space.md, paddingBottom: space['2xl'], gap: space.md },
  parentCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pinCard: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  pinLock: { fontSize: 44 },
  pinInput: {
    width: 160,
    height: 52,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border.focus,
    backgroundColor: colors.background.card,
    fontSize: 24,
    letterSpacing: 8,
    color: colors.text.primary,
    textAlign: 'center',
  },

  // ── Parent card ─────────────────────────────────────────────────────────────
  parentCardMain: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  parentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  parentInitials: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 24,
    fontFamily: fontFamily.extraBold,
  } as import('react-native').TextStyle,
  parentInfo: { flex: 1, gap: 2 },
  editParentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Content ─────────────────────────────────────────────────────────────────
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  section: { gap: space.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  // ── Language grid ────────────────────────────────────────────────────────────
  localeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  localeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '47%',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
  },
  localeBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  localeBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  localeFlag: { fontSize: 20 },
  localeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Child card ───────────────────────────────────────────────────────────────
  childCard: { gap: space.md },
  childHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  childInfo: { flex: 1, gap: 2 },
  editChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.primaryLight,
  },

  // ── Sub-sections ─────────────────────────────────────────────────────────────
  subSection: { gap: space.sm },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
  chipTextSelected: { fontFamily: fontFamily.bold } as import('react-native').TextStyle,
});
