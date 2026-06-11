/**
 * Change Password screen (authenticated).
 *
 * The user is already logged in — no current password needed.
 * Just type + confirm the new password and save.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

const MIN_LEN = 8;

export default function ChangePasswordScreen() {
  const { t }    = useTranslation();
  const router   = useRouter();

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  function validate(): string | null {
    if (!password)               return t('errors.validation.passwordRequired');
    if (password.length < MIN_LEN) return t('errors.validation.passwordMinLength', { n: MIN_LEN });
    if (password !== confirm)    return t('errors.validation.passwordMismatch');
    return null;
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    const msg = validate();
    if (msg) { setError(msg); return; }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      setError((e as Error).message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title={t('parentArea.changePassword')}
      subtitle={t('parentArea.changePasswordSub')}
      onBack={() => router.back()}
    >
      <Card border shadow="sm">
        <View style={styles.form}>
          <Input
            label={t('parentArea.password.newLabel')}
            placeholder={t('parentArea.password.newPlaceholder', { n: MIN_LEN })}
            hint={t('parentArea.password.newPlaceholder', { n: MIN_LEN })}
            value={password}
            onChangeText={(v: string) => { setPassword(v); setError(null); setSuccess(false); }}
            isPassword
            autoComplete="new-password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
          />

          <Input
            label={t('parentArea.password.confirmLabel')}
            placeholder={t('parentArea.password.confirmPlaceholder')}
            value={confirm}
            onChangeText={(v: string) => { setConfirm(v); setError(null); setSuccess(false); }}
            isPassword
            autoComplete="new-password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
          />

          {error   && <Text variant="bodySmall" color={colors.error}>{error}</Text>}
          {success && <Text variant="bodySmall" color={colors.success}>{t('parentArea.password.updated')}</Text>}

          <Button
            label={loading ? t('common.saving') : t('parentArea.password.saveBtn')}
            loading={loading}
            onPress={handleSave}
            icon="checkmark-outline"
          />
        </View>
      </Card>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
