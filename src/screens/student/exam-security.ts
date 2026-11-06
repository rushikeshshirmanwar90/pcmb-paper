// React side of the exam's Android restrictions: switches them on only while a
// test is running and reads split-screen. The rules are in exam-guard.ts (tested);
// the native module (modules/exam-security) is absent in Expo Go, iOS and web,
// and everything here then falls back to doing nothing extra.
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { AppState, Dimensions, Platform, useWindowDimensions } from 'react-native';

import { createExamSecurity, type MultiWindowReading, type NativeExamSecurity, readMultiWindow } from '@/screens/student/exam-guard';

const native: NativeExamSecurity | null = Platform.OS === 'android' ? requireOptionalNativeModule<NativeExamSecurity>('ExamSecurity') : null;

/** Whether this build has the Android calls (a development or release build; false in Expo Go). */
export const hasNativeExamSecurity = native !== null;

const NOT_SPLIT: MultiWindowReading = { inMultiWindow: false, authoritative: false };

/** Hides other apps' floating overlays (Android 12+) while `active`, and lets them back the moment it isn't or the screen goes away. */
export function useExamSecurity(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const security = createExamSecurity(native);
    security.activate();
    return () => security.release();
  }, [active]);
}

/**
 * Whether the app is in split-screen / a small window while `active`.
 * Re-read when the window is resized and when the app returns to the front.
 * Without the native module it's a guess from the window size (not authoritative).
 */
export function useMultiWindow(active: boolean): MultiWindowReading {
  const window = useWindowDimensions();
  const [foregrounded, setForegrounded] = useState(0);
  const [reading, setReading] = useState<MultiWindowReading>(NOT_SPLIT);

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => state === 'active' && setForegrounded((n) => n + 1));
    return () => sub.remove();
  }, [active]);

  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    const security = createExamSecurity(native);
    const read = () => {
      const next = readMultiWindow(security.multiWindow(), window, Dimensions.get('screen'));
      setReading((r) => (r.inMultiWindow === next.inMultiWindow && r.authoritative === next.authoritative ? r : next));
    };
    read();
    // Android updates its multi-window flag around the resize, so look again once it has settled.
    const settle = setTimeout(read, 400);
    return () => clearTimeout(settle);
  }, [active, window, foregrounded]);

  return active && Platform.OS === 'android' ? reading : NOT_SPLIT;
}
