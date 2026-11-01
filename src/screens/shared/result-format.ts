// How test results are worded and filtered, kept free of React so it can be tested on its own
// (tests/test-results.test.mjs). The server decides every figure (papers/src/lib/test-results.ts);
// nothing here marks an answer or works out a rank. Type imports only.
import type { QuestionOutcome, QuestionStatistic, RankingRow, TestResults, TopicLevel, TopicPerformance } from '../../services/school-api';
import type { TestAnalytics } from '../../services/student-api';

/** The server's rule for calling a topic weak or strong (papers/src/lib/test-results.ts), repeated here only to explain it. */
export const MIN_TOPIC_QUESTIONS = 2;
export const MIN_TOPIC_ANSWERS_BATCH = 5;
export const MIN_TOPIC_ANSWERS_STUDENT = 2;

const MINUTE = 60;
const HOUR = 3600;

/** "30 sec", "4 min 32 sec", "12 min", "1 h 5 min". A 30-second attempt is never "0 min". */
export function durationLabel(seconds: number | null | undefined): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds as number)) : 0;
  if (s < MINUTE) return `${s} sec`;
  if (s < HOUR) {
    const m = Math.floor(s / MINUTE);
    const rest = s % MINUTE;
    return rest ? `${m} min ${rest} sec` : `${m} min`;
  }
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / MINUTE);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A number with at most two decimals and a real minus sign: 11, 4.5, −2. */
export function numberLabel(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const abs = Math.round(Math.abs(n) * 100) / 100;
  return `${n < 0 && abs !== 0 ? '−' : ''}${abs}`;
}

/** A percent to at most one decimal ("68%", "62.5%", "−10%"); "–" when there is nothing to divide by. */
export function percentLabel(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '–';
  const abs = Math.round(Math.abs(p) * 10) / 10;
  return `${p < 0 && abs !== 0 ? '−' : ''}${abs}%`;
}

/** "11 / 20" */
export const scoreOfLabel = (score: number, max: number) => `${numberLabel(score)} / ${numberLabel(max)}`;

