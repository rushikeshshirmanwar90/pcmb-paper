import { useSyncExternalStore } from 'react';

// Which half of the tuition's People tab is showing, Students or Teachers,
// so other tabs (e.g. Home) can open the right one. Pair with
// goToTab('people').

export type PeopleSegment = 'students' | 'teachers';

interface PeopleNav {
  segment: PeopleSegment;
  /** A request to filter the students by batch (a batch id or NO_BATCH); `id` tells repeated requests apart. */
  studentBatch: { batch: string; id: number } | null;
}

const START: PeopleNav = { segment: 'students', studentBatch: null };
let state = START;
let nextId = 1;
const listeners = new Set<() => void>();

const set = (next: PeopleNav) => {
  state = next;
  listeners.forEach((l) => l());
};

export function setPeopleSegment(segment: PeopleSegment) {
  if (state.segment !== segment) set({ ...state, segment });
}

/** Shows the Students half; with `batch`, filtered to that batch (or NO_BATCH). */
export function showStudents(batch?: string) {
  set({ segment: 'students', studentBatch: batch ? { batch, id: nextId++ } : state.studentBatch });
}

export function showTeachers() {
  setPeopleSegment('teachers');
}

/** Back to the start, e.g. when the People tab goes away on logging out. */
export function resetPeopleNav() {
  set(START);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => state;

export function usePeopleNav() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
