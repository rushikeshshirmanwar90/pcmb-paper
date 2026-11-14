import type { Question } from '../../../types/pcmb';

// A teacher's edit of a question for one paper or test. The edit is a private
// copy: it travels with the picked question (into the PDF, or into the test's
// own stored questions) and never changes the shared question bank.

export type OptionKey = 'A' | 'B' | 'C' | 'D';
export const OPTION_KEYS: readonly OptionKey[] = ['A', 'B', 'C', 'D'];

/** What the editor holds while the teacher types. */
export interface QuestionDraft {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** The key: A, B, C or D for a multiple-choice question; the value for a numerical one. */
  correctAnswer: string;
}

export const draftOf = (q: Question): QuestionDraft => ({
  questionText: q.questionText ?? '',
  optionA: q.optionA ?? '',
  optionB: q.optionB ?? '',
  optionC: q.optionC ?? '',
  optionD: q.optionD ?? '',
  correctAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '',
});

const isNumerical = (q: Pick<Question, 'answerType'>) => q.answerType === 'Numerical';

/** A choice with a figure but no text still counts as there (its figure is the option). */
const hasOption = (q: Question, draft: QuestionDraft, key: OptionKey) => !!draft[`option${key}`].trim() || !!q.optionDiagramUrls?.[key]?.length;

/** The first thing that stops the edit from being saved, in words a teacher acts on; null when it is fine. */
export function editProblem(q: Question, draft: QuestionDraft): string | null {
  if (!draft.questionText.trim()) return 'Enter the question text.';
  const answer = draft.correctAnswer.trim();
  if (isNumerical(q)) return answer ? null : 'Enter the correct answer.';
  const filled = OPTION_KEYS.filter((key) => hasOption(q, draft, key));
  if (filled.length < 2) return 'Give at least two options.';
  const letters = answer.toUpperCase().match(/[ABCD]/g) ?? [];
  if (!letters.length) return 'Choose the correct option.';
  const missing = letters.find((key) => !filled.includes(key as OptionKey));
  return missing ? `Option ${missing} is empty. Fill it in or choose another correct option.` : null;
}

/** Whether the draft differs from the question. */
export const isChanged = (q: Question, draft: QuestionDraft) => {
  const now = draftOf(q);
  return (Object.keys(now) as (keyof QuestionDraft)[]).some((field) => now[field] !== draft[field]);
};

/** The question with the draft applied and marked edited; the question itself when nothing changed. */
export function applyEdit(q: Question, draft: QuestionDraft): Question {
  if (!isChanged(q, draft)) return q;
  return {
    ...q,
    questionText: draft.questionText.trim(),
    optionA: draft.optionA.trim(),
    optionB: draft.optionB.trim(),
    optionC: draft.optionC.trim(),
    optionD: draft.optionD.trim(),
    correctAnswer: isNumerical(q) ? draft.correctAnswer.trim() : draft.correctAnswer.trim().toUpperCase(),
    edited: true,
  };
}

/**
 * Questions just checked against the bank come back as the bank has them;
 * the teacher's edited copies replace them, so checking never undoes an edit.
 */
export function keepEdits(fresh: Question[], local: Question[]): Question[] {
  const edited = new Map(local.filter((q) => q.edited).map((q) => [q._id, q]));
  return fresh.map((q) => edited.get(q._id) ?? q);
}
