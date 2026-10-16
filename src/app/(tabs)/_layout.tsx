import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.text2,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: t.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('pie-chart-outline') }} />
      <Tabs.Screen name="log" options={{ title: 'Log food', tabBarLabel: 'Log', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="body" options={{ title: 'Body', tabBarIcon: icon('body-outline') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
