import type { TimetableEntry } from '@/services/school-api';

// After a save whose answer never arrived (timeout, dropped connection) the
// server may or may not have written it. These compare the batch's timetable,
// read afresh, with what was asked for, so the form never guesses and never
// re-sends blindly. A class that was already there before the try never counts.

export type Verdict = { state: 'done' } | { state: 'none' } | { state: 'partial'; saved: number[]; missing: number[] };

export interface ClassFields {
  batchId: string;
  subject: string;
  start: string;
  end: string;
  /** '' or null: no teacher. */
  teacherId: string | null;
  note: string;
}

const sameFields = (e: TimetableEntry, f: ClassFields) =>
  e.batch.id === f.batchId && e.subject === f.subject && e.start === f.start && e.end === f.end && (e.teacher.id || '') === (f.teacherId || '') && e.note === f.note;

/** Did these days get added? `before` holds the ids of the classes there when the try began. */
export function verifyAdded(fresh: TimetableEntry[], before: ReadonlySet<string>, fields: ClassFields, days: number[]): Verdict {
  const saved = days.filter((day) => fresh.some((e) => !before.has(e.id) && e.day === day && sameFields(e, fields)));
  const missing = days.filter((day) => !saved.includes(day));
  if (!missing.length) return { state: 'done' };
  return saved.length ? { state: 'partial', saved, missing } : { state: 'none' };
}

/** Did the class `id` take on these fields and day? */
export function verifyUpdated(fresh: TimetableEntry[], id: string, fields: ClassFields, day: number): Verdict {
  const e = fresh.find((x) => x.id === id);
  return e && e.day === day && sameFields(e, fields) ? { state: 'done' } : { state: 'none' };
}

/** Is the class `id` gone? */
export function verifyRemoved(fresh: TimetableEntry[], id: string): Verdict {
  return fresh.some((e) => e.id === id) ? { state: 'none' } : { state: 'done' };
}
