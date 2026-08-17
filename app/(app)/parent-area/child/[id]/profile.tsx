import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';

import { AvatarPicker, Button, Input, ScreenHeader, Text } from '@/components/ui';
import { childService } from '@/services/child.service';
import { useChild } from '@/hooks/use-child';
import { useAuthStore, selectParentId } from '@/stores/auth.store';
import { useProfileStore, selectActiveChild } from '@/stores/profile.store';
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

function formatDateForDisplay(isoDate: string | null): string {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

export default function ChildProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parentId = useAuthStore(selectParentId);
  const activeChild = useProfileStore(selectActiveChild);
  const setActiveChild = useProfileStore((st) => st.setActiveChild);

  const { child, isLoading, isError } = useChild(id);
  const initialized = useRef(false);

  const [avatar, setAvatar] = useState<AvatarId>('sofia');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [whatsappDdi, setWhatsappDdi] = useState('351');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!child || initialized.current) return;
    initialized.current = true;
    setAvatar(child.avatar_id);
    setName(child.display_name);
    setUsername(child.username);
    setBirthDate(formatDateForDisplay(child.birth_date));
    setWhatsappDdi(child.whatsapp_phone_ddi || '351');
    setWhatsappPhone(child.whatsapp_phone ?? '');
  }, [child]);

  function validate(): string | null {
    if (!name.trim()) return t('errors.validation.required');
    if (name.trim().length < 2) return t('errors.validation.nameTooShort');
    if (!username.trim()) return t('errors.validation.required');
    if (!USERNAME_REGEX.test(username.trim())) return t('errors.validation.usernameFormat');
    if (birthDate && !parseBirthDate(birthDate)) return t('errors.validation.invalidDate');
    return null;
  }

  const mutation = useMutation({
    mutationFn: () => childService.updateChild(child!.id, {
      display_name: name.trim(),
      username: username.trim(),
      avatar_id: avatar,
      birth_date: birthDate ? parseBirthDate(birthDate) : child!.birth_date,
      whatsapp_phone: whatsappPhone.trim() || null,
      whatsapp_phone_ddi: whatsappDdi.trim() || '351',
    }),
    onSuccess: async (updated) => {
      if (activeChild?.id === updated.id) setActiveChild(updated);
      await queryClient.invalidateQueries({ queryKey: ['children', parentId] });
      router.back();
    },
    onError: (e) => setError((e as Error).message),
  });

  function handleSave() {
    if (!child) return;
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    mutation.mutate();
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !child) {
    return (
      <View style={s.center}>
        <Text variant="body" color={colors.error}>{t('parentArea.child.loadError')}</Text>
        <Button label={t('common.back')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader
        title={child.display_name}
        subtitle={t('parentArea.child.menuProfileLabel')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text variant="label" style={s.sectionLabel}>
          {t('auth.register.child.avatarLabel')}
        </Text>
        <AvatarPicker selected={avatar} onSelect={setAvatar} style={s.avatarGrid} />

        <View style={s.form}>
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

          <View style={s.whatsappRow}>
            <Input
              label={t('parentArea.whatsappDdiLabel')}
              placeholder="351"
              value={whatsappDdi}
              onChangeText={(v: string) => setWhatsappDdi(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              containerStyle={s.whatsappDdiField}
            />
            <Input
              label={t('parentArea.child.whatsappNumberLabel')}
              hint={t('parentArea.child.whatsappNumberHint')}
              placeholder={t('parentArea.whatsappNumberPlaceholder')}
              value={whatsappPhone}
              onChangeText={(v: string) => setWhatsappPhone(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              leftIcon={<Ionicons name="logo-whatsapp" size={20} color="#25D366" />}
              containerStyle={s.whatsappNumberField}
            />
          </View>

          {error ? (
            <Text variant="bodySmall" color={colors.error}>{error}</Text>
          ) : null}

          <Button
            label={t('parentArea.child.save')}
            loading={mutation.isPending}
            onPress={handleSave}
            style={s.saveBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  content: { padding: space.md, gap: space.md, paddingBottom: space['2xl'] },
  sectionLabel: { marginBottom: space.sm },
  avatarGrid: { marginBottom: space.md },
  form: { gap: space.md },
  saveBtn: { marginTop: space.sm },
  whatsappRow: { flexDirection: 'row', gap: space.sm },
  whatsappDdiField: { width: 72 },
  whatsappNumberField: { flex: 1 },
});
