import type { AnswerUpdate } from './answer-saver';

export type SavedAnswer = { index: number; selected: string | null; version?: number };

/** Legacy drafts may only fill an untouched question. Versioned drafts must
 * match exactly; a newer server answer wins even when the phone was offline. */
export function restorableAnswers(pending: AnswerUpdate[], saved: SavedAnswer[]) {
  const server = new Map(saved.map(a => [a.index, a]));
  return pending.filter(p => {
    const current = server.get(p.index);
    return p.baseVersion === undefined
      ? !current || ((current.version ?? 0) === 0 && current.selected === null)
      : p.baseVersion === (current?.version ?? 0) && p.selected !== (current?.selected ?? null);
  });
}

/** Merge a status refresh without losing unsaved edits based on the same
 * server version. Conflicting older pending answers are replaced by the server. */
export function mergeSavedAnswers(local: Map<number, string | null>, pending: AnswerUpdate[], saved: SavedAnswer[]) {
  const keep = new Set(restorableAnswers(pending, saved).map(p => p.index));
  const next = new Map(local);
  for (const answer of saved) if (!keep.has(answer.index)) next.set(answer.index, answer.selected);
  return next;
}
