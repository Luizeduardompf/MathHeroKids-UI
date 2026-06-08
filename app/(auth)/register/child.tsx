import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text } from '@/components/ui';
import { Screen } from '@/components/layout/Screen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { childService } from '@/services/child.service';
import { AVATAR_IDS } from '@/constants/config';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { colors, radius, space } from '@/theme';
import type { AvatarId } from '@/constants/config';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/** Parse "dd/mm/yyyy" → "YYYY-MM-DD" or null if invalid. */
function parseBirthDate(raw: string): string | null {
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return null;
  const date = new Date(`${yyyy}-${mm}-${dd}`);
  if (isNaN(date.getTime())) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// Avatar emoji map — temporary until real avatar assets land in Phase 2
const AVATAR_EMOJI: Record<AvatarId, string> = {
  sofia: '👧',
  gabriel: '👦',
  pedro: '🧒',
  ana: '👧🏽',
  theo: '👦🏻',
  mia: '👧🏼',
};

export default function RegisterChildScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const parentId = useAuthStore(selectParentId);

  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>('sofia');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return t('errors.validation.required');
    if (!username.trim()) return t('errors.validation.required');
    if (!USERNAME_REGEX.test(username.trim())) return t('errors.validation.usernameFormat');
    // Birth date is optional — but if filled, must be valid dd/mm/yyyy
    if (birthDate.trim() && !parseBirthDate(birthDate.trim())) {
      return t('errors.validation.invalidDate');
    }
    return null;
  }

  async function handleCreate() {
    setError(null);
    if (!parentId) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await childService.createChild(parentId, {
        display_name: name.trim(),
        username: username.trim(),
        birth_date: parseBirthDate(birthDate),
        avatar_id: selectedAvatar,
      });
      router.replace('/(profile-select)/');
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scrollable padded>
      <View style={styles.header}>
        <Text variant="caption">{t('auth.register.child.stepIndicator')}</Text>
        <Text variant="h1">{t('auth.register.child.title')}</Text>
      </View>

      <MiloMessage message={t('auth.register.child.miloMessage')} variant="orange" style={styles.milo} />

      {/* Avatar selector */}
      <Text variant="label" style={styles.sectionLabel}>{t('auth.register.child.avatarLabel')}</Text>
      <View style={styles.avatarGrid}>
        {AVATAR_IDS.map((id) => (
          <Pressable
            key={id}
            onPress={() => setSelectedAvatar(id)}
            style={[styles.avatarItem, selectedAvatar === id ? styles.avatarSelected : null] as import("react-native").StyleProp<import("react-native").ViewStyle>}
          >
            <Text style={styles.avatarEmoji}>{AVATAR_EMOJI[id]}</Text>
          </Pressable>
        ))}
      </View>

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
          onChangeText={(v: string) => { setBirthDate(v); setError(null); }}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        {error ? (
          <Text variant="bodySmall" color={colors.error}>{error}</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={t('auth.register.child.submit')}
          loading={loading}
          onPress={handleCreate}
        />
        <Text variant="bodySmall" align="center">{t('auth.register.child.addMoreLater')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.xs },
  milo: { marginBottom: space.lg },
  sectionLabel: { marginBottom: space.sm },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  avatarItem: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.background.cardAlt,
  },
  avatarSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.background.card,
  },
  avatarEmoji: { fontSize: 36 },
  form: { gap: space.md },
  actions: { marginTop: space.xl, gap: space.md, paddingBottom: space.lg },
});
