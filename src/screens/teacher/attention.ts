// What needs a teacher now, for Home's "Needs attention": students paused in a
// test and waiting for a decision first (fairness: they're stuck until a
// teacher acts), then live tests, results that just came in, and tests about
// to open. From the teacher's test list; nothing is decided here.
import type { TestSummary } from '@/services/school-api';

export type AttentionKind = 'waiting' | 'live' | 'results' | 'opening';

export interface AttentionRow {
  kind: AttentionKind;
  testId: string;
  title: string;
  detail: string;
  /** The test's subject text ("Physics, Chemistry" for a multi-subject test), shown as chips. */
  subjects: string;
}

/** Results stay "ready" this long after a test closes. */
export const RESULTS_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
/** A test opening within this long shows as "opening". */
export const OPENING_SOON_MS = 24 * 60 * 60 * 1000;

const ORDER: Record<AttentionKind, number> = { waiting: 0, live: 1, results: 2, opening: 3 };

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const day = (iso: string, now: number) => {
  const d = new Date(iso);
  const today = new Date(now);
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return same(d, today) ? `today ${time(iso)}` : same(d, tomorrow) ? `tomorrow ${time(iso)}` : d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
};
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function attentionRows(tests: TestSummary[], now: number): AttentionRow[] {
  const rows: (AttentionRow & { at: number })[] = [];
  for (const t of tests) {
    const subjects = t.subject;
    const opens = new Date(t.opensAt).getTime();
    const closes = new Date(t.closesAt).getTime();
    if (t.pendingResolution) {
      rows.push({ kind: 'waiting', testId: t.id, title: `Students waiting for you · ${t.title}`, detail: 'Paused in the test. Decide whether they continue.', subjects, at: closes });
      continue;
    }
    if (t.status === 'open') {
      rows.push({ kind: 'live', testId: t.id, title: `Live: ${t.title}`, detail: `${t.submitted}/${t.batchStudents} submitted · closes ${day(t.closesAt, now)}`, subjects, at: closes });
    } else if (t.status === 'closed' && t.submitted > 0 && now - closes <= RESULTS_FRESH_MS) {
      const avg = t.averageScore === null ? '' : ` · average ${num(t.averageScore)}/${num(t.maxScore)}`;
      rows.push({ kind: 'results', testId: t.id, title: `Results ready: ${t.title}`, detail: `${t.submitted} took it${avg}`, subjects, at: -closes });
    } else if (t.status === 'scheduled' && opens - now <= OPENING_SOON_MS) {
      rows.push({ kind: 'opening', testId: t.id, title: `Opens ${day(t.opensAt, now)}: ${t.title}`, detail: `${t.batch.name} · ${t.questionCount} questions · ${t.durationMinutes} min`, subjects, at: opens });
    }
  }
  return rows.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.at - b.at).map(({ at: _at, ...row }) => row);
}
