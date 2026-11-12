import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { loadPreference, savePreference } from '@/services/preferences';

// Few, meaningful haptics (app-interactions motion budget), fired from onPress
// only (press-in also fires when a finger lands and starts to scroll). The
// Vibration setting turns every one of them off. On an app build without the
// haptics module, or on the web, they silently do nothing.

type Kind = 'select' | 'tap' | 'success' | 'error' | 'warning' | 'bump';
const PRIORITY: Record<Kind, number> = { select: 0, tap: 1, bump: 2, warning: 2, success: 3, error: 3 };

const KEY = 'pcmb.vibration';
let enabled = true;
let last = { at: 0, priority: -1 };
const listeners = new Set<(on: boolean) => void>();

void loadPreference(KEY).then((saved) => {
  if (saved !== 'off') return;
  enabled = false;
  listeners.forEach((l) => l(false));
});

/** The Vibration setting: on by default, kept on this device. */
export function setVibration(on: boolean) {
  enabled = on;
  void savePreference(KEY, on ? 'on' : 'off');
  listeners.forEach((l) => l(on));
}

export function useVibrationSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    listeners.add(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return [on, setVibration];
}

// select: the lightest tick (choosing an option). tap: a little stronger
// (moving between questions). bump: firmer still.
const ios: Record<Kind, () => Promise<void>> = {
  select: () => Haptics.selectionAsync(),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  bump: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

// Android uses the vibration motor, not view haptics: view haptics do nothing
// when the phone's own "Touch feedback" setting is off, and their selection
// tick is too faint to feel on many phones. Strength is set by amplitude:
// select 50 ms at 30/255, tap 43 ms at 50, bump 60 ms at 70.
const android: Record<Kind, () => Promise<void>> = {
  select: () => Haptics.selectionAsync(),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  bump: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

function fire(kind: Kind) {
  if (!enabled || Platform.OS === 'web') return;
  const now = Date.now();
  // Within 150 ms only a more important haptic may follow.
  if (now - last.at < 150 && PRIORITY[kind] <= last.priority) return;
  last = { at: now, priority: PRIORITY[kind] };
  try {
    (Platform.OS === 'android' ? android : ios)[kind]().catch(() => {});
  } catch {
    // No haptics module in this build.
  }
}

export const haptic = {
  select: () => fire('select'),
  tap: () => fire('tap'),
  bump: () => fire('bump'),
  success: () => fire('success'),
  error: () => fire('error'),
  warning: () => fire('warning'),
};
