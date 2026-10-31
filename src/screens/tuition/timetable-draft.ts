// The subject timetable editor's rules, kept free of React so they can be
// tested on their own (tests/step25.test.mjs). Times are stored as 24-hour
// "HH:MM", as the server keeps them, and shown in 12-hour AM/PM.

/** Monday to Saturday: the usual teaching days (offered as a shortcut, never picked by themselves). */
export const TEACHING_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6];
/** Monday first, Sunday last. */
export const WEEK: readonly number[] = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** A new class starts here until changed: 10–11 AM. */
export const DEFAULT_START = '10:00';
export const DEFAULT_END = '11:00';

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');

/** "16:30" → "4:30 PM", "00:05" → "12:05 AM". */
export function label12(time: string) {
  const h = Number(time.slice(0, 2));
  return `${h % 12 || 12}:${time.slice(3, 5)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** 12-hour parts → "HH:MM". */
export function from12(hour: number, minute: number, pm: boolean) {
  return `${pad((hour % 12) + (pm ? 12 : 0))}:${pad(minute)}`;
}

/** "HH:MM" → its 12-hour parts. */
export function to12(time: string) {
  const h = Number(time.slice(0, 2));
  return { hour: h % 12 || 12, minute: Number(time.slice(3, 5)), pm: h >= 12 };
}

/** A Date at this time today (for native time pickers), and back. */
export function timeToDate(time: string, today = new Date()) {
  const d = new Date(today);
  d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return d;
}
export const dateToTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "2 h", "1 h 30 min", "45 min". */
export function duration(start: string, end: string) {
  const m = toMinutes(end) - toMinutes(start);
  const h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h} h ${m % 60} min` : `${h} h`) : `${m} min`;
}

/** "Mon–Sat", "Mon, Wed, Fri", "Sunday": the days in week order, runs of three or more joined. */
export function daysLabel(days: readonly number[]) {
  const ordered = WEEK.filter((d) => days.includes(d));
  if (ordered.length === 1) return DAY_NAMES[ordered[0]];
  const parts: string[] = [];
  for (let i = 0; i < ordered.length; ) {
    let j = i;
    while (j + 1 < ordered.length && WEEK.indexOf(ordered[j + 1]) === WEEK.indexOf(ordered[j]) + 1) j++;
    parts.push(j - i >= 2 ? `${DAY_SHORT[ordered[i]]}–${DAY_SHORT[ordered[j]]}` : ordered.slice(i, j + 1).map((d) => DAY_SHORT[d]).join(', '));
    i = j + 1;
  }
  return parts.join(', ');
}

/** A class of the batch, as far as these checks care. */
export interface ClassTime {
  id: string;
  subject: string;
  day: number;
  start: string;
  end: string;
}

/** The batch's classes in timetable order: Monday first, then by start time. */
export const sortClasses = <T extends ClassTime>(classes: T[]) => [...classes].sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day) || toMinutes(a.start) - toMinutes(b.start));

/**
 * Why a class of this subject on these days can't be added (or `exceptId`
 * moved there), or null when it can: no day, an end not after the start, or
 * an overlap with another of the batch's classes. Back to back is fine. The
 * server checks the same, and the teacher's other batches too.
 */
export function classProblem(classes: ClassTime[], days: readonly number[], start: string, end: string, exceptId?: string | null): string | null {
  if (!days.length) return 'Pick at least one day.';
  if (toMinutes(end) <= toMinutes(start)) return 'The class must end after it starts.';
  for (const day of WEEK.filter((d) => days.includes(d))) {
    const hit = classes.find((c) => c.id !== exceptId && c.day === day && toMinutes(c.start) < toMinutes(end) && toMinutes(start) < toMinutes(c.end));
    if (hit) return `On ${DAY_NAMES[day]} it overlaps ${hit.subject}, ${label12(hit.start)} – ${label12(hit.end)}.`;
  }
  return null;
}

/** Minutes of class a week. */
export const weeklyMinutes = (classes: ClassTime[]) => classes.reduce((n, c) => n + toMinutes(c.end) - toMinutes(c.start), 0);

/** Choices for the time chooser without a native picker: every 5 minutes. */
export const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);
