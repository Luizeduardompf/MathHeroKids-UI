import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
import { AVATAR_IDS } from '@/constants/config';
import { AVATAR_ICONS } from '@/constants/icons';
import { colors, radius, space } from '@/theme';
import type { AvatarId } from '@/constants/config';
import type { ChildProfile } from '@/types';

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
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parentId = useAuthStore(selectParentId);
  const activeChild = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((s) => s.setActiveChild);

  const [child, setChild] = useState<ChildProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [avatar, setAvatar] = useState<AvatarId>('sofia');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load child by ID
  useEffect(() => {
    if (!parentId || !id) return;
    childService.listChildren(parentId).then((children) => {
      const found = children.find((c) => c.id === id) ?? null;
      if (!found) { setLoadError('Perfil não encontrado.'); return; }
      setChild(found);
      setAvatar(found.avatar_id);
      setName(found.display_name);
      setUsername(found.username);
      setBirthDate(formatDateForDisplay(found.birth_date));
    }).catch(() => setLoadError('Erro ao carregar perfil.'));
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
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <RNText style={styles.backArrow}>‹</RNText>
          </Pressable>
          <View>
            <Text variant="caption" color="rgba(255,255,255,0.8)">
              {t('parentArea.child.editTitle')}
            </Text>
            <Text variant="h2" color={colors.text.inverse}>{child.display_name}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <MiloMessage
          message={t('milo.keep_going')}
          variant="orange"
          style={styles.milo}
        />

        {/* Avatar selector */}
        <Text variant="label" style={styles.sectionLabel}>
          {t('auth.register.child.avatarLabel')}
        </Text>
        <View style={styles.avatarGrid}>
          {AVATAR_IDS.map((aid) => (
            <Pressable
              key={aid}
              onPress={() => setAvatar(aid)}
              style={[
                styles.avatarItem,
                avatar === aid && styles.avatarSelected,
              ] as import('react-native').StyleProp<import('react-native').ViewStyle>}
            >
              <RNText style={styles.avatarEmoji}>{AVATAR_ICONS[aid]}</RNText>
            </Pressable>
          ))}
        </View>

        {/* Form fields */}
        <View style={styles.form}>
          <Input
            label={t('auth.register.child.nameLabel')}
            placeholder={t('auth.register.child.namePlaceholder')}
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            autoCapitalize="words"
          />
          <Input
            label={t('auth.register.child.usernameLabel')}
            placeholder={t('auth.register.child.usernamePlaceholder')}
            hint={t('auth.register.child.usernameHint')}
            value={username}
            onChangeText={(v) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('auth.register.child.birthDateLabel')}
            placeholder="dd/mm/yyyy"
            hint={t('auth.register.child.birthDateHint')}
            value={birthDate}
            onChangeText={(v) => { setBirthDate(applyDateMask(v)); setError(null); }}
            keyboardType="number-pad"
            maxLength={10}
          />

          {error ? (
            <Text variant="bodySmall" color={colors.error}>{error}</Text>
          ) : null}
        </View>

        <Button
          label={t('parentArea.child.save')}
          loading={saving}
          onPress={handleSave}
          style={styles.saveBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  safeHeader: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  backBtn: { padding: 4 },
  backArrow: { fontSize: 28, color: colors.text.inverse, lineHeight: 32 },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  milo: { marginBottom: space.sm },
  sectionLabel: { marginBottom: space.sm },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  avatarItem: {
    width: 60, height: 60, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
    backgroundColor: colors.background.cardAlt,
  },
  avatarSelected: { borderColor: colors.primary, backgroundColor: colors.background.card },
  avatarEmoji: { fontSize: 36 },
  form: { gap: space.md },
  saveBtn: { marginTop: space.sm },
});
