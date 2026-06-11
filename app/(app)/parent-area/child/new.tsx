import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { AvatarPicker, Button, Card, Input, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { childService } from '@/services/child.service';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { colors, space } from '@/theme';
import type { AvatarId } from '@/constants/config';

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

export default function NovaFilhaScreen() {
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
    if (name.trim().length < 2) return t('errors.validation.nameTooShort');
    if (!username.trim()) return t('errors.validation.required');
    if (!USERNAME_REGEX.test(username.trim())) return t('errors.validation.usernameFormat');
    if (!birthDate.trim()) return t('errors.validation.required');
    if (!parseBirthDate(birthDate.trim())) return t('errors.validation.invalidDate');
    return null;
  }

  async function handleCreate() {
    setError(null);
    if (!parentId) return;
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      await childService.createChild(parentId, {
        display_name: name.trim(),
        username: username.trim(),
        birth_date: parseBirthDate(birthDate),
        avatar_id: selectedAvatar,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title={t('parentArea.child.newTitle')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <MiloMessage message={t('parentArea.child.miloNewMessage')} variant="orange" />

      <Card border shadow="sm">
        <Text variant="label" style={styles.sectionLabel}>{t('auth.register.child.avatarLabel')}</Text>
        <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
      </Card>

      <Card border shadow="sm">
        <View style={styles.form}>
          <Input
            label={t('auth.register.child.nameLabel')}
            placeholder={t('auth.register.child.namePlaceholder')}
            value={name}
            onChangeText={(v: string) => { setName(v); setError(null); }}
            autoCapitalize="words"
            leftIcon={<Ionicons name="person-outline" size={20} color={colors.text.tertiary} />}
          />
          <Input
            label={t('auth.register.child.usernameLabel')}
            placeholder={t('auth.register.child.usernamePlaceholder')}
            hint={t('auth.register.child.usernameHint')}
            value={username}
            onChangeText={(v: string) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Ionicons name="at-outline" size={20} color={colors.text.tertiary} />}
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

          {error ? <Text variant="bodySmall" color={colors.error}>{error}</Text> : null}

          <Button
            label={t('parentArea.child.create')}
            loading={loading}
            onPress={handleCreate}
          />
        </View>
      </Card>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: space.sm },
  form: { gap: space.md },
});
