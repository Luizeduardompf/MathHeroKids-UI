import { Pressable, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from './Text';
import { colors, fontFamily } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  /** Small line under the title (e.g. section name when title is a child's name) */
  subtitle?: string;
  onBack: () => void;
}

/**
 * Gradient header used across parent-area screens: back button, "Math Hero Kids"
 * eyebrow, title, optional subtitle line.
 */
export function ScreenHeader({ title, subtitle, onBack }: ScreenHeaderProps) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary } as ViewStyle}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSub}>Math Hero Kids</Text>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gradient:     { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontFamily: fontFamily.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 1 } as import('react-native').TextStyle,
  headerTitle:  { fontFamily: fontFamily.extraBold, fontSize: 22, color: '#fff' } as import('react-native').TextStyle,
  subtitle:     { fontFamily: fontFamily.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 6 } as import('react-native').TextStyle,
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
