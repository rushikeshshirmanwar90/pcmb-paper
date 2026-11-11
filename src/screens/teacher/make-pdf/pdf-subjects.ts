import type { Question } from '../../../types/pcmb';

/** The server rejects a header subject longer than this (papers/src/lib/questionPaper/parse.ts). */
export const MAX_SUBJECT_HEADER = 80;

const key = (name: string) => name.trim().toLowerCase();

/** The subject a question belongs to; blank when the bank gave it none. */
const subjectOf = (question: Pick<Question, 'subject'>) => String(question.subject ?? '').trim();

/**
 * The subjects of the picked questions, each with how many, in the order they
 * first appear. The questions are already in the teacher's subject order, so
 * this is the order the PDF prints them in.
 */
export function subjectCounts(questions: readonly Pick<Question, 'subject'>[]): { subject: string; count: number }[] {
  const rows = new Map<string, { subject: string; count: number }>();
  for (const q of questions) {
    const name = subjectOf(q);
    if (!name) continue;
    const row = rows.get(key(name)) ?? { subject: name, count: 0 };
    row.count += 1;
    rows.set(key(name), row);
  }
  return [...rows.values()];
}

/** Distinct subjects in the order they first appear among the questions. */
export const deriveSubjects = (questions: readonly Pick<Question, 'subject'>[]) => subjectCounts(questions).map(row => row.subject);

/** The header text for the PDF request: all names when they fit, else the first ones and a count. */
export function subjectHeader(subjects: readonly string[]): string {
  const all = subjects.join(', ');
  if (all.length <= MAX_SUBJECT_HEADER) return all;
  for (let shown = subjects.length - 1; shown >= 1; shown--) {
    const text = `${subjects.slice(0, shown).join(', ')} +${subjects.length - shown} more`;
    if (text.length <= MAX_SUBJECT_HEADER) return text;
  }
  return `${subjects.length} subjects`;
}
