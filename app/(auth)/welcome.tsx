import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { Screen } from '@/components/layout/Screen';
import { Icons } from '@/constants/icons';
import { colors, space } from '@/theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen backgroundColor={colors.primary} padded>
      {/* Hero area */}
      <View style={styles.hero}>
        {/* TODO Phase 2: Milo illustration + logo asset */}
        <Text variant="display" color={colors.text.inverse} align="center">
          {Icons.milo}
        </Text>
        <Text variant="display" color={colors.text.inverse} align="center">
          {t('auth.welcome.title')}
        </Text>
        <Text variant="bodyLarge" color="rgba(255,255,255,0.8)" align="center">
          {t('auth.welcome.subtitle')}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label={t('auth.welcome.getStarted')}
          variant="secondary"
          onPress={() => router.push('/(auth)/register/parent')}
        />
        <Button
          label={t('auth.welcome.signIn')}
          variant="ghost"
          onPress={() => router.push('/(auth)/login')}
          style={{ marginTop: space.sm }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  actions: { paddingBottom: space.lg, gap: space.sm },
});
