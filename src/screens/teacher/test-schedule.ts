// The teacher's test timing and test list rules, kept free of React so they
// can be tested on their own. The server checks the same rules again when a
// test is saved (papers/src/lib/tests.ts); these only give the teacher the
// message early.
import type { TestStatus } from '../../services/school-api';

const MINUTE = 60 * 1000;

/** A time picked "for later" must be at least this far ahead, so it is still ahead by the time it's saved. */
export const LEAD_MS = MINUTE;
/** Closing times are suggested in steps of this many minutes. */
const ROUND_MINUTES = 5;
/** Extra time suggested after the time limit, for students who start late. */
const SLACK_MINUTES = 60;

export type StartMode = 'now' | 'later';

/** A suggested closing time: the time limit plus an hour for latecomers, to the next 5 minutes. */
export function suggestClosing(opensAt: Date, durationMinutes: number): Date {
  const raw = opensAt.getTime() + (durationMinutes + SLACK_MINUTES) * MINUTE;
  const step = ROUND_MINUTES * MINUTE;
  return new Date(Math.ceil(raw / step) * step);
}

/** The latest a student can start and still get the whole time limit. */
export const lastStartOf = (closesAt: Date, durationMinutes: number) => new Date(closesAt.getTime() - durationMinutes * MINUTE);

/** `day`'s date with `time` ("HH:MM", 24-hour) as the time of day, in the phone's time zone. */
export function withTime(day: Date, time: string): Date {
  const d = new Date(day);
  d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return d;
}

/** `time`'s time of day on `day`'s date. */
export function withDay(time: Date, day: Date): Date {
  const d = new Date(time);
  d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return d;
}

export const timeOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Marks for a full paper: no floating-point leftovers like 0.30000000000000004. */
export const maxMarks = (questions: number, marksPerQuestion: number) => Math.round(questions * marksPerQuestion * 100) / 100;

/** What's wrong with the marking or time limit as typed; null when fine. */
export function marksProblem(correctText: string, negativeText: string): string | null {
  const right = Number(correctText);
  const wrong = negativeText.trim() === '' ? 0 : Number(negativeText);
  if (!correctText.trim() || !Number.isFinite(right) || right < 1 || right > 100) return 'Marks for a right answer must be 1 to 100.';
  if (!Number.isFinite(wrong) || wrong < 0 || wrong > 100) return 'Marks taken off must be 0 to 100.';
  if (wrong > right) return "Marks taken off can't be more than the marks for a right answer.";
  return null;
}

export const durationProblem = (text: string) => {
  const n = Number(text);
  return text.trim() && Number.isInteger(n) && n >= 1 && n <= 600 ? null : 'The time limit must be 1 to 600 minutes.';
};

const when = (d: Date) => d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** What's wrong with the timing, in words for the teacher; null when it's fine. `now` is the phone's clock, only a first check. */
export function scheduleProblem(
  input: { mode: StartMode; opensAt: Date | null; closesAt: Date | null; durationMinutes: number },
  now: number = Date.now()
): string | null {
  const { mode, closesAt, durationMinutes } = input;
  const opensAt = mode === 'now' ? new Date(now) : input.opensAt;
  if (!opensAt) return 'Pick when the test opens.';
  if (mode === 'later' && opensAt.getTime() < now + LEAD_MS) return 'The opening time must be in the future.';
  if (!closesAt) return 'Pick when the test closes.';
  if (closesAt.getTime() <= opensAt.getTime()) return 'The test must close after it opens.';
  if (closesAt.getTime() - opensAt.getTime() < durationMinutes * MINUTE) {
    return `The test is open from ${when(opensAt)} to ${when(closesAt)}, shorter than its ${durationMinutes}-minute time limit. Close it later or shorten the time limit.`;
  }
  return null;
}

// ─── Managing tests ────────────────────────────────────────────────────────

export type TestFilter = 'all' | 'upcoming' | 'live' | 'completed';
export const TEST_FILTERS: readonly TestFilter[] = ['all', 'upcoming', 'live', 'completed'];
export const FILTER_LABELS: Record<TestFilter, string> = { all: 'All', upcoming: 'Upcoming', live: 'Live', completed: 'Completed' };
export const STATUS_FILTER: Record<TestStatus, Exclude<TestFilter, 'all'>> = { scheduled: 'upcoming', open: 'live', closed: 'completed' };
export const STATUS_WORDS: Record<TestStatus, { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  scheduled: { label: 'Upcoming', tone: 'warning' },
  open: { label: 'Live', tone: 'success' },
  closed: { label: 'Completed', tone: 'neutral' },
};

type Listed = { status: TestStatus; opensAt: string; closesAt: string | null };
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export const filterTests = <T extends Listed>(tests: T[], filter: TestFilter) =>
  filter === 'all' ? tests : tests.filter((t) => STATUS_FILTER[t.status] === filter);

/** Live first (closing soonest), then upcoming (opening soonest), then completed (closed most recently). */
export function sortTests<T extends Listed>(tests: T[]): T[] {
  const rank: Record<TestStatus, number> = { open: 0, scheduled: 1, closed: 2 };
  return [...tests].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === 'open' ? time(a.closesAt) - time(b.closesAt) : a.status === 'scheduled' ? time(a.opensAt) - time(b.opensAt) : time(b.closesAt) - time(a.closesAt))
  );
}

/** What a teacher may do with a test, by where it is. The server enforces the same. */
export function actionsFor(test: { status: TestStatus; started: number }) {
  const upcoming = test.status === 'scheduled' && test.started === 0;
  return {
    edit: upcoming,
    cancel: upcoming,
    closeNow: test.status === 'open',
    results: test.status === 'closed',
    submissions: test.status === 'open',
  };
}
