import { useSyncExternalStore } from 'react';
import type { SchoolSubject } from '@/constants/school';

// Where the Practice tab should open next, e.g. a weak topic tapped on Home.
// Home sets it and switches tabs; the Practice tab opens that chapter (and
// topic, when the syllabus has it) and clears it.

export interface PracticeTarget {
  subject: SchoolSubject;
  chapter: string;
  /** "" or null: the chapter itself. */
  topic: string | null;
}

let target: PracticeTarget | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function openPracticeAt(next: PracticeTarget) {
  target = next;
  notify();
}

export function clearPracticeTarget() {
  if (!target) return;
  target = null;
  notify();
}

export function usePracticeTarget() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => target,
    () => target
  );
}
