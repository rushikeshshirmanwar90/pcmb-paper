import type { Question } from '../../../types/pcmb';
import type { BankScope } from '../make-pdf/bank-scope';

export interface SubjectSelection {
  subject: string;
  target: number;
  scope: BankScope;
  questions: Question[];
}

export const equalTargets = (total: number, subjects: readonly string[]) => subjects.map((_, i) => Math.floor(total / subjects.length) + (i < total % subjects.length ? 1 : 0));

/** Existing allocations, filters and order survive adding/removing other subjects. */
export function selectSubjects(previous: SubjectSelection[], subjects: string[], base: BankScope, total: number): SubjectSelection[] {
  const targets = equalTargets(total, subjects);
  return subjects.map((subject, i) => previous.find(s => s.subject === subject) ?? {
    subject, target: targets[i], scope: { ...base, subject, chapters: [], topics: [], years: [], search: '' }, questions: [],
  });
}

export const selectedQuestions = (sessions: SubjectSelection[]) => sessions.flatMap(s => s.questions);
export const targetTotal = (sessions: SubjectSelection[]) => sessions.reduce((sum, s) => sum + s.target, 0);
export const remaining = (session: SubjectSelection) => Math.max(0, session.target - session.questions.length);
export function selectionProblem(sessions: SubjectSelection[]): string | null {
  if (!sessions.length) return 'Select at least one subject.';
  if (targetTotal(sessions) < 1 || targetTotal(sessions) > 300) return 'The total target must be from 1 to 300.';
  for (const s of sessions) {
    if (!Number.isInteger(s.target) || s.target < 0) return `${s.subject} needs a whole-number target.`;
    if (s.questions.length !== s.target) return `${s.subject}: ${s.questions.length}/${s.target} selected. Add/remove questions or edit the target before continuing.`;
  }
  const ids = selectedQuestions(sessions).map(q => q._id);
  return new Set(ids).size === ids.length ? null : 'A question is selected more than once.';
}
