import { useSyncExternalStore } from 'react';

// A counter screens use to know the server's data changed elsewhere, e.g. a
// teacher added on the Teachers tab should show in the Home tab's totals.
// Every change bumps it; screens list it among their load dependencies.

let version = 0;
const listeners = new Set<() => void>();

export function bumpDataVersion() {
  version += 1;
  listeners.forEach((l) => l());
}

export function useDataVersion() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => version
  );
}
