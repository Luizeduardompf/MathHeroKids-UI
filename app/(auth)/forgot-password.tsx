import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text } from '@/components/ui';
import { Screen } from '@/components/layout/Screen';
import { MiloMessage } from '@/components/milo/MiloMessage';
import { authService } from '@/services/auth.service';
import { colors, space } from '@/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    setError(null);
    if (!email.trim()) {
      setError(t('errors.validation.required'));
      return;
    }

    setLoading(true);
    const result = await authService.resetPassword(email);
    setLoading(false);

    if (result.error) {
      setError(t(result.error));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Screen padded>
        <View style={styles.header}>
          <Text variant="h1">{t('auth.forgotPassword.title')}</Text>
        </View>
        <MiloMessage message={t('auth.forgotPassword.successMessage')} style={styles.milo} />
        <View style={styles.actions}>
          <Button
            label={t('auth.forgotPassword.backToLogin')}
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable padded>
      <View style={styles.header}>
        <Text variant="h1">{t('auth.forgotPassword.title')}</Text>
      </View>

      <MiloMessage message={t('auth.forgotPassword.miloMessage')} style={styles.milo} />

      <View style={styles.form}>
        <Text variant="body">{t('auth.forgotPassword.description')}</Text>
        <Input
          label={t('auth.forgotPassword.emailLabel')}
          placeholder="responsavel@email.com"
          value={email}
          onChangeText={(v: string) => { setEmail(v); setError(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          error={error ?? undefined}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label={t('auth.forgotPassword.submit')}
          loading={loading}
          onPress={handleReset}
        />
        <View style={styles.row}>
          <Text variant="body" color={colors.text.secondary}>
            {t('auth.forgotPassword.rememberPassword')}{' '}
          </Text>
          <Text variant="body" color={colors.primary} onPress={() => router.back()}>
            {t('auth.forgotPassword.backToLogin')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.lg, paddingBottom: space.md },
  milo: { marginBottom: space.lg },
  form: { gap: space.md },
  actions: { marginTop: space.xl, gap: space.md },
  row: { flexDirection: 'row', justifyContent: 'center' },
});
