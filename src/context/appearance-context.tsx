import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import { loadPreference, savePreference } from '@/services/preferences';

/** The theme in use. */
export type AppearanceMode = 'light' | 'dark';
/** What the person chose: a fixed theme, or follow the phone's setting. */
export type AppearancePreference = 'system' | AppearanceMode;

type AppearanceContextValue = {
  /** The theme in use, resolved from the preference. */
  mode: AppearanceMode;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
  /** Picks a fixed theme (kept for older callers). */
  setMode: (mode: AppearanceMode) => void;
};

const KEY = 'pcmb.appearance';
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const isPreference = (value: unknown): value is AppearancePreference => value === 'system' || value === 'light' || value === 'dark';

export function AppearanceProvider({ children }: PropsWithChildren) {
  // Light until the person picks otherwise, as before this setting existed.
  const [preference, setPreferenceState] = useState<AppearancePreference>('light');
  const system = useSystemColorScheme();
  const mode: AppearanceMode = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // The saved choice, from the last launch.
  useEffect(() => {
    let cancelled = false;
    void loadPreference(KEY).then((saved) => {
      if (!cancelled && isPreference(saved)) setPreferenceState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void savePreference(KEY, next);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
    }
  }, [mode]);

  return (
    <AppearanceContext.Provider value={{ mode, preference, setPreference, setMode: setPreference }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance) {
    throw new Error('useAppearance must be used inside AppearanceProvider');
  }
  return appearance;
}
