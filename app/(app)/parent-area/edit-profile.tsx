/**
 * Edit parent profile screen.
 * - Update display name
 * - E-mail (read-only)
 * - Set / change / remove 4-digit PIN
 * - Change password (inline, no reset link)
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
// @ts-expect-error RN 0.85 quirk — Alert present at runtime
import { Alert } from 'react-native'; // eslint-disable-line
import { useTranslation } from 'react-i18next';

import { Button, Card, Input, Text } from '@/components/ui';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { pinService } from '@/services/pin.service';
import { colors, fontFamily, space } from '@/theme';

// ─── PIN section ─────────────────────────────────────────────────────────────

function PinSection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [hasPin,      setHasPin]      = useState<boolean | null>(null);
  const [pin,         setPin]         = useState('');
  const [confirmPin,  setConfirmPin]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await pinService.getPin(userId);
      setHasPin(!!stored);
    })();
  }, [userId]);

  const pinLabel  = hasPin ? 'Alterar PIN' : 'Definir PIN';
  const pinHint   = 'Exactamente 4 dígitos numéricos';

  async function handleSavePin() {
    setError(null);
    setSuccess(false);
    if (!/^\d{4}$/.test(pin)) { setError('O PIN deve ter exactamente 4 dígitos.'); return; }
    if (pin !== confirmPin)   { setError('Os PINs não coincidem.'); return; }

    setSaving(true);
    try {
      await pinService.setPin(userId, pin);
      setHasPin(true);
      setPin('');
      setConfirmPin('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearPin() {
    Alert.alert(
      'Remover PIN',
      'Tens a certeza que queres remover o PIN? A área dos pais ficará acessível sem PIN.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            await pinService.clearPin(userId);
            setHasPin(false);
            setPin('');
            setConfirmPin('');
          },
        },
      ],
    );
  }

  if (hasPin === null) {
    return <ActivityIndicator color={colors.primary} size="small" style={{ margin: space.md }} />;
  }

  return (
    <Card border shadow="sm">
      <View style={ps.header}>
        <View style={ps.iconCircle}>
          <Ionicons name="keypad-outline" size={22} color={colors.primary} />
        </View>
        <View style={ps.headerText}>
          <Text variant="label">{t('parentArea.pinSection')}</Text>
          <Text variant="caption" color={colors.text.secondary}>
            {hasPin ? 'PIN activo — área dos pais protegida' : 'Sem PIN — acesso livre à área dos pais'}
          </Text>
        </View>
      </View>

      <View style={ps.form}>
        <Input
          label={pinLabel}
          placeholder="••••"
          value={pin}
          onChangeText={(v: string) => { setPin(v.replace(/\D/g, '').slice(0, 4)); setError(null); setSuccess(false); }}
          keyboardType="number-pad"
          isPassword
          maxLength={4}
          hint={pinHint}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
        />
        <Input
          label="Confirmar PIN"
          placeholder="••••"
          value={confirmPin}
          onChangeText={(v: string) => { setConfirmPin(v.replace(/\D/g, '').slice(0, 4)); setError(null); setSuccess(false); }}
          keyboardType="number-pad"
          isPassword
          maxLength={4}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />}
        />

        {error && <Text variant="bodySmall" color={colors.error}>{error}</Text>}
        {success && <Text variant="bodySmall" color={colors.success}>✓ PIN actualizado com sucesso!</Text>}

        <Button
          label={saving ? 'A guardar…' : pinLabel}
          loading={saving}
          onPress={handleSavePin}
          icon="checkmark-outline"
        />

        {hasPin && (
          <Button
            label="Remover PIN"
            variant="secondary"
            onPress={handleClearPin}
          />
        )}
      </View>
    </Card>
  );
}

const ps = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.md },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerText: { flex: 1, gap: 2 },
  form:       { gap: space.md },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const user     = useAuthStore((s) => s.user);
  const parentProfile = useAuthStore((s) => s.parentProfile);

  const currentName = (parentProfile?.name as string | undefined)
    ?? (user?.user_metadata?.name as string | undefined)
    ?? '';

  const email = user?.email ?? '';

  const [name,    setName]    = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSuccess(false);

    const trimmed = name.trim();
    if (!trimmed)            { setError(t('errors.validation.required')); return; }
    if (trimmed.length < 2)  { setError(t('errors.validation.nameTooShort')); return; }
    if (trimmed === currentName) { router.back(); return; }

    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ data: { name: trimmed } });
      if (authErr) throw authErr;

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
      {/* ── Name ─────────────────────────────────────────────────────── */}
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

          {error   && <Text variant="bodySmall" color={colors.error}>{error}</Text>}
          {success && <Text variant="bodySmall" color={colors.success}>✓ Dados actualizados!</Text>}

          <Button
            label="Guardar alterações"
            loading={loading}
            onPress={handleSave}
            icon="checkmark-outline"
          />
        </View>
      </Card>

      {/* ── PIN ──────────────────────────────────────────────────────── */}
      {user?.id && <PinSection userId={user.id} />}

      {/* ── Password ─────────────────────────────────────────────────── */}
      <Card border shadow="sm" style={styles.passwordCard}>
        <View style={styles.passwordRow}>
          <View style={styles.passwordIcon}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.passwordInfo}>
            <Text variant="label">{t('parentArea.passwordSection')}</Text>
            <Text variant="caption" color={colors.text.secondary}>
              Alterar a senha de acesso à conta.
            </Text>
          </View>
        </View>
        <Button
          label="Redefinir senha"
          variant="secondary"
          onPress={() => router.push('/(app)/parent-area/change-password')}
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
    borderRadius: 20,
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
  passwordRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  passwordIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  passwordInfo: { flex: 1, gap: 2 },

  pinHeaderText: { fontFamily: fontFamily.extraBold, fontSize: 15, color: colors.text.primary } as import('react-native').TextStyle,
});
