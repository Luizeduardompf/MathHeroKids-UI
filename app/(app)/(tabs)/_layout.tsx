import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, shadows, space } from '@/theme';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

function ChallengeFAB({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.fab, focused && styles.fabActive]}>
      <Text style={{ fontSize: 24, color: colors.text.inverse }}>✖</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.tabBar.active,
        tabBarInactiveTintColor: colors.tabBar.inactive,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarLabel: 'Calendário',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          tabBarLabel: 'Desafio',
          tabBarIcon: ({ focused }: { focused: boolean }) => <ChallengeFAB focused={focused} />,
          tabBarLabelStyle: styles.tabLabelAccent,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          tabBarLabel: 'Amigos',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar.background,
    borderTopColor: colors.tabBar.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 80 : 64,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    ...shadows.sm,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabLabelAccent: { fontSize: 11, fontWeight: '700', color: colors.accent },
  fab: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...shadows.md,
  },
  fabActive: { backgroundColor: colors.accentDark },
});
