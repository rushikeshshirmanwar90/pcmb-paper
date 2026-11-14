import type { Question } from '../../../types/pcmb';
import type { BankScope } from '../make-pdf/bank-scope';

/** One subject's part of a selection: its own filters and the questions picked for it. Its count is simply how many are picked. */
export interface SubjectSelection {
  subject: string;
  scope: BankScope;
  questions: Question[];
}

/** The most questions one test or PDF can have, across all its subjects. */
export const MAX_SELECTED = 300;

/** Existing picks, filters and order survive adding or removing other subjects; a new subject starts empty. */
export function selectSubjects(previous: SubjectSelection[], subjects: string[], base: BankScope): SubjectSelection[] {
  return subjects.map((subject) => previous.find((s) => s.subject === subject) ?? {
    subject, scope: { ...base, subject, chapters: [], topics: [], years: [], search: '' }, questions: [],
  });
}

export const selectedQuestions = (sessions: SubjectSelection[]) => sessions.flatMap((s) => s.questions);
export const selectedCount = (sessions: SubjectSelection[]) => sessions.reduce((n, s) => n + s.questions.length, 0);

/** What still stops the selection from being used, in words a teacher acts on; null when it's ready. */
export function selectionProblem(sessions: SubjectSelection[]): string | null {
  if (!sessions.length) return 'Select at least one subject.';
  const empty = sessions.find((s) => !s.questions.length);
  if (empty) return `Choose questions for ${empty.subject}, or take ${empty.subject} off the subjects.`;
  if (selectedCount(sessions) > MAX_SELECTED) return `A test can have at most ${MAX_SELECTED} questions. Remove ${selectedCount(sessions) - MAX_SELECTED}.`;
  const ids = selectedQuestions(sessions).map((q) => q._id);
  return new Set(ids).size === ids.length ? null : 'A question is selected more than once.';
}
