// The question picks of a test being edited, kept free of React so they can be
// tested on their own. A test holds copies of bank questions with a `sourceId`;
// the picker identifies questions by the bank's id, so the copies are seeded
// under their `sourceId`. Copies whose source is unknown keep a stable
// `saved:` id so they stay in the test until the teacher removes them.
import type { Question } from '../../types/pcmb';

type SavedCopy = Omit<Question, '_id' | 'questionNumber'> & { sourceId: string | null };

/** A test's saved questions as the picker holds them, in the test's order, each once. */
export function pickerQuestions(saved: SavedCopy[]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  saved.forEach((q, i) => {
    const id = q.sourceId || `saved:${i}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ ...q, _id: id, questionNumber: out.length + 1 });
  });
  return out;
}

/** The chapter and topic the picker opens on: the first saved question that names both. */
export function seedTopic(saved: Pick<Question, 'chapter' | 'topic'>[]): { chapter: string; topic: string } | null {
  const q = saved.find((s) => s.chapter?.trim() && s.topic?.trim());
  return q ? { chapter: q.chapter, topic: q.topic } : null;
}

/**
 * A fetched pool as the picker lists it. A question the picker already holds
 * (a saved copy, or one the teacher edited) keeps its held version, so a
 * refetch never replaces it with the bank's.
 */
export function reconcilePool(pool: Question[], known: Map<string, Question>): Question[] {
  return pool.map((q) => known.get(q._id) ?? q);
}

/** The picked questions in the order they were picked (the test's own order first), each once. */
export function pickedInOrder(picked: Iterable<string>, known: Map<string, Question>): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const id of picked) {
    const q = known.get(id);
    if (q && !seen.has(id)) {
      seen.add(id);
      out.push(q);
    }
  }
  return out;
}

/** What the edit picker lists: this topic's questions, or every pick whatever topic it is from. */
export function pickerList(view: 'all' | 'selected', pool: Question[], picked: Iterable<string>, known: Map<string, Question>): Question[] {
  return view === 'selected' ? pickedInOrder(picked, known) : pool;
}

/** Where Back goes from a test wizard step (1 Details, 2 Questions, 3 Marking, 4 Review, 5 Done): out, or one step back. */
export function stepBack(step: number): 'leave' | 1 | 2 | 3 {
  return step <= 1 || step >= 5 ? 'leave' : ((step - 1) as 1 | 2 | 3);
}

/** Whether an edit-mode picker takes Back itself: only to leave Change topic for its question list. */
export function pickerTakesBack(editing: boolean, pickerStep: string): boolean {
  return editing && pickerStep === 'config';
}
