import type { AppStateStatus } from 'react-native';

/** AppState follows the foreground Activity. Window blur, route changes and
 * lack of touches do not prove that the application entered the background. */
export function trackAppBackground(appState: {
  readonly currentState: string | null | undefined;
  addEventListener: (event: 'change', listener: (state: AppStateStatus) => void) => { remove(): void };
}, tracker: {
  lose(source: string, reason: 'app-background'): void;
  gain(source: string): void;
  verify(): Promise<void>;
}) {
  let background = false;
  const sync = (state = appState.currentState) => {
    if (state === 'background' && !background) {
      background = true;
      tracker.lose('app', 'app-background');
    } else if (state === 'active' && background) {
      background = false;
      tracker.gain('app');
      void tracker.verify();
    }
  };
  sync();
  const subscription = appState.addEventListener('change', sync);
  return { sync, dispose: () => subscription.remove() };
}
