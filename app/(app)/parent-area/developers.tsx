/**
 * Developers — settings técnicos globais do motor de reteste.
 *
 * Atrás do PIN normal da área dos pais (parent-area) + uma segunda camada: senha fixa
 * hardcoded (fricção deliberada, não segurança real — é uma área "para nós", não uma
 * proteção de dados sensíveis).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Card, Text, Input, Button } from '@/components/ui';
import { appConfigService } from '@/services/app-config.service';
import { colors, fontFamily, space } from '@/theme';

const DEVELOPERS_PASSWORD = '120380';

export default function DevelopersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.header}>
            <View style={s.headerRow}>
              <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <View style={s.headerCenter}>
                <Text style={s.headerSub}>Math Hero Kids</Text>
                <Text style={s.headerTitle}>{t('parentArea.developers.title')}</Text>
              </View>
              <View style={{ width: 42 }} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {unlocked ? <DevelopersPanel /> : <PasswordGate onUnlock={() => setUnlocked(true)} />}
    </View>
  );
}

// ─── Password gate ──────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (value === DEVELOPERS_PASSWORD) {
      onUnlock();
      return;
    }
    setError(t('parentArea.developers.wrongPassword'));
    setValue('');
  };

  return (
    <KeyboardAvoidingView
      style={s.gateWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.gateIcon}>
        <Ionicons name="lock-closed" size={28} color={colors.primary} />
      </View>
      <Text variant="h3" style={{ marginTop: space.md, textAlign: 'center' }}>
        {t('parentArea.developers.gateTitle')}
      </Text>
      <Text variant="caption" color={colors.text.secondary} style={{ textAlign: 'center', marginBottom: space.lg }}>
        {t('parentArea.developers.gateSubtitle')}
      </Text>
      <Input
        value={value}
        onChangeText={(v: string) => { setValue(v); setError(null); }}
        isPassword
        keyboardType="number-pad"
        placeholder={t('parentArea.developers.passwordPlaceholder')}
        error={error ?? undefined}
        onSubmitEditing={submit}
        containerStyle={{ width: '100%' }}
      />
      <Button
        label={t('parentArea.developers.enterBtn')}
        onPress={submit}
        disabled={value.length === 0}
        fullWidth
        style={{ marginTop: space.md }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Settings panel ─────────────────────────────────────────────────────────────

function DevelopersPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => appConfigService.getAppConfig(),
  });

  const [threshold, setThreshold] = useState<string | null>(null);
  const [percentage, setPercentage] = useState<string | null>(null);

  const thresholdValue = threshold ?? String(data?.retest_correct_threshold ?? '');
  const percentageValue = percentage ?? (data ? String(Math.round(data.retest_percentage * 100)) : '');

  const mutation = useMutation({
    mutationFn: async () => {
      const t = parseInt(thresholdValue, 10);
      const p = parseInt(percentageValue, 10) / 100;
      await appConfigService.updateAppConfig('retest_correct_threshold', t);
      await appConfigService.updateAppConfig('retest_percentage', p);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-config'] });
      setThreshold(null);
      setPercentage(null);
    },
  });

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />;
  }

  if (isError) {
    return (
      <View style={s.gateWrap}>
        <Text color={colors.error}>{t('parentArea.developers.loadError')}</Text>
      </View>
    );
  }

  const thresholdNum = parseInt(thresholdValue, 10);
  const percentageNum = parseInt(percentageValue, 10);
  const isValid =
    Number.isInteger(thresholdNum) && thresholdNum >= 1 && thresholdNum <= 50 &&
    Number.isInteger(percentageNum) && percentageNum >= 1 && percentageNum <= 100;

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text variant="h3" style={s.sectionTitle}>{t('parentArea.developers.whatsappSection')}</Text>
      <Pressable
        onPress={() => router.push('/(app)/parent-area/developer-whatsapp')}
        style={({ pressed }) => [s.whatsappCard, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
        <View style={{ flex: 1 }}>
          <Text variant="label">{t('parentArea.developers.whatsappLinkLabel')}</Text>
          <Text variant="caption" color={colors.text.secondary}>{t('parentArea.developers.whatsappLinkHint')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </Pressable>

      <Text variant="h3" style={s.sectionTitle}>{t('parentArea.developers.dangerSection')}</Text>
      <Pressable
        onPress={() => router.push('/(app)/parent-area/developer-reset')}
        style={({ pressed }) => [s.whatsappCard, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="refresh-circle-outline" size={24} color={colors.error} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{t('parentArea.developers.resetLinkLabel')}</Text>
          <Text variant="caption" color={colors.text.secondary}>{t('parentArea.developers.resetLinkHint')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </Pressable>

      <Text variant="h3" style={s.sectionTitle}>{t('parentArea.developers.retestSection')}</Text>
      <Card style={{ gap: space.md }}>
        <Input
          label={t('parentArea.developers.thresholdLabel')}
          hint={t('parentArea.developers.thresholdHint')}
          value={thresholdValue}
          onChangeText={setThreshold}
          keyboardType="number-pad"
        />
        <Input
          label={t('parentArea.developers.percentageLabel')}
          hint={t('parentArea.developers.percentageHint')}
          value={percentageValue}
          onChangeText={setPercentage}
          keyboardType="number-pad"
        />
        {mutation.isError ? (
          <Text variant="caption" color={colors.error}>{(mutation.error as Error).message}</Text>
        ) : null}
        {mutation.isSuccess ? (
          <Text variant="caption" color={colors.success}>{t('parentArea.developers.saved')}</Text>
        ) : null}
        <Button
          label={t('parentArea.developers.saveBtn')}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!isValid}
          fullWidth
        />
      </Card>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background.primary },
  header:       { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 } as import('react-native').TextStyle,
  headerTitle:  { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' } as import('react-native').TextStyle,
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  gateWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  gateIcon:     { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

  content:      { padding: space.md, gap: space.sm, paddingBottom: space['2xl'] },
  sectionTitle: { marginTop: space.sm, marginBottom: 4 },

  whatsappCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: '#fff', borderRadius: 20, padding: space.md,
    borderWidth: 1, borderColor: colors.border.default,
  },
});
