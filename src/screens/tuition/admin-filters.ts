import type { Program, SchoolStandard, SchoolSubject } from '@/constants/school';
import type { TestStatus, TestSummary } from '@/services/school-api';
import type { Batch, BatchSlot, Student, Teacher } from '@/services/tuition-api';

// Filtering and summaries for the tuition's Batches, Students and Teachers
// tabs. Type imports only, so it can be tested on its own
// (tests/tuition-admin.test.mjs).

export const ALL = 'all';
/** The batch filter for students who aren't in any batch. */
export const NO_BATCH = 'none';

/** True when the search is empty or one of the fields contains it (any case). */
export function matchesText(search: string, ...fields: (string | null | undefined)[]) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => !!f && f.toLowerCase().includes(q));
}

export interface StudentFilter {
  search: string;
  program: Program | typeof ALL;
  standard: SchoolStandard | typeof ALL;
  /** ALL, NO_BATCH or a batch id. */
  batch: string;
}

export const EMPTY_STUDENT_FILTER: StudentFilter = { search: '', program: ALL, standard: ALL, batch: ALL };

export function filterStudents(students: Student[], f: StudentFilter) {
  return students.filter(
    (s) =>
      matchesText(f.search, s.name, s.email) &&
      (f.program === ALL || s.program === f.program) &&
      (f.standard === ALL || s.standard === f.standard) &&
      (f.batch === ALL || (f.batch === NO_BATCH ? !s.batch : s.batch?.id === f.batch))
  );
}

/** How many of the filters narrow the list (the search counts as one). */
export function activeFilterCount(f: StudentFilter) {
  return [f.search.trim() !== '', f.program !== ALL, f.standard !== ALL, f.batch !== ALL].filter(Boolean).length;
}

export interface TeacherFilter {
  search: string;
  /** ALL, NO_SUBJECTS or a subject. */
  subject: SchoolSubject | typeof ALL | typeof NO_SUBJECTS;
}

export const NO_SUBJECTS = 'none';

export function filterTeachers(teachers: Teacher[], f: TeacherFilter) {
  return teachers.filter(
    (t) =>
      matchesText(f.search, t.name, t.email) &&
      (f.subject === ALL || (f.subject === NO_SUBJECTS ? t.subjects.length === 0 : t.subjects.includes(f.subject)))
  );
}

// ─── Batches ───────────────────────────────────────────────────────────────

export interface BatchFilter {
  program: Program | typeof ALL;
  /** ALL, a class, or NO_CLASS for older batches of both classes. */
  standard: SchoolStandard | typeof ALL | typeof NO_CLASS;
}

/** The class filter for older batches made for both 11th and 12th. */
export const NO_CLASS = 'none';

export const EMPTY_BATCH_FILTER: BatchFilter = { program: ALL, standard: ALL };

export function filterBatches<B extends Pick<Batch, 'program' | 'standard'>>(batches: B[], f: BatchFilter) {
  return batches.filter(
    (b) => (f.program === ALL || b.program === f.program) && (f.standard === ALL || (f.standard === NO_CLASS ? !b.standard : b.standard === f.standard))
  );
}

/** How many batches each value has, for a filter row's counts. */
export function countBy<B, K extends string>(batches: B[], key: (b: B) => K) {
  const counts = new Map<K, number>();
  for (const b of batches) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1);
  return counts;
}

export type SetupStep = 'teachers' | 'students' | 'timings';

/** What a batch still needs before it's fully set up: a teacher per subject, students, a subject timetable. */
export function setupOf(batch: Pick<Batch, 'subjects' | 'teachers' | 'studentCount' | 'classes'>) {
  const steps: { key: SetupStep; done: boolean }[] = [
    { key: 'teachers', done: missingTeachers(batch).length === 0 },
    { key: 'students', done: batch.studentCount > 0 },
    { key: 'timings', done: batch.classes.classes > 0 },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, ready: done === steps.length, missing: steps.filter((s) => !s.done).map((s) => s.key) };
}

/**
 * A name for a new batch: "NEET 11th A", or the next free letter ("… B")
 * when that's taken (any case, spaces ignored). Past Z it numbers them.
 */
