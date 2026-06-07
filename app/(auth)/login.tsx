import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text } from '@/components/ui';
import { Screen } from '@/components/layout/Screen';
import { authService } from '@/services/auth.service';
import { colors, space } from '@/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t('errors.validation.required'));
      return;
    }

    setLoading(true);
    const result = await authService.signIn({ email, password });
    setLoading(false);

    if (result.error) {
      setError(t(result.error));
      return;
    }
    // useAuthListener updates the store → app/index.tsx redirects automatically
  }

  return (
    <Screen scrollable padded>
      <View style={styles.header}>
        <Text variant="caption" color={colors.text.tertiary}>Math Hero Kids</Text>
        <Text variant="h1">{t('auth.login.title')}</Text>
      </View>

      <View style={styles.form}>
        <Input
          label={t('auth.login.emailLabel')}
          placeholder={t('auth.login.emailPlaceholder')}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
        />
        <Input
          label={t('auth.login.passwordLabel')}
          placeholder={t('auth.login.passwordPlaceholder')}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null); }}
          isPassword
          autoComplete="current-password"
          error={error ?? undefined}
        />
        <Text
          variant="body"
          color={colors.primary}
          align="right"
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          {t('auth.login.forgotPassword')}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('auth.login.submit')}
          loading={loading}
          onPress={handleSignIn}
        />
        <View style={styles.signupRow}>
          <Text variant="body" color={colors.text.secondary}>
            {t('auth.login.noAccount')}{' '}
          </Text>
          <Text
            variant="body"
            color={colors.primary}
            onPress={() => router.push('/(auth)/register/parent')}
          >
            {t('auth.login.createAccount')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.lg, paddingBottom: space.xl, gap: space.xs },
  form: { gap: space.md },
  actions: { marginTop: space.xl, gap: space.md, paddingBottom: space.lg },
  signupRow: { flexDirection: 'row', justifyContent: 'center' },
});
