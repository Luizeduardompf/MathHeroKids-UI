import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type React from 'react';

import { colors, radius } from '@/theme';

// ─── Spring config ────────────────────────────────────────────────────────────

const SPRING = { damping: 12, stiffness: 260, mass: 0.8 };

// ─── Tab icon — Feather (= Lucide clone), color-only active state ─────────────
// Design uses Lucide icons: same stroke weight, NO fill on active — just color.

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface TabIconProps {
  name: FeatherName;
  focused: boolean;
}

function TabIcon({ name, focused }: TabIconProps): React.JSX.Element {
  const scale = useSharedValue(focused ? 1.15 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, SPRING);
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Feather
        name={name}
        size={24}
        color={focused ? colors.tabBar.active : colors.tabBar.inactive}
      />
    </Animated.View>
  );
}

// ─── Challenge FAB — gradient + spring scale on focus ─────────────────────────

function ChallengeFAB({ focused }: { focused: boolean }): React.JSX.Element {
  const scale = useSharedValue(focused ? 1.08 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 1, SPRING);
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.fabShadow}>
      <Animated.View style={animStyle}>
        <LinearGradient
          colors={focused
            ? [colors.accentDark, '#7A2E06']
            : [colors.accent, colors.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <MaterialCommunityIcons name="sword-cross" size={30} color={colors.text.inverse} />
        </LinearGradient>
      </Animated.View>
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
            <TabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarLabel: 'Calendário',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name="calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          tabBarLabel: 'Desafio',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <ChallengeFAB focused={focused} />
          ),
          tabBarLabelStyle: styles.tabLabelAccent,
          // @ts-expect-error tabBarItemStyle exists in RN but not typed in this expo-router version
          tabBarItemStyle: styles.fabItem,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          tabBarLabel: 'Amigos',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name="users" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name="settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar.background,
    borderTopColor: colors.tabBar.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 82 : 64,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1F36',
        shadowOpacity: 0.10,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 12 },
    }),
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelAccent: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },

  // ── FAB ─────────────────────────────────────────────────────────────────────
  fabItem: {
    top: -18,
    height: 84,
  },
  fabShadow: {
    borderRadius: radius.full,
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 10 },
    }),
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