/** The tone a percentage reads as: the 70% / 40% marks the teacher's other views use. */
export const toneOfPercent = (p: number | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' =>
  p === null || p === undefined || !Number.isFinite(p) ? 'neutral' : p >= 70 ? 'success' : p < 40 ? 'danger' : 'warning';

// ─── Rankings ──────────────────────────────────────────────────────────────

export type RankFilter = 'all' | 'top' | 'needs-improvement' | 'not-attempted';
export const RANK_FILTERS: readonly RankFilter[] = ['all', 'top', 'needs-improvement', 'not-attempted'];
export const RANK_FILTER_LABELS: Record<RankFilter, string> = {
  all: 'All',
  top: 'Top Performers',
  'needs-improvement': 'Needs Improvement',
  'not-attempted': 'Not Attempted',
};

/** Whether the search text is in the name (case and surrounding spaces ignored); an empty search matches all. */
export const matchesName = (name: string, query: string) => {
  const q = query.trim().toLowerCase();
  return !q || name.toLowerCase().includes(q);
};

/** The ranked rows under a filter and search. "Not Attempted" has no ranked rows: those students are listed apart. */
export function filterRankings(rows: RankingRow[], filter: RankFilter, query = ''): RankingRow[] {
  if (filter === 'not-attempted') return [];
  return rows.filter((r) => (filter === 'all' || r.band === filter) && matchesName(r.student.name, query));
}

/** The students who did not attempt the test, under the search. */
export const filterNotAttempted = <T extends { name: string }>(students: T[], query = '') => students.filter((s) => matchesName(s.name, query));

/** How many rows each filter holds, for the chips. */
export function filterCounts(results: Pick<TestResults, 'rankings' | 'notAttempted'>): Record<RankFilter, number> {
  return {
    all: results.rankings.length,
    top: results.rankings.filter((r) => r.band === 'top').length,
    'needs-improvement': results.rankings.filter((r) => r.band === 'needs-improvement').length,
    'not-attempted': results.notAttempted.length,
  };
}

/**
 * The highest and lowest scorers, as lists (ties share a place). The lowest is empty when everyone
 * scored the same, so the same names are not shown as both best and worst.
 */
export function extremes(rankings: RankingRow[]): { highest: RankingRow[]; lowest: RankingRow[] } {
  if (!rankings.length) return { highest: [], lowest: [] };
  const top = rankings[0].rank;
  const bottom = rankings[rankings.length - 1].rank;
  return {
    highest: rankings.filter((r) => r.rank === top),
    lowest: top === bottom ? [] : rankings.filter((r) => r.rank === bottom),
  };
}

/** "Asha", "Asha and Ben", "Asha, Ben and 2 more" */
export function namesLabel(rows: Pick<RankingRow, 'student'>[], limit = 2): string {
  const names = rows.map((r) => r.student.name);
  if (names.length <= limit) return names.join(' and ');
  return `${names.slice(0, limit).join(', ')} and ${names.length - limit} more`;
}

export const RESULT_STATE_WORDS: Record<RankingRow['state'], string> = {
  submitted: 'Submitted',
  'auto-submitted': 'Auto-submitted',
  violation: 'Violation',
};

/** The line under a student in the rankings. */
export const rankingLine = (r: RankingRow) =>
  `${percentLabel(r.percentage)} · ${r.accuracy === null ? 'no answers' : `${percentLabel(r.accuracy)} accuracy`} · ${durationLabel(r.timeTakenSeconds)}`;

/** The whole row for a screen reader. */
export const rankingSpoken = (r: RankingRow, max: number) =>
  `Rank ${r.rank}, ${r.student.name}, ${numberLabel(r.score)} out of ${numberLabel(max)}, ${percentLabel(r.percentage)}, ${
    r.accuracy === null ? 'nothing answered' : `accuracy ${percentLabel(r.accuracy)}`
  }, time ${durationLabel(r.timeTakenSeconds)}, ${RESULT_STATE_WORDS[r.state]}`;

// ─── Questions ─────────────────────────────────────────────────────────────

export type QuestionView = 'all' | 'mostCorrect' | 'mostIncorrect' | 'mostSkipped';
export const QUESTION_VIEWS: readonly QuestionView[] = ['all', 'mostCorrect', 'mostIncorrect', 'mostSkipped'];
export const QUESTION_VIEW_LABELS: Record<QuestionView, string> = {
  all: 'All',
  mostCorrect: 'Most Correct',
  mostIncorrect: 'Most Incorrect',
  mostSkipped: 'Most Skipped',
};

/** The questions to list: all in test order, or the server's top few of a kind in its order. */
export function questionsForView(results: Pick<TestResults, 'questions' | 'highlights'>, view: QuestionView): QuestionStatistic[] {
  if (view === 'all') return results.questions;
  return results.highlights[view].map((i) => results.questions.find((q) => q.index === i)).filter((q): q is QuestionStatistic => !!q);
}

/** "Question 5 — Electrostatics", or just the number when the question carries no topic or chapter. */
export const questionHeading = (q: Pick<QuestionStatistic, 'index' | 'topic' | 'chapter'>) => {
  const where = q.topic || q.chapter;
  return where ? `Question ${q.index + 1} — ${where}` : `Question ${q.index + 1}`;
};

/** "Correct: 12 · Incorrect: 18 · Unanswered: 5" */
export const questionCounts = (q: Pick<QuestionStatistic, 'correct' | 'incorrect' | 'unanswered'>) =>
  `Correct: ${q.correct} · Incorrect: ${q.incorrect} · Unanswered: ${q.unanswered}`;

export const OUTCOME_WORDS: Record<QuestionOutcome, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' }> = {
  correct: { label: 'Correct', tone: 'success' },
  incorrect: { label: 'Incorrect', tone: 'danger' },
  unanswered: { label: 'Unanswered', tone: 'neutral' },
  unmarked: { label: 'Not marked', tone: 'warning' },
};

