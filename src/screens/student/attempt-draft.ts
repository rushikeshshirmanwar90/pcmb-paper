import type { AnswerUpdate } from './answer-saver';

// What the phone keeps about a test attempt in progress, so it survives leaving
// the test or the app being closed: questions marked for review, and answers
// the server hasn't confirmed yet. No React or storage here, so it can be
// tested on its own (tests/student-tests.test.mjs).

export interface AttemptDraft {
  /** Identifies the attempt: a draft from an earlier attempt is ignored. */
  startedAt: string;
  marks: number[];
  pending: AnswerUpdate[];
}

/** One key per user and test; letters, digits, "." and "_" only, so it is also a safe file name. */
export const draftKey = (userId: string, testId: string) =>
  `pcmb.attempt.${userId.replace(/[^A-Za-z0-9]/g, '')}.${testId.replace(/[^A-Za-z0-9]/g, '')}`;

/** Nothing worth keeping: no marks and nothing waiting to be saved. */
export const isEmptyDraft = (draft: AttemptDraft) => !draft.marks.length && !draft.pending.length;

export const encodeDraft = (draft: AttemptDraft) => JSON.stringify(draft);

const MAX_ITEMS = 500;
const isIndex = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 10_000;

/** The stored draft for this attempt, or null when missing, damaged or from another attempt. */
export function decodeDraft(raw: string | null, startedAt: string): AttemptDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<AttemptDraft>;
  if (v.startedAt !== startedAt) return null;
  const marks = Array.isArray(v.marks) ? [...new Set(v.marks.filter(isIndex))].slice(0, MAX_ITEMS) : [];
  const pending = Array.isArray(v.pending)
    ? v.pending
        .filter(
          (p): p is AnswerUpdate =>
            !!p && typeof p === 'object' && isIndex(p.index) && (p.selected === null || (typeof p.selected === 'string' && p.selected.length <= 20))
        )
        .slice(0, MAX_ITEMS)
        .map((p) => ({ index: p.index, selected: p.selected }))
    : [];
  return { startedAt, marks, pending };
}
