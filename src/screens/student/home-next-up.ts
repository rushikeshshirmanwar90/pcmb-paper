import type { TimetableEntry } from '@/services/school-api';

// What Home's "Next up" shows when there's no test to take: the class on now,
// or the next one in the weekly timetable. Type imports only, so it can be
// tested on its own (tests/student-home.test.mjs).

export type NextClass = {
  entry: TimetableEntry;
  /** Days from today: 0 today … 7 the same weekday next week. */
  inDays: number;
  /** On right now. */
  ongoing: boolean;
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** The class on now, or the next to start, from a weekly timetable (days 0–6, Sunday first). */
export function nextClass(entries: TimetableEntry[], now: Date): NextClass | null {
  if (!entries.length) return null;
  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let inDays = 0; inDays <= 7; inDays++) {
    const day = (today + inDays) % 7;
    const onDay = entries.filter((e) => e.day === day).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    for (const entry of onDay) {
      if (inDays === 0 && minutesOf(entry.end) <= nowMinutes) continue; // over for today; next week's comes at inDays 7
      return { entry, inDays, ongoing: inDays === 0 && minutesOf(entry.start) <= nowMinutes };
    }
  }
  return null;
}
