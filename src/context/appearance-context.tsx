import { createContext, PropsWithChildren, useCallback, useContext, useEffect } from 'react';
import { Platform } from 'react-native';

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

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/**
 * The app has one theme: light. The provider keeps its old shape (mode,
 * preference, setters) so nothing that reads it has to change, but the mode
 * is always light and a choice saved by an older version is ignored.
 */
export function AppearanceProvider({ children }: PropsWithChildren) {
  const mode: AppearanceMode = 'light';
  const preference: AppearancePreference = 'light';
  const setPreference = useCallback((_next: AppearancePreference) => {}, []);

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
