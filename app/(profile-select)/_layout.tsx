import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ProfileSelectLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.primary } }} />;
}
