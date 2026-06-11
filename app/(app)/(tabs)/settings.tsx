import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-expect-error RN 0.85 quirk — Alert present at runtime
import { Alert } from 'react-native'; // eslint-disable-line
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { Avatar, Button, Card, ConfirmDialog, Text } from '@/components/ui';
import { childService, getChildLocalSettings, setChildLocalSettings } from '@/services/child.service';
import { authService } from '@/services/auth.service';
import { pinService } from '@/services/pin.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { SUPPORTED_LOCALES, TIMER_OPTIONS, MULTIPLICATION_RANGES, QUESTION_COUNT_OPTIONS } from '@/constants/config';
import type { SupportedLocale, TimerOption, MultiplicationRange, QuestionCountOption } from '@/constants/config';
import type { ChildProfile } from '@/types';
import { changeLocale, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { colors, fontFamily, radius, shadows, space } from '@/theme';

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

function SettingsHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView edges={['top']}>
        <View style={[styles.header, onBack ? styles.headerWithBack : null]}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.headerBackBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={styles.appName}>Math Hero Kids</Text>
            <Text variant="h1" color={colors.text.inverse}>{title}</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── PIN dots ─────────────────────────────────────────────────────────────────

function PinDots({ count, total = 4 }: { count: number; total?: number }) {
  return (
    <View style={pinStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[pinStyles.dot, i < count ? pinStyles.dotFilled : pinStyles.dotEmpty]} />
      ))}
    </View>
  );
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────
// Full-screen PIN verification with numeric keypad — shown before settings open.
// If no PIN is set → calls onUnlock() immediately on mount.

