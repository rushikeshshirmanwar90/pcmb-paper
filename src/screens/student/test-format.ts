import type { IconName } from '@/components/kit';
import type { TestStatus, TestSummary } from '@/services/school-api';
import type { StudentTest } from '@/services/student-api';

// Small helpers shared by the student's test list, test runner and results.
// Type imports only, so they can be tested on their own
// (tests/student-tests.test.mjs).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The test's status at `now`, the same rule as the server's, so a list stays right while it's open. */
export function statusAt(test: Pick<TestSummary, 'opensAt' | 'closesAt'>, now: number): TestStatus {
  if (new Date(test.opensAt).getTime() > now) return 'scheduled';
  if (test.closesAt && new Date(test.closesAt).getTime() <= now) return 'closed';
  return 'open';
}

/**
 * A test with what is known of the student's attempt: `null` not started,
 * `undefined` not known (e.g. the list of attempts didn't load).
 */
export type ListedTest = TestSummary & { mine?: StudentTest['mine'] };

/** Where the student is with a test, which decides how it's shown and what tapping does. */
export type TestKind = 'upcoming' | 'start' | 'continue' | 'open' | 'done' | 'missed' | 'closed';

export function kindOf(test: ListedTest, now: number): TestKind {
  if (test.mine?.state === 'submitted') return 'done';
  const status = statusAt(test, now);
  if (status === 'scheduled') return 'upcoming';
  if (status === 'closed') return test.mine === null ? 'missed' : 'closed';
  if (test.mine === undefined) return 'open';
  return test.mine ? 'continue' : 'start';
}

const timeValue = (iso: string | null) => (iso ? new Date(iso).getTime() : Infinity);

/** Tests in progress first, then the ones closing soonest (no closing time last), then the newest. */
export const byUrgency = (a: ListedTest, b: ListedTest) =>
  Number(b.mine?.state === 'in-progress') - Number(a.mine?.state === 'in-progress') ||
  timeValue(a.closesAt) - timeValue(b.closesAt) ||
  timeValue(b.opensAt) - timeValue(a.opensAt);

const timeOf = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "today, 4:30 PM", "tomorrow, 9:00 AM" or "Mon, 3 Nov, 9:00 AM". */
export function whenLabel(iso: string, now: number) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(d) - startOfDay(new Date(now))) / DAY);
  if (days === 0) return `today, ${timeOf(d)}`;
  if (days === 1) return `tomorrow, ${timeOf(d)}`;
  if (days === -1) return `yesterday, ${timeOf(d)}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${timeOf(d)}`;
}

/** How long until `iso`: "in 25 min", "in 2 h 15 min", "in 3 days". Past times give "now". */
export function untilLabel(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= MINUTE) return ms > 0 ? 'in under a minute' : 'now';
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `in ${minutes} min`;
  if (ms < DAY) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `in ${h} h${m && h < 3 ? ` ${m} min` : ''}`;
  }
  const days = Math.round(ms / DAY);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Closing within a day: worth flagging. */
export const closesSoon = (test: Pick<TestSummary, 'closesAt'>, now: number) =>
  !!test.closesAt && new Date(test.closesAt).getTime() - now < DAY;

/** "42:10", or "1:02:03" from an hour up. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "4 minutes 32 seconds", for screen readers. */
export function spokenDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? '' : 's'}` : null);
  return [part(h, 'hour'), part(m, 'minute'), part(sec, 'second')].filter(Boolean).join(' ') || '0 seconds';
}

/** Score as a whole percent of the maximum (can be negative with negative marking). */
export const percentOf = (score: number, maxScore: number) => (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);

/** The tone a result reads as: the same bands the teacher's views use. */
export const resultTone = (percent: number): 'success' | 'warning' | 'danger' => (percent >= 70 ? 'success' : percent < 40 ? 'danger' : 'warning');

const SUBJECT_ICONS: Record<string, IconName> = {
  Physics: { ios: 'atom', android: 'atr' },
  Chemistry: { ios: 'flask', android: 'science' },
  Mathematics: { ios: 'function', android: 'calculate' },
  Biology: { ios: 'leaf', android: 'eco' },
  Science: { ios: 'testtube.2', android: 'biotech' },
};
const MIXED_ICON: IconName = { ios: 'list.clipboard', android: 'assignment' };

/** One icon per subject; mixed tests get the clipboard. */
export const subjectIcon = (subject: string): IconName => SUBJECT_ICONS[subject] ?? MIXED_ICON;

/** "30 questions · 60 min · 120 marks · −1 per wrong answer" */
export function factsLine(test: Pick<TestSummary, 'questionCount' | 'durationMinutes' | 'maxScore' | 'negativeMarks'>) {
  return [
    `${test.questionCount} question${test.questionCount === 1 ? '' : 's'}`,
    `${test.durationMinutes} min`,
    `${test.maxScore} marks`,
    test.negativeMarks ? `−${test.negativeMarks} per wrong answer` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
