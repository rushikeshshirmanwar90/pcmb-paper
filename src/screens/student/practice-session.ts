// The PYQ practice session's sums, kept free of React so they can be tested
// on their own (tests/student-practice.test.mjs).

export type PracticeResult = { correct: boolean; selected: string };

/** Whole-percent accuracy of answered questions; null when nothing was answered. */
export const accuracyOf = (correct: number, answered: number) => (answered > 0 ? Math.round((correct / answered) * 100) : null);

/** The same bands as the rest of the app: ≥70 % good, <40 % needs work. */
export const toneOf = (accuracy: number): 'success' | 'warning' | 'danger' => (accuracy >= 70 ? 'success' : accuracy < 40 ? 'danger' : 'warning');

/** Attempted, correct, wrong, skipped and accuracy for one round, and the questions answered wrongly (in order). */
export function sessionStats<Q extends { _id: string }>(questions: Q[], results: Record<string, PracticeResult>, skipped: Set<string>) {
  const answered = questions.filter((q) => results[q._id]);
  const correct = answered.filter((q) => results[q._id].correct).length;
  const wrongQuestions = answered.filter((q) => !results[q._id].correct);
  return {
    attempted: answered.length,
    correct,
    wrong: wrongQuestions.length,
    skipped: questions.filter((q) => skipped.has(q._id) && !results[q._id]).length,
    accuracy: accuracyOf(correct, answered.length),
    wrongQuestions,
  };
}

/** Where "Keep practising" carries on in the bank: just after the last question seen there. */
export const resumePosition = (lastSeen: number, loaded: number) => Math.min(lastSeen + 1, loaded);

/** Whether the bank has questions after `lastSeen`: loaded already, or another page to load. */
export const canResume = (lastSeen: number, loaded: number, morePages: boolean) => lastSeen < loaded - 1 || morePages;
