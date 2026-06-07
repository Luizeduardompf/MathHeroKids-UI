import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { colors, space } from '@/theme';

// TODO: Implement in Phase 2+
export default function NovaCrianaScreen() {
  return (
    <View style={styles.container}>
      <Text style={{ fontSize: 48 }}>👶</Text>
      <Text variant="h2">Nova Criança</Text>
      <Text variant="body" color={colors.text.secondary}>Em breve</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.background.primary,
  },
});
