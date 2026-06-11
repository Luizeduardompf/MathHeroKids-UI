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
    if (!password)               return 'A nova senha é obrigatória.';
    if (password.length < MIN_LEN) return `A senha deve ter pelo menos ${MIN_LEN} caracteres.`;
    if (password !== confirm)    return 'As senhas não coincidem.';
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
      title="Redefinir senha"
      subtitle="Cria uma nova senha de acesso"
      onBack={() => router.back()}
    >
      <Card border shadow="sm">
        <View style={styles.form}>
          <Input
            label="Nova senha"
            placeholder="Mínimo 8 caracteres"
            hint={`Mínimo ${MIN_LEN} caracteres`}
            value={password}
            onChangeText={(v: string) => { setPassword(v); setError(null); setSuccess(false); }}
            isPassword
            autoComplete="new-password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
          />

          <Input
            label="Confirmar nova senha"
            placeholder="Repete a senha"
            value={confirm}
            onChangeText={(v: string) => { setConfirm(v); setError(null); setSuccess(false); }}
            isPassword
            autoComplete="new-password"
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
          />

          {error   && <Text variant="bodySmall" color={colors.error}>{error}</Text>}
          {success && <Text variant="bodySmall" color={colors.success}>✓ Senha alterada com sucesso!</Text>}

          <Button
            label={loading ? 'A guardar…' : 'Guardar nova senha'}
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
