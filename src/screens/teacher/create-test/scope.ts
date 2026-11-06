// What the chosen batches mean for a new test: their shared course, exam and class,
// the subjects they allow, and the question-bank scope that follows. Plain functions,
// so each rule is tested without a screen. The server checks the same rules again
// (papers/src/lib/test-access.ts, sharedScope); change both together.

export interface TestBatch {
  id: string;
  name: string;
  program: string | null;
  standard: string | null;
  subjects: string[];
  questionBank: 'JEE' | 'NEET' | null;
}

export interface Derived {
  course: 'Competitive';
  exam: 'JEE' | 'NEET';
  standard: string;
  subjects: string[];
  /** "Competitive / JEE / Class 12" */
  label: string;
}

const COMPETITIVE_SUBJECTS: Record<'JEE' | 'NEET', string[]> = { JEE: ['Physics', 'Chemistry', 'Mathematics'], NEET: ['Physics', 'Chemistry', 'Biology'] };

const labelOf = (b: TestBatch) => `${b.questionBank ?? b.program ?? 'No exam'} ${b.standard ?? 'no class'}`;

/** The shared scope of the chosen batches, null when none is chosen, or the reason they don't fit together. */
export function deriveScope(batches: TestBatch[]): Derived | { error: string } | null {
  if (!batches.length) return null;
  const without = batches.find((b) => !b.questionBank);
  if (without) return { error: `There is no question bank for ${without.name} yet, so a test can't be set for it.` };
  const banks = new Set(batches.map((b) => b.questionBank));
  const standards = new Set(batches.map((b) => b.standard));
  if (banks.size > 1 || standards.size > 1) {
    const kinds = [...new Set(batches.map(labelOf))];
    return { error: `${kinds.join(' and ')} batches can't share one test. Choose batches of the same exam and class.` };
  }
  const exam = batches[0].questionBank as 'JEE' | 'NEET';
  const standard = batches[0].standard;
  if (!standard) return { error: 'Every chosen batch needs a class.' };
  const subjects = COMPETITIVE_SUBJECTS[exam].filter((s) => batches.every((b) => b.subjects.includes(s)));
  return { course: 'Competitive', exam, standard, subjects, label: `Competitive / ${exam} / Class ${standard.replace(/\D/g, '')}` };
}

export const isDerived = (d: ReturnType<typeof deriveScope>): d is Derived => !!d && !('error' in d);

/** The same scope and subject, or '' when either changed: the filters and picked questions then no longer apply. */
export const scopeId = (d: Derived | null, subject: string) => (d ? `${d.exam}|${d.standard}|${subject}` : '');

/** Whether a duplicate display name needs a suffix to tell two apart. */
export function uniqueLabels<T extends { id: string; name: string }>(rows: T[]): { id: string; label: string }[] {
  return rows.map((row) => ({ id: row.id, label: rows.filter((o) => o.name === row.name).length > 1 ? `${row.name} (${row.id.slice(-4)})` : row.name }));
}
