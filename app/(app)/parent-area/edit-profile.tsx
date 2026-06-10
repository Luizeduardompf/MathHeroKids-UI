/**
 * Edit parent profile screen.
 * Allows the parent to update their display name.
 * Email is read-only (Supabase Auth identity).
 * Password change is handled via forgot-password flow.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router        = useRouter();
  const user          = useAuthStore((s) => s.user);
  const parentProfile = useAuthStore((s) => s.parentProfile);

  const currentName = (parentProfile?.name as string | undefined)
    ?? (user?.user_metadata?.name as string | undefined)
    ?? '';

  const email = user?.email ?? '';

  const [name, setName]     = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSuccess(false);

    const trimmed = name.trim();
    if (!trimmed) { setError(t('errors.validation.required')); return; }
    if (trimmed.length < 2) { setError(t('errors.validation.nameTooShort')); return; }
    if (trimmed === currentName) { router.back(); return; }

    setLoading(true);
    try {
      // Update Supabase Auth user_metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { name: trimmed },
      });
      if (authErr) throw authErr;

      // Update parent_profiles table
      const { error: dbErr } = await supabase
        .from('parent_profiles')
        .update({ name: trimmed })
        .eq('id', user!.id);
      if (dbErr) throw dbErr;

      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (e) {
      setError((e as Error).message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Editar perfil"
      subtitle="Dados do responsável"
      onBack={() => router.back()}
    >
      <Card border shadow="sm">
        <View style={styles.form}>
          <Input
            label="Nome do responsável"
            placeholder="Seu nome completo"
            value={name}
            onChangeText={(v: string) => { setName(v); setError(null); setSuccess(false); }}
            autoCapitalize="words"
            autoComplete="name"
            leftIcon={<Ionicons name="person-outline" size={20} color={colors.text.tertiary} />}
          />

          {/* E-mail — read only */}
          <View style={styles.emailField}>
            <Text variant="label" color={colors.text.primary} style={styles.emailLabel}>
              E-mail
            </Text>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
              <Text variant="body" color={colors.text.secondary} style={styles.emailText}>
                {email}
              </Text>
              <View style={styles.readOnlyBadge}>
                <Text style={styles.readOnlyText}>fixo</Text>
              </View>
            </View>
            <Text variant="caption" color={colors.text.tertiary}>
              O e-mail não pode ser alterado.
            </Text>
          </View>

          {error && (
            <Text variant="bodySmall" color={colors.error}>{error}</Text>
          )}
          {success && (
            <Text variant="bodySmall" color={colors.success}>
              ✓ Dados atualizados com sucesso!
            </Text>
          )}

          <Button
            label="Salvar alterações"
            loading={loading}
            onPress={handleSave}
            icon="checkmark-outline"
          />
        </View>
      </Card>

      {/* Password change */}
      <Card border shadow="sm" style={styles.passwordCard}>
        <View style={styles.passwordRow}>
          <View style={styles.passwordIcon}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.passwordInfo}>
            <Text variant="label">Senha</Text>
            <Text variant="caption" color={colors.text.secondary}>
              Enviaremos um link para redefinir sua senha.
            </Text>
          </View>
        </View>
        <Button
          label="Redefinir senha"
          variant="secondary"
          onPress={() => router.push('/(auth)/forgot-password')}
        />
      </Card>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },

  emailField: { gap: space.xs },
  emailLabel: { marginBottom: 2 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.background.cardAlt,
    borderRadius: 20, // matches Input radius.xl
    borderWidth: 1.5,
    borderColor: colors.border.default,
    paddingHorizontal: space.md,
    height: 56,
  },
  emailText: { flex: 1 },
  readOnlyBadge: {
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  readOnlyText: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '600',
  } as import('react-native').TextStyle,

  passwordCard: { gap: space.md },
  passwordRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  passwordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  passwordInfo: { flex: 1, gap: 2 },
});
