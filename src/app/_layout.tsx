import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { syncReminders } from '@/lib/reminders';
import { useTheme } from '@/lib/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function useReminderSync() {
  useEffect(() => {
    syncReminders().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncReminders().catch(() => {});
    });
    return () => sub.remove();
  }, []);
}

/** Tapping a reminder opens the Log screen. */
function useNotificationTaps() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = last?.notification.request.content.data?.url;
    if (typeof url === 'string') router.navigate('/log');
  }, [last]);
}

export default function RootLayout() {
  const t = useTheme();
  useReminderSync();
  useNotificationTaps();
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" options={{ presentation: 'modal', title: 'Check and save' }} />
        <Stack.Screen name="scanner" options={{ presentation: 'modal', title: 'Scan a barcode' }} />
        <Stack.Screen name="activity" options={{ presentation: 'modal', title: 'Log activity' }} />
        <Stack.Screen name="ideas" options={{ title: 'Meal ideas' }} />
        <Stack.Screen name="lesson/[id]" options={{ title: 'Lesson' }} />
        <Stack.Screen name="day/[date]" options={{ title: 'Day' }} />
        <Stack.Screen name="gym/photo/[id]" options={{ title: 'Progress photo' }} />
        <Stack.Screen name="gym/align/[id]" options={{ title: 'Line up photo' }} />
        <Stack.Screen name="gym/compare" options={{ title: 'Compare photos' }} />
        <Stack.Screen name="gym/measure" options={{ presentation: 'modal', title: 'Measurements' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
