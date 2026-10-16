// "You haven't logged lunch yet" reminders, as local notifications scheduled on the phone.
// Each reminder is scheduled one-off for the next REMINDER_DAYS days; today's is skipped once that meal
// is logged. The schedule is rebuilt whenever the app opens or a meal is saved, so it keeps rolling.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { entriesOn, getSetting, setSetting, uid } from './db';
import { addDays, parseDate, today } from './dates';
import { MEAL_LABEL, type Meal } from './nutrition';

export type Reminder = { id: string; meal: Meal; time: string };
export type ReminderSettings = { enabled: boolean; items: Reminder[] };

const CHANNEL = 'meal-reminders';
const PREFIX = 'rem-';
export const REMINDER_DAYS = 14;

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'breakfast', meal: 'breakfast', time: '10:00' },
  { id: 'lunch', meal: 'lunch', time: '14:00' },
  { id: 'dinner', meal: 'dinner', time: '20:00' },
];

export const getReminders = () => getSetting<ReminderSettings>('reminders', { enabled: false, items: [] });

export async function saveReminders(s: ReminderSettings) {
  await setSetting('reminders', s);
  await syncReminders();
}

export const newReminder = (): Reminder => ({ id: uid(), meal: 'snack', time: '16:00' });

/** Asks for notification permission. Returns false if the user said no. */
export async function ensurePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Meal reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function syncReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const settings = await getReminders();
  if (!settings.enabled || !settings.items.length) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  const now = new Date();
  const t = today(now);
  const loggedToday = new Set((await entriesOn(t)).map((e) => e.meal));

  for (let d = 0; d < REMINDER_DAYS; d++) {
    const date = addDays(t, d);
    for (const r of settings.items) {
      if (d === 0 && loggedToday.has(r.meal)) continue;
      const [h, m] = r.time.split(':').map(Number);
      const when = parseDate(date);
      when.setHours(h, m, 0, 0);
      if (when <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${r.id}-${date}`,
        content: {
          title: `Log your ${MEAL_LABEL[r.meal].toLowerCase()}`,
          body: `You haven't logged ${r.meal === 'snack' ? 'a snack' : r.meal} yet. Tap to add it.`,
          data: { url: '/log' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
  }
}
