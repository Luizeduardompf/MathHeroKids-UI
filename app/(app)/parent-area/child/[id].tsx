import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Alert present at runtime
import { Alert } from 'react-native'; // eslint-disable-line
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { AvatarPicker, Button, Input, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { colors, fontFamily, radius, shadows, space } from '@/theme';
import { TIMER_OPTIONS, MULTIPLICATION_RANGES, type TimerOption, type MultiplicationRange } from '@/constants/config';
import type { AvatarId } from '@/constants/config';
import type { ChildProfile } from '@/types';

const LANG_TO_LOCALE: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

function formatDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return '—';
  const locale = LANG_TO_LOCALE[language] ?? 'en-US';
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string | null | undefined, language: string): string {
  if (!iso) return '—';
  const locale = LANG_TO_LOCALE[language] ?? 'en-US';
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

function applyDateMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDate(raw: string): string | null {
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return null;
  const date = new Date(`${yyyy}-${mm}-${dd}`);
  if (isNaN(date.getTime())) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function formatDateForDisplay(isoDate: string | null): string {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

export default function EditarCriancaScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parentId = useAuthStore(selectParentId);
  const activeChild = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((s) => s.setActiveChild);
  const clearActiveChild = useProfileStore((s) => s.clearActiveChild);

  const [child, setChild] = useState<ChildProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [avatar, setAvatar] = useState<AvatarId>('sofia');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [timerSeconds, setTimerSeconds] = useState<TimerOption>(15);
  const [multiMax, setMultiMax] = useState<MultiplicationRange>(10);
  const [socialEnabled, setSocialEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete flow
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load child by ID
  useEffect(() => {
    if (!parentId || !id) return;
    childService.listChildren(parentId).then((children) => {
      const found = children.find((c) => c.id === id) ?? null;
      if (!found) { setLoadError('Perfil não encontrado.'); return; } // i18n-ignore — internal error state
      setChild(found);
      setAvatar(found.avatar_id);
      setName(found.display_name);
      setUsername(found.username);
      setBirthDate(formatDateForDisplay(found.birth_date));
      if (found.timer_seconds !== undefined) setTimerSeconds(found.timer_seconds as TimerOption);
      if (found.multiplication_max !== undefined) setMultiMax(found.multiplication_max as MultiplicationRange);
      setSocialEnabled(found.social_enabled ?? true);
    }).catch(() => setLoadError('Erro ao carregar perfil.')); // i18n-ignore — internal error state
  }, [id, parentId]);

  function validate(): string | null {
    if (!name.trim()) return t('errors.validation.required');
    if (name.trim().length < 2) return t('errors.validation.nameTooShort');
    if (!username.trim()) return t('errors.validation.required');
    if (!USERNAME_REGEX.test(username.trim())) return t('errors.validation.usernameFormat');
    if (birthDate && !parseBirthDate(birthDate)) return t('errors.validation.invalidDate');
    return null;
  }

  async function handleSave() {
    if (!child) return;
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      const updated = await childService.updateChild(child.id, {
        display_name: name.trim(),
        username: username.trim(),
        avatar_id: avatar,
        birth_date: birthDate ? parseBirthDate(birthDate) : child.birth_date,
        timer_seconds: timerSeconds,
        multiplication_max: multiMax,
        social_enabled: socialEnabled,
      });
      // Keep store in sync if editing the active child
      if (activeChild?.id === child.id) setActiveChild(updated);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!child) return;
    if (deleteConfirmText.trim().toLowerCase() !== child.username.toLowerCase()) {
      setDeleteError(t('parentArea.child.deleteMismatch'));
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await childService.deleteChild(child.id);
      await queryClient.invalidateQueries({ queryKey: ['children', parentId] });
      if (activeChild?.id === child.id) clearActiveChild();
      router.back();
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  }

  function handleDeletePress() {
    if (!child) return;
    Alert.alert(
      t('parentArea.child.deleteBtn'),
      t('parentArea.child.deleteWarning', { name: child.display_name }),
      [
        { text: t('parentArea.child.deleteCancelBtn'), style: 'cancel' },
        {
          text: t('parentArea.child.deleteBtn'),
          style: 'destructive',
          onPress: () => { setDeleteConfirmText(''); setDeleteError(null); setShowDeleteConfirm(true); },
        },
      ],
    );
  }

  // ── Loading / error state ─────────────────────────────────────────────────
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text variant="body" color={colors.error}>{loadError}</Text>
        <Button label={t('common.back')} onPress={() => router.back()} />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header — gradient pattern */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={styles.headerCenter}>
              <RNText style={styles.headerSub}>Math Hero Kids</RNText>
              <RNText style={styles.headerTitle}>{child.display_name}</RNText>
            </View>
            <View style={{ width: 42 }} />
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar selector */}
        <Text variant="label" style={styles.sectionLabel}>
          {t('auth.register.child.avatarLabel')}
        </Text>
        <AvatarPicker selected={avatar} onSelect={setAvatar} style={styles.avatarGrid} />

        {/* ── Account info (read-only) ─────────────────────────────── */}
        {/* Form fields */}
        <View style={styles.form}>
          <Input
            label={t('auth.register.child.nameLabel')}
            placeholder={t('auth.register.child.namePlaceholder')}
            value={name}
            onChangeText={(v: string) => { setName(v); setError(null); }}
            autoCapitalize="words"
          />
          <Input
            label={t('auth.register.child.usernameLabel')}
            placeholder={t('auth.register.child.usernamePlaceholder')}
            hint={t('auth.register.child.usernameHint')}
            value={username}
            onChangeText={(v: string) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('auth.register.child.birthDateLabel')}
            placeholder="dd/mm/yyyy"
            hint={t('auth.register.child.birthDateHint')}
            value={birthDate}
            onChangeText={(v: string) => { setBirthDate(applyDateMask(v)); setError(null); }}
            keyboardType="number-pad"
            maxLength={10}
          />

          {error ? (
            <Text variant="bodySmall" color={colors.error}>{error}</Text>
          ) : null}
        </View>

        {/* ── Game settings ──────────────────────────────────────── */}
        <Text variant="h3" style={styles.sectionLabel}>{t('parentArea.child.gameSettings')}</Text>

        {/* Timer */}
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="timer-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.timerLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.timerHint')}</Text>
            </View>
          </View>
          <View style={styles.optionRow}>
            {TIMER_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.optionBtn, timerSeconds === opt && styles.optionBtnActive]}
                onPress={() => setTimerSeconds(opt)}
              >
                <RNText style={[styles.optionText, timerSeconds === opt && styles.optionTextActive]}>
                  {opt === 0 ? '∞' : `${opt}s`}
                </RNText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Multiplication max */}
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="calculator-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.tablesLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.tablesHint')}</Text>
            </View>
          </View>
          <View style={styles.optionRow}>
            {MULTIPLICATION_RANGES.map((opt) => (
              <Pressable
                key={opt}
                style={[styles.optionBtn, multiMax === opt && styles.optionBtnActive]}
                onPress={() => setMultiMax(opt)}
              >
                <RNText style={[styles.optionText, multiMax === opt && styles.optionTextActive]}>
                  {`×${opt}`}
                </RNText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Social enabled */}
        <Pressable style={styles.settingCard} onPress={() => setSocialEnabled((v) => !v)}>
          <View style={styles.settingHeader}>
            <View style={styles.settingIcon}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('parentArea.child.socialLabel')}</Text>
              <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.socialHint')}</Text>
            </View>
            <View style={[styles.toggle, socialEnabled && styles.toggleOn]}>
              <View style={[styles.toggleThumb, socialEnabled && styles.toggleThumbOn]} />
            </View>
          </View>
        </Pressable>

        <Button
          label={t('parentArea.child.save')}
          loading={saving}
          onPress={handleSave}
          style={styles.saveBtn}
        />

        {/* Account info — discreto, no fundo */}
        <View style={styles.statsFooter}>
          <View style={styles.statsFooterRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.text.tertiary} />
            <RNText style={styles.statsFooterText}>
              {t('parentArea.child.registeredSince')}: {formatDate(child.created_at, i18n.language)}
            </RNText>
          </View>
          <View style={styles.statsFooterRow}>
            <Ionicons name="time-outline" size={13} color={colors.text.tertiary} />
            <RNText style={styles.statsFooterText}>
              {t('parentArea.child.lastAccess')}: {formatDateTime(child.last_seen_at, i18n.language)}
            </RNText>
          </View>
        </View>

        {/* ── Danger zone ─────────────────────────────────────────── */}
        <View style={styles.dangerZone}>
          <Text variant="label" color={colors.error}>{t('parentArea.child.dangerZoneTitle')}</Text>
          <Text variant="caption" color={colors.text.secondary}>{t('parentArea.child.dangerZoneHint')}</Text>

          {!showDeleteConfirm ? (
            <Button
              label={t('parentArea.child.deleteBtn')}
              onPress={handleDeletePress}
              variant="destructive"
              style={styles.deleteBtn}
            />
          ) : (
            <View style={styles.deleteConfirmBox}>
              <Text variant="bodySmall" color={colors.error}>
                {t('parentArea.child.deleteWarning', { name: child.display_name })}
              </Text>
              <Input
                label={t('parentArea.child.deleteConfirmLabel', { username: child.username })}
                placeholder={t('parentArea.child.deleteConfirmPlaceholder')}
                value={deleteConfirmText}
                onChangeText={(v: string) => { setDeleteConfirmText(v); setDeleteError(null); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {deleteError ? (
                <Text variant="bodySmall" color={colors.error}>{deleteError}</Text>
              ) : null}
              <View style={styles.deleteConfirmActions}>
                <Button
                  label={t('parentArea.child.deleteCancelBtn')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  style={styles.deleteConfirmActionBtn}
                />
                <Button
                  label={t('parentArea.child.deleteConfirmBtn')}
                  variant="destructive"
                  fullWidth={false}
                  onPress={handleDeleteConfirm}
                  loading={deleting}
                  style={styles.deleteConfirmActionBtn}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  header:       { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 },
  headerTitle:  { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' },
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  milo: { marginBottom: space.sm },
  sectionLabel: { marginBottom: space.sm },

  // ── Account stats — discreto no fundo ───────────────────────────────────────
  statsFooter: {
    gap: 6,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    alignItems: 'flex-start',
  },
  statsFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statsFooterText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.text.tertiary,
  },
  avatarGrid: { marginBottom: space.md },
  form: { gap: space.md },
  saveBtn: { marginTop: space.sm },

  // ── Danger zone ──────────────────────────────────────────────────────────────
  dangerZone: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: `${colors.error}40`,
    backgroundColor: `${colors.error}0D`,
    gap: 6,
  },
  deleteBtn: { marginTop: space.sm },
  deleteConfirmBox: { marginTop: space.sm, gap: space.sm },
  deleteConfirmActions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  deleteConfirmActionBtn: { flex: 1 },

  // ── Game settings ────────────────────────────────────────────────────────────
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
    ...shadows.sm,
  },
  settingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.background.cardAlt,
  },
  optionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    fontFamily: fontFamily.semiBold, fontSize: 14,
    color: colors.text.secondary,
  },
  optionTextActive: { color: colors.primary },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: colors.border.default,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
