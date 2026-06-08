import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { colors, space } from '@/theme';

interface PlaceholderScreenProps {
  emoji: string;
  title: string;
}

/**
 * Stub screen for routes not yet implemented.
 * Includes a back button so the user is never trapped.
 */
export function PlaceholderScreen({ emoji, title }: PlaceholderScreenProps) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
            <Text variant="body" color={colors.primary}> Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <View style={styles.body}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text variant="h2">{title}</Text>
        <Text variant="body" color={colors.text.secondary}>Em breve</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.primary },
  safeTop: { backgroundColor: colors.background.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backArrow: { fontSize: 22, color: colors.primary, lineHeight: 24 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  emoji: { fontSize: 48 },
});