export function suggestBatchName(base: string, taken: string[]) {
  const used = new Set(taken.map((n) => n.trim().replace(/\s+/g, ' ').toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const name = `${base} ${String.fromCharCode(65 + i)}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  let n = 27;
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** The batch's subjects that have no teacher assigned. */
export function missingTeachers(batch: Pick<Batch, 'subjects' | 'teachers'>): SchoolSubject[] {
  return batch.subjects.filter((s) => !batch.teachers.some((t) => t.subject === s));
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

/** Each day of the week, Monday first, with its class times in start order. */
export function scheduleByDay(schedule: BatchSlot[]) {
  return WEEK_ORDER.map((day) => ({
    day,
    slots: schedule.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start)),
  }));
}

/** The one start and end every class shares, or null when they differ (or there are none). */
export function commonTime(schedule: BatchSlot[]): { start: string; end: string } | null {
  if (!schedule.length) return null;
  const { start, end } = schedule[0];
  return schedule.every((s) => s.start === start && s.end === end) ? { start, end } : null;
}

/** The batches a teacher leaves if they only teach `nextSubjects` (the server drops those assignments). */
export function batchesLost(teacher: Pick<Teacher, 'batches'>, nextSubjects: SchoolSubject[]) {
  return teacher.batches.filter((b) => !nextSubjects.includes(b.subject));
}

/** A teacher's batches, one entry per batch with every subject they teach there. */
export function groupTeacherBatches(batches: Teacher['batches']) {
  const groups = new Map<string, { id: string; name: string; subjects: SchoolSubject[] }>();
  for (const b of batches) {
    const g = groups.get(b.id) ?? { id: b.id, name: b.name, subjects: [] };
    g.subjects.push(b.subject);
    groups.set(b.id, g);
  }
  return [...groups.values()];
}

// ─── Tests ─────────────────────────────────────────────────────────────────

/** The server's test states, in the words the tuition sees. */
export const TEST_STATUS_LABEL: Record<TestStatus, string> = { open: 'Active', scheduled: 'Upcoming', closed: 'Ended' };

/** Active first, then upcoming, then ended. */
export const TEST_STATUS_ORDER: TestStatus[] = ['open', 'scheduled', 'closed'];

type Timed = Pick<TestSummary, 'status' | 'opensAt' | 'closesAt'>;

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

/**
 * The order within each state: active ones closing soonest first (no end
 * date last), upcoming opening soonest first, ended most recent first.
 */
export function compareTests(a: Timed, b: Timed) {
  if (a.status !== b.status) return TEST_STATUS_ORDER.indexOf(a.status) - TEST_STATUS_ORDER.indexOf(b.status);
  if (a.status === 'open') return time(a.closesAt) - time(b.closesAt);
  if (a.status === 'scheduled') return time(a.opensAt) - time(b.opensAt);
  return time(b.closesAt ?? b.opensAt) - time(a.closesAt ?? a.opensAt);
}

/** How many tests are in each state. */
export function testCounts(tests: Timed[]): Record<TestStatus, number> {
  const counts: Record<TestStatus, number> = { open: 0, scheduled: 0, closed: 0 };
  for (const t of tests) counts[t.status] += 1;
  return counts;
}

/** The tests in one state (or all), grouped by state in display order. */
export function groupTests<T extends Timed>(tests: T[], status: TestStatus | typeof ALL) {
  const shown = tests.filter((t) => status === ALL || t.status === status).sort(compareTests);
  return TEST_STATUS_ORDER.map((s) => ({ status: s, tests: shown.filter((t) => t.status === s) })).filter((g) => g.tests.length > 0);
}

/** Submitted out of the batch's students, as a whole percent. */
export function participation(t: Pick<TestSummary, 'submitted' | 'batchStudents'>) {
  return { submitted: t.submitted, total: t.batchStudents, percent: t.batchStudents ? Math.round((t.submitted / t.batchStudents) * 100) : 0 };
}

/** "Asha Rao" → "AR", "asha" → "A". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** "1 student", "3 students". */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
