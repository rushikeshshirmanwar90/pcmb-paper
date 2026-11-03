import { useSyncExternalStore } from 'react';

// The message after adding, changing or removing a class. The form closes right
// after saving, so the schedule overview shows it, not the form.

let notice: string | null = null;
const listeners = new Set<() => void>();

export function setScheduleNotice(next: string | null) {
  notice = next;
  listeners.forEach((l) => l());
}

export function useScheduleNotice() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notice,
    () => notice
  );
}
