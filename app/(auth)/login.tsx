import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { authService } from '@/services/auth.service';
import { colors, space } from '@/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

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
    <AuthScreen
      title={t('auth.login.title')}
      subtitle="Math Hero Kids"
      onBack={() => router.back()}
    >
      <Card border shadow="sm">
        <View style={styles.form}>
          <Input
            label={t('auth.login.emailLabel')}
            placeholder={t('auth.login.emailPlaceholder')}
            value={email}
            onChangeText={(v: string) => { setEmail(v); setError(null); }}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            leftIcon={<Ionicons name="person-outline" size={20} color={colors.text.tertiary} />}
          />
          <Input
            label={t('auth.login.passwordLabel')}
            placeholder={t('auth.login.passwordPlaceholder')}
            value={password}
            onChangeText={(v: string) => { setPassword(v); setError(null); }}
            isPassword
            autoComplete="current-password"
            error={error ?? undefined}
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
          />
          <Text
            variant="body"
            color={colors.primary}
            align="right"
            style={styles.forgotLink}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            {t('auth.login.forgotPassword')}
          </Text>
          <Button
            label={t('auth.login.submit')}
            loading={loading}
            onPress={handleSignIn}
          />
        </View>
      </Card>

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
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form:       { gap: space.md },
  forgotLink: { marginTop: -space.xs },
  signupRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: space.sm },
});
