import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import type React from 'react';

import { Text } from '@/components/ui';
import type { IoniconsName } from '@/components/ui';
import { colors, radius, shadows, space } from '@/theme';

// ─── Tab icon helpers ─────────────────────────────────────────────────────────

interface TabIconProps {
  outlineName: IoniconsName;
  solidName: IoniconsName;
  focused: boolean;
}

function TabIcon({ outlineName, solidName, focused }: TabIconProps): React.JSX.Element {
  return (
    <Ionicons
      name={focused ? solidName : outlineName}
      size={24}
      color={focused ? colors.tabBar.active : colors.tabBar.inactive}
    />
  );
}

function ChallengeFAB({ focused }: { focused: boolean }): React.JSX.Element {
  return (
    <View style={[styles.fab, focused ? styles.fabActive : null] as import('react-native').StyleProp<import('react-native').ViewStyle>}>
      <Ionicons name="close" size={26} color={colors.text.inverse} />
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

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
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon outlineName="home-outline" solidName="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarLabel: 'Calendário',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon outlineName="calendar-outline" solidName="calendar" focused={focused} />
          ),
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
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon outlineName="people-outline" solidName="people" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon outlineName="settings-outline" solidName="settings" focused={focused} />
          ),
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