export type OutcomeFilter = 'all' | QuestionOutcome;

/** "+4", "−1" or "0" for the marks of a question. */
export const marksLabel = (marks: number) => (marks > 0 ? `+${numberLabel(marks)}` : numberLabel(marks));

// ─── Topics ────────────────────────────────────────────────────────────────

export const LEVEL_WORDS: Record<TopicLevel, { label: string; tone: 'success' | 'neutral' | 'danger' | 'warning' }> = {
  strong: { label: 'Strong', tone: 'success' },
  average: { label: 'Average', tone: 'warning' },
  weak: { label: 'Needs work', tone: 'danger' },
  'not-enough': { label: 'Not enough data', tone: 'neutral' },
};

/** Topics grouped under their subject, in the server's order; questions with no topic or chapter form their own group. */
export function groupTopics(topics: TopicPerformance[]): { title: string; topics: TopicPerformance[] }[] {
  const groups: { title: string; topics: TopicPerformance[] }[] = [];
  for (const t of topics) {
    const title = t.classified ? t.subject || 'Other' : 'Unclassified';
    const group = groups.find((g) => g.title === title);
    if (group) group.topics.push(t);
    else groups.push({ title, topics: [t] });
  }
  return groups;
}

/** "6 of 8 correct · 22 of 32 marks", or what is missing. */
export function topicLine(t: TopicPerformance): string {
  if (!t.attempted) return `Nothing answered · ${t.questions} question${t.questions === 1 ? '' : 's'}`;
  return `${t.correct} of ${t.attempted} answered correct · ${numberLabel(t.marks)} of ${numberLabel(t.maxMarks)} marks`;
}

/** Why a topic has no verdict yet, in the words of the rule. */
export function notEnoughReason(audience: 'batch' | 'student'): string {
  const answers = audience === 'batch' ? MIN_TOPIC_ANSWERS_BATCH : MIN_TOPIC_ANSWERS_STUDENT;
  return `A topic is rated once ${MIN_TOPIC_QUESTIONS} of its questions have been answered and it has ${answers} answers in all.`;
}

/** A weak topic's evidence: "Accuracy: 38% · Correct: 5/13 attempted". */
export const weakEvidence = (t: Pick<TopicPerformance, 'accuracy' | 'correct' | 'attempted'>) =>
  `Accuracy: ${percentLabel(t.accuracy)} · Correct: ${t.correct}/${t.attempted} attempted`;

// ─── A student's own figures ───────────────────────────────────────────────

export type ResultSection = 'overview' | 'questions' | 'topics';
export const RESULT_SECTIONS: readonly { value: ResultSection; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'questions', label: 'Question Review' },
  { value: 'topics', label: 'Topic Performance' },
];

/**
 * The figures of "Your test result". The server's analytics are used when they came; an older server
 * sends only the counts, from which the same figures are worked out (never a different score).
 */
export function resultFigures(
  test: { marksPerQuestion: number; negativeMarks: number; durationMinutes: number },
  result: { score: number; maxScore: number; correct: number; wrong: number; skipped: number; timeTakenSeconds: number },
  analytics: Pick<TestAnalytics, 'rank' | 'ranked' | 'percentage' | 'accuracy' | 'negativeDeducted'> | null | undefined
) {
  const answered = result.correct + result.wrong;
  const percentage = analytics ? analytics.percentage : result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 1000) / 10 : null;
  const accuracy = analytics ? analytics.accuracy : answered ? Math.round((result.correct / answered) * 1000) / 10 : null;
  const negativeDeducted = analytics ? analytics.negativeDeducted : Math.round(result.wrong * test.negativeMarks * 100) / 100;
  return {
    percentage,
    accuracy,
    negativeDeducted,
    rank: analytics ? `${analytics.rank} of ${analytics.ranked}` : null,
    time: `${durationLabel(result.timeTakenSeconds)} of ${test.durationMinutes} min`,
  };
}
