import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from '@/services/api-client';
import type { TimetableEntry } from '@/services/school-api';
import { formatTime } from '@/services/tuition-api';

// Phone notifications: push from the server (announcements, new tests,
// today's topics, timetable changes) and class reminders scheduled on the
// phone itself from the weekly timetable.
//
// Push needs a development or store build: Expo Go on Android can't receive
// it. Class reminders work everywhere except the web.

const REMINDER_MINUTES = 15;
const REMINDER_KIND = 'class-reminder';

// Show notifications that arrive while the app is open, too.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  // Android 13+ only asks for permission once a channel exists.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Tuition updates',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Asks for permission (once); true when notifications are allowed. */
async function allowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let registeredToken: string | null = null;

/** Registers this phone for push with the server. Quietly does nothing where push can't work. */
export async function registerForPush() {
  try {
    if (!Device.isDevice || !(await allowed())) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('/push', { method: 'POST', body: { token, platform: Platform.OS } });
    registeredToken = token;
  } catch (error) {
    // Expo Go on Android, no internet, or no Google services: reminders still work.
    if (__DEV__) console.log('[push] not registered:', error instanceof Error ? error.message : error);
  }
}

/** On log out: this phone stops getting the user's notifications, and their reminders go. */
export async function unregisterPush() {
  if (Platform.OS === 'web') return;
  try {
    if (registeredToken) await api('/push', { method: 'DELETE', body: { token: registeredToken } });
  } catch {
    // The server forgets it when the next person logs in on this phone.
  }
  registeredToken = null;
  await clearClassReminders();
}

async function clearClassReminders() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.kind === REMINDER_KIND)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {
    // Nothing scheduled.
  }
}

let lastSynced = '';

/**
 * Schedules a reminder 15 minutes before each weekly class, replacing the
 * ones scheduled before. Called whenever the timetable loads.
 */
export async function syncClassReminders(entries: TimetableEntry[]) {
  if (Platform.OS === 'web') return;
  const signature = JSON.stringify(entries.map((e) => [e.id, e.day, e.start, e.subject, e.batch.name]));
  if (signature === lastSynced) return;
  try {
    if (entries.length && !(await allowed())) return;
    lastSynced = signature;
    await clearClassReminders();
    for (const e of entries) {
      const [h, m] = e.start.split(':').map(Number);
      let minutes = h * 60 + m - REMINDER_MINUTES;
      let day = e.day;
      if (minutes < 0) {
        // A class just after midnight: remind the evening before.
        minutes += 24 * 60;
        day = (day + 6) % 7;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${e.subject} at ${formatTime(e.start)}`,
          body: [e.batch.name, e.batch.venue, e.teacher.name].filter(Boolean).join(' · '),
          data: { kind: REMINDER_KIND, tab: 'home' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          // expo-notifications counts weekdays 1–7 from Sunday; the timetable 0–6.
          weekday: day + 1,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
          channelId: Platform.OS === 'android' ? 'default' : undefined,
        },
      });
    }
  } catch (error) {
    lastSynced = '';
    if (__DEV__) console.log('[reminders] not scheduled:', error instanceof Error ? error.message : error);
  }
}

/** Calls back with the tab a tapped notification points to (e.g. "tests"). */
export function onNotificationTap(handler: (tab: string) => void) {
  if (Platform.OS === 'web') return () => {};
  const open = (response: Notifications.NotificationResponse | null) => {
    const tab = response?.notification.request.content.data?.tab;
    if (typeof tab === 'string') handler(tab);
  };
  // Opened the app from a notification.
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}
