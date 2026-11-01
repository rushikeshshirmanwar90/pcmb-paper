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

export type Outcome = 'correct' | 'wrong' | 'skipped';

/**
 * The questions met this round, in the order they came, each with how it went.
 * A skipped question answered later counts as answered; questions never
 * reached are left out.
 */
export function sessionRows<Q extends { _id: string }>(questions: Q[], results: Record<string, PracticeResult>, skipped: Set<string>) {
  const rows: { index: number; question: Q; outcome: Outcome; selected: string | null }[] = [];
  questions.forEach((question, index) => {
    const r = results[question._id];
    if (r) rows.push({ index, question, outcome: r.correct ? 'correct' : 'wrong', selected: r.selected });
    else if (skipped.has(question._id)) rows.push({ index, question, outcome: 'skipped', selected: null });
  });
  return rows;
}

/** "5 of 8 answered right, 2 skipped": the counts as one phrase, for screen readers. */
export function countsLine(s: { attempted: number; correct: number; skipped: number }) {
  const parts: string[] = [];
  if (s.attempted) parts.push(`${s.correct} of ${s.attempted} answered right`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  return parts.join(', ') || 'No questions answered';
}

/** The round's result in words, leading the summary: a short title and what to do next. */
export function sessionVerdict(accuracy: number | null, wrong: number, skipped: number): { title: string; text: string } {
  if (accuracy === null) {
    return skipped
      ? { title: 'Nothing answered yet', text: `You skipped ${skipped === 1 ? 'the question' : `all ${skipped}`}. ${skipped === 1 ? "It's" : "They're"} still here when you're ready.` }
      : { title: 'Nothing answered yet', text: 'Answer a question to see how you did.' };
  }
  const missed = wrong ? `the ${wrong === 1 ? 'one' : wrong} you got wrong` : null;
  switch (toneOf(accuracy)) {
    case 'success':
      return { title: 'Strong round', text: missed ? `Check the solution to ${missed}, then keep going.` : 'Every answer right. Keep the run going.' };
    case 'warning':
      return { title: 'Getting there', text: `Read the solution to ${missed ?? 'each question'} below, then try ${wrong === 1 ? 'it' : 'them'} again.` };
    default:
      return { title: 'Needs more work', text: `Go through the solution to ${missed ?? 'each question'} below before moving on.` };
  }
}

/** Where "Keep practising" carries on in the bank: just after the last question seen there. */
export const resumePosition = (lastSeen: number, loaded: number) => Math.min(lastSeen + 1, loaded);

/** Whether the bank has questions after `lastSeen`: loaded already, or another page to load. */
export const canResume = (lastSeen: number, loaded: number, morePages: boolean) => lastSeen < loaded - 1 || morePages;
