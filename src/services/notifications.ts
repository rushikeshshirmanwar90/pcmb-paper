import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
import { api } from '@/services/api-client';
import type { TimetableEntry } from '@/services/school-api';
import { formatTime } from '@/services/tuition-api';

// Phone notifications: push from the server (announcements, new tests,
// today's topics, timetable changes) and class reminders scheduled on the
// phone itself from the weekly timetable.
//
// Push needs a development or store build. In Expo Go on Android
// notifications are off altogether (the module can't load there); on the
// web too.

const REMINDER_MINUTES = 15;
const REMINDER_KIND = 'class-reminder';

// expo-notifications is loaded on first use, not imported: in Expo Go on
// Android its native push module is missing and importing it throws, which
// would take the whole app down. There, notifications are simply off.
type Notifications = typeof NotificationsModule;
let loaded: Notifications | null | undefined;

function notifications(): Notifications | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as Notifications;
    // Show notifications that arrive while the app is open, too.
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    loaded = mod;
  } catch (error) {
    if (__DEV__) console.log('[notifications] off in this build:', error instanceof Error ? error.message : error);
  }
  return loaded;
}

async function ensureChannel(Notifications: Notifications) {
  if (Platform.OS !== 'android') return;
  // Android 13+ only asks for permission once a channel exists.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Tuition updates',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Asks for permission (once); true when notifications are allowed. */
async function allowed(): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  await ensureChannel(Notifications);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let registeredToken: string | null = null;

/** Registers this phone for push with the server. Quietly does nothing where push can't work. */
export async function registerForPush() {
  try {
    const Notifications = notifications();
    if (!Notifications || !Device.isDevice || !(await allowed())) return;
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
  const Notifications = notifications();
  if (!Notifications) return;
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
  const Notifications = notifications();
  if (!Notifications) return;
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
  const Notifications = notifications();
  if (!Notifications) return () => {};
  const open = (response: NotificationsModule.NotificationResponse | null) => {
    const tab = response?.notification.request.content.data?.tab;
    if (typeof tab === 'string') handler(tab);
  };
  // Opened the app from a notification.
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}