function PinGate({ onUnlock, onCancel }: { onUnlock: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const user     = useAuthStore((s) => s.user);
  const parentId = useAuthStore(selectParentId);

  const [digits,    setDigits]    = useState<number[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [checking,  setChecking]  = useState(true);
  const [sending,   setSending]   = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Check on mount: if no PIN, go straight through
  useEffect(() => {
    if (!parentId) { onUnlock(); return; }
    void (async () => {
      const pin = await pinService.getPin(parentId);
      if (!pin) onUnlock();
      else setChecking(false);
    })();
  }, [parentId, onUnlock]);

  function handleDigit(d: number) {
    setError(null);
    setDigits((prev) => {
      if (prev.length >= 4) return prev;
      const next = [...prev, d];
      if (next.length === 4) void verify(next.join(''));
      return next;
    });
  }

  async function verify(pin: string) {
    if (!parentId) return;
    const ok = await pinService.verify(parentId, pin);
    if (ok) { onUnlock(); }
    else    { setDigits([]); setError(t('parentArea.pin.wrongPin')); }
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
    } finally { setSending(false); }
  }

  async function confirmLogout() {
    setShowLogoutModal(false);
    setLoggingOut(true);
    await authService.signOut();
    setLoggingOut(false);
    router.replace('/(auth)/welcome');
  }

  if (checking) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const topKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  return (
    <View style={styles.root}>
      <ConfirmDialog
        visible={showLogoutModal}
        title={t('settings.logoutTitle')}
        message={t('settings.logoutMessage')}
        primaryLabel={t('common.continue')}
        primaryVariant="primary"
        onPrimary={() => setShowLogoutModal(false)}
        confirmLabel={t('settings.logoutConfirm')}
        confirmVariant="destructive"
        onConfirm={() => { void confirmLogout(); }}
        layout="stack"
      />

      <SettingsHeader title={t('settings.title')} onBack={onCancel} />

      <View style={pinStyles.content}>
        {/* Lock icon */}
        <View style={pinStyles.lockCircle}>
          <Ionicons name="lock-closed-outline" size={36} color={colors.primary} />
        </View>

        <Text variant="h2" align="center">{t('parentArea.pin.title')}</Text>
        <Text variant="body" color={colors.text.secondary} align="center" style={{ marginTop: -4 }}>
          {t('parentArea.pin.subtitle')}
        </Text>

        <PinDots count={digits.length} />

        {error
          ? <Text variant="bodySmall" color={colors.error} align="center">{error}</Text>
          : <View style={{ height: 18 }} />
        }

        {/* Numeric keypad */}
        <View style={pinStyles.keypad}>
          {topKeys.map((k) => (
            <Pressable key={k} style={({ pressed }) => [pinStyles.key, pressed ? pinStyles.keyPressed : null]}
              onPress={() => handleDigit(k)}>
              <Text style={pinStyles.keyText}>{k}</Text>
            </Pressable>
          ))}
          <View style={pinStyles.key} />
          <Pressable style={({ pressed }) => [pinStyles.key, pressed ? pinStyles.keyPressed : null]}
            onPress={() => handleDigit(0)}>
            <Text style={pinStyles.keyText}>0</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [pinStyles.key, pinStyles.keyMuted, pressed ? pinStyles.keyPressed : null]}
            onPress={() => setDigits((p) => { setError(null); return p.slice(0, -1); })}>
            <Ionicons name="backspace-outline" size={26} color="#6B7280" />
          </Pressable>
        </View>

        {/* Forgot PIN + Sign out — acima da tab bar */}
        <View style={[pinStyles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={handleForgotPin} disabled={sending} hitSlop={8}>
            {sending
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text variant="bodySmall" color={colors.primary}>{t('parentArea.pin.forgotPin')}</Text>
            }
          </Pressable>
          <Pressable onPress={() => setShowLogoutModal(true)} hitSlop={8}>
            {loggingOut
              ? <ActivityIndicator color={colors.error} size="small" />
              : <Text variant="bodySmall" color={colors.error}>{t('settings.logout')}</Text>
            }
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  content:    { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 20, gap: 14 },
  lockCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  row:        { flexDirection: 'row', gap: 16 },
  dot:        { width: 16, height: 16, borderRadius: 8 },
  dotFilled:  { backgroundColor: colors.primary },
  dotEmpty:   { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#CBD5E1' },
  // Grid: 3 colunas fixas com flex, evita width:'30%' que quebra com gap no iOS
  keypad:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  key:        { flex: 1, minWidth: 88, height: 72, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: 0, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  keyMuted:   { backgroundColor: '#EDEEF5' },
  keyPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  // bold (não extraBold) para evitar stylistic alternates do Nunito no iOS 26
  keyText:    { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, color: '#1A1F36', fontVariant: ['tabular-nums'] } as import('react-native').TextStyle,
  footer:     { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8, marginTop: 4, paddingBottom: 16 },
});

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
          <Text variant="caption" color={colors.primary}>{t('common.edit')}</Text>
        </TouchableOpacity>
      </View>

      {/* Nº de questões */}
      <View style={styles.subSection}>
        <View style={styles.subSectionHeader}>
          <View style={styles.subSectionTitle}>
            <SectionIcon name="list-outline" bg={colors.primaryLight} color={colors.primary} />
            <Text variant="label">{t('settings.questionsTitle')}</Text>
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
  const { t }         = useTranslation();
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
        accessibilityLabel={t('settings.editParentLabel')}
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
  const [showPinGate,      setShowPinGate]      = useState(false);
  const [showLogoutModal,  setShowLogoutModal]  = useState(false);
  const [loggingOut,       setLoggingOut]       = useState(false);

  const currentLocale = i18n.language as SupportedLocale;

  async function handleLocale(locale: SupportedLocale) {
    changeLocale(locale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  async function handleLogout() {
    setShowLogoutModal(false);
    setLoggingOut(true);
    try {
      await authService.signOut();
      router.replace('/(auth)/welcome');
    } finally {
      setLoggingOut(false);
    }
  }

  // Show PIN gate inline — has back button via onCancel prop
  if (showPinGate) {
    return (
      <PinGate
        onUnlock={() => {
          setShowPinGate(false);
          router.push('/(app)/parent-area/');
        }}
        onCancel={() => setShowPinGate(false)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ConfirmDialog
        visible={showLogoutModal}
        title={t('settings.logoutTitle')}
        message={t('settings.logoutMessage')}
        primaryLabel={t('common.continue')}
        primaryVariant="primary"
        onPrimary={() => setShowLogoutModal(false)}
        confirmLabel={t('settings.logoutConfirm')}
        confirmVariant="destructive"
        onConfirm={() => { void handleLogout(); }}
        layout="stack"
      />
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

        {/* ── Parent area ──────────────────────────────────────────── */}
        <Pressable
          style={styles.parentAreaBtn}
          onPress={() => setShowPinGate(true)}
        >
          <View style={styles.parentAreaLeft}>
            <View style={styles.parentAreaIcon}>
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.title')}</Text>
              <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 1 }}>
                {t('parentArea.subtitle')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </Pressable>

      </ScrollView>

      {/* ── Sign out — fixed above tab bar ───────────────────────── */}
      <View style={styles.signOutBar}>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed ? styles.signOutBtnPressed : null]}
          onPress={() => setShowLogoutModal(true)}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text variant="label" color={colors.error}>{t('settings.logout')}</Text>
            </>
          )}
        </Pressable>
      </View>
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
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  } as import('react-native').TextStyle,

  // ── Parent area button ───────────────────────────────────────────────────────
  parentAreaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    ...shadows.sm,
  },
  parentAreaLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 },
  parentAreaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Sign out bar (fixed at bottom, above tab bar) ───────────────────────────
  signOutBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.primary,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 14,
    borderRadius: radius.xl,
    backgroundColor: '#FEF2F2', // red-50 — subtle destructive tint
  },
  signOutBtnPressed: {
    opacity: 0.75,
  },

  // ── Parent card ─────────────────────────────────────────────────────────────
  parentCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },

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
