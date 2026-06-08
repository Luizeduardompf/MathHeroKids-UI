import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Text } from '@/components/ui';
import { Screen } from '@/components/layout/Screen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { authService } from '@/services/auth.service';
import { colors, radius, space } from '@/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterParentScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return t('errors.validation.required');
    if (name.trim().length < 2) return t('errors.validation.nameTooShort');
    if (!email.trim()) return t('errors.validation.required');
    if (!EMAIL_REGEX.test(email.trim())) return t('errors.validation.invalidEmail');
    if (!password) return t('errors.validation.required');
    if (password.length < 8) return t('errors.auth.weakPassword');
    if (!termsAccepted) return t('errors.validation.termsRequired');
    return null;
  }

  async function handleSignUp() {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const result = await authService.signUp({ name, email, password });
    setLoading(false);

    if (result.error) {
      setError(t(result.error));
      return;
    }

    // Signed up successfully → proceed to create first child
    // Note: we stay in (auth) group intentionally. The (app) guard won't fire
    // because we never navigate there until the child is created.
    router.push('/(auth)/register/child');
  }

  return (
    <Screen scrollable padded>
      <View style={styles.header}>
        <Text variant="caption">{t('auth.register.parent.stepIndicator')}</Text>
        <Text variant="h1">{t('auth.register.parent.title')}</Text>
      </View>

      <MiloMessage message={t('auth.register.parent.miloMessage')} style={styles.milo} />

      <View style={styles.form}>
        <Input
          label={t('auth.register.parent.nameLabel')}
          placeholder={t('auth.register.parent.namePlaceholder')}
          value={name}
          onChangeText={(v: string) => { setName(v); setError(null); }}
          autoComplete="name"
          autoCapitalize="words"
          leftIcon={<Ionicons name="person-outline" size={20} color={colors.text.tertiary} />}
        />
        <Input
          label={t('auth.register.parent.emailLabel')}
          placeholder={t('auth.register.parent.emailPlaceholder')}
          value={email}
          onChangeText={(v: string) => { setEmail(v); setError(null); }}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          leftIcon={<Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />}
        />
        <Input
          label={t('auth.register.parent.passwordLabel')}
          placeholder={t('auth.register.parent.passwordPlaceholder')}
          hint={t('auth.register.parent.passwordHint')}
          value={password}
          onChangeText={(v: string) => { setPassword(v); setError(null); }}
          isPassword
          autoComplete="new-password"
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
        />

        {/* Terms checkbox */}
        <Pressable
          style={styles.termsRow}
          onPress={() => { setTermsAccepted((v) => !v); setError(null); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
        >
          <View style={[styles.checkbox, termsAccepted ? styles.checkboxChecked : null] as import("react-native").StyleProp<import("react-native").ViewStyle>}>
            {termsAccepted && (
              <Text variant="bodySmall" color={colors.text.inverse}>✓</Text>
            )}
          </View>
          <Text variant="bodySmall" style={styles.termsText}>
            {t('auth.register.parent.termsAccept')}
          </Text>
        </Pressable>

        {error ? (
          <Text variant="bodySmall" color={colors.error}>{error}</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={t('auth.register.parent.submit')}
          loading={loading}
          onPress={handleSignUp}
        />
        <View style={styles.row}>
          <Text variant="body">{t('auth.register.parent.hasAccount')}{' '}</Text>
          <Text variant="body" color={colors.primary} onPress={() => router.push('/(auth)/login')}>
            {t('auth.register.parent.signIn')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.lg, paddingBottom: space.md, gap: space.xs },
  milo: { marginBottom: space.lg },
  form: { gap: space.md },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: { flex: 1 },
  actions: { marginTop: space.xl, gap: space.md, paddingBottom: space.lg },
  row: { flexDirection: 'row', justifyContent: 'center' },
});
