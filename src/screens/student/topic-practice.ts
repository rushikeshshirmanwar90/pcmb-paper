// Topic practice: the pure parts (queries, labels, ordering), kept free of
// React and the API client so they can be tested on their own
// (tests/topic-practice.test.mjs).

import type { SchoolStandard, SchoolSubject } from '@/constants/school';

/** Which of a node's questions to load. */
export type PracticeStatus = 'all' | 'unanswered' | 'answered' | 'incorrect';

/**
 * The topic practice actions. "again" goes through every question once more;
 * new answers replace the saved ones (the latest try counts), nothing is reset.
 */
export type PracticeMode = 'continue' | 'review' | 'retry' | 'again';

export const STATUS_OF: Record<PracticeMode, PracticeStatus> = { continue: 'unanswered', review: 'answered', retry: 'incorrect', again: 'all' };

/** A place in the syllabus to practise: a chapter, or one of its topics. */
export interface PracticeNode {
  subject: SchoolSubject;
  standard: SchoolStandard;
  chapter: string;
  /** null: every question of the chapter. */
  topic: string | null;
}

export const PAGE_SIZE = 10;

export const ALL_CHAPTER_QUESTIONS = 'All chapter questions';
export const NO_EXPLANATION = 'Explanation is not available for this question yet.';

const enc = encodeURIComponent;

/** The query string for a page of a node's questions. */
export function practiceQuery(node: PracticeNode, status: PracticeStatus, after: string | null = null, limit = PAGE_SIZE): string {
  const parts: [string, string][] = [
    ['subject', node.subject],
    ['standard', node.standard],
    ['chapter', node.chapter],
  ];
  if (node.topic !== null) parts.push(['topic', node.topic]);
  parts.push(['status', status]);
  if (after) parts.push(['after', after]);
  parts.push(['limit', String(limit)]);
  return parts.map(([k, v]) => `${k}=${enc(v)}`).join('&');
}

/** Identifies a node, e.g. to reset state when another is picked. */
export const nodeKey = (node: PracticeNode) => [node.subject, node.standard, node.chapter, node.topic ?? '*'].join('|');

/** "Physics → Motion in a Plane → Projectile Motion". */
export const breadcrumb = (node: PracticeNode) => [node.subject, node.chapter, node.topic ?? ALL_CHAPTER_QUESTIONS].join(' → ');

/** Adds a page to the questions loaded so far, dropping any already there. */
export function mergePage<Q extends { _id: string }>(loaded: Q[], page: Q[]): Q[] {
  const seen = new Set(loaded.map((q) => q._id));
  return [...loaded, ...page.filter((q) => !seen.has(q._id))];
}

/**
 * "Question 5 of 40": continuing counts on from the questions answered
 * before; reviewing and retrying count through their own list.
 */
export function positionOf(mode: PracticeMode, pos: number, listTotal: number, before: { answered: number; questions: number }) {
  // Practising again and reviewing count through their own list too.
  if (mode === 'continue') {
    const of = Math.max(before.questions, 1);
    return { current: Math.min(before.answered + pos + 1, of), of };
  }
  return { current: pos + 1, of: Math.max(listTotal, 1) };
}

/** Topics the batch has covered first, each group in syllabus order. */
export function sortTopics<T extends { coveredOn: string | null }>(topics: T[]): T[] {
  return [...topics.filter((t) => t.coveredOn), ...topics.filter((t) => !t.coveredOn)];
}

interface Counts {
  questions: number;
  answered: number;
  wrong: number;
  remaining: number;
}

/**
 * Which actions a topic offers, from its counts, and which one leads.
 * Until every question is attempted, continuing leads. Once complete,
 * retrying the incorrect ones leads; with none incorrect, practising again
 * takes Retry's place. Review is there whenever anything is answered.
 */
export function actionsFor(stats: Counts) {
  const state = stats.questions === 0 ? ('none' as const) : stats.remaining === 0 ? ('done' as const) : stats.answered === 0 ? ('start' as const) : ('continue' as const);
  const done = state === 'done';
  return {
    /** none: nothing to practise; done: every question attempted. */
    continue: state,
    review: stats.answered > 0,
    retry: stats.wrong > 0,
    again: done && stats.wrong === 0,
    primary: state === 'none' ? null : !done ? ('continue' as const) : stats.wrong > 0 ? ('retry' as const) : ('again' as const),
  };
}

type TopicLike = StatsLike & { topic: string; coveredOn: string | null };
type PlaceChapter = StatsLike & { standard: string; chapter: string; topics: TopicLike[] };

/** The counts of a chapter, or one of its topics (null when it isn't listed). */
export function statsAt<C extends PlaceChapter>(chapters: C[], at: { standard: string; chapter: string; topic: string | null }): StatsLike | null {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const c = chapters.find((x) => x.standard === at.standard && same(x.chapter, at.chapter));
  if (!c) return null;
  return at.topic === null ? c : c.topics.find((t) => same(t.topic, at.topic!)) ?? null;
}

export interface NextPlace {
  kind: 'topic' | 'chapter';
  standard: string;
  chapter: string;
  topic: string | null;
  /** "Next topic: Uniform Circular Motion". */
  label: string;
}

const unfinished = (s: StatsLike) => s.questions > 0 && s.remaining > 0;

/**
 * Where to go after finishing a topic: the next topic of the chapter still to
 * finish (in the order the chapter lists them: covered first), else the next
 * chapter still to finish (same class first). null when everything is done.
 */
export function nextPlace<C extends PlaceChapter>(chapters: C[], at: { standard: string; chapter: string; topic: string | null }): NextPlace | null {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const ci = chapters.findIndex((x) => x.standard === at.standard && same(x.chapter, at.chapter));
  if (ci < 0) return null;
  const here = chapters[ci];
  if (at.topic !== null && here.topics.length) {
    const topics = sortTopics(here.topics);
    const ti = topics.findIndex((t) => same(t.topic, at.topic!));
    const around = [...topics.slice(ti + 1), ...topics.slice(0, Math.max(0, ti))];
    const t = around.find(unfinished);
    if (t) return { kind: 'topic', standard: here.standard, chapter: here.chapter, topic: t.topic, label: `Next topic: ${t.topic}` };
  }
  const later = [...chapters.slice(ci + 1), ...chapters.slice(0, ci)];
  const c = later.find((x) => x.standard === here.standard && unfinished(x)) ?? later.find(unfinished);
  return c ? { kind: 'chapter', standard: c.standard, chapter: c.chapter, topic: null, label: `Next chapter: ${c.chapter}` } : null;
}

/** "All 40 questions answered · 85% accuracy (34 correct)". */
export function completionText(stats: { questions: number; correct: number; accuracy: number | null }) {
  const all = stats.questions === 1 ? 'The question is answered' : `All ${stats.questions} questions answered`;
  return `${all} · ${stats.accuracy ?? 0}% accuracy (${stats.correct} correct)`;
}

/** "Covered 3/7 topics", "Covered in class" or "Not covered yet". */
export function coverageLabel(chapter: { topics: unknown[]; coveredTopics: number; totalTopics: number }) {
  if (!chapter.topics.length) return chapter.coveredTopics ? 'Covered in class' : 'Not covered yet';
  return chapter.coveredTopics ? `Covered ${chapter.coveredTopics}/${chapter.totalTopics} topics` : 'Not covered yet';
}

/** "40 questions · 12 done" or "No practice questions yet". */
export function countLabel(stats: { questions: number; answered: number }) {
  if (!stats.questions) return 'No practice questions yet';
  const n = `${stats.questions} question${stats.questions === 1 ? '' : 's'}`;
  return stats.answered ? `${n} · ${stats.answered} done` : `${n} · not started`;
}

// ─── Counting a saved answer straight away ─────────────────────────────────
// The Practice tab's counts update as soon as the server saves an answer, so
// they're right when the student goes back; a reload afterwards confirms them.

export interface StatsLike {
  questions: number;
  answered: number;
  correct: number;
  wrong: number;
  remaining: number;
  accuracy: number | null;
}

/** What one saved answer changes: a first answer adds one; a changed one may move one between right and wrong. */
export function answerDelta(before: { correct: boolean } | null | undefined, now: { correct: boolean }) {
  return { answered: before ? 0 : 1, correct: (now.correct ? 1 : 0) - (before?.correct ? 1 : 0) };
}

/** Stats with answers added (or moved), the derived counts worked out again. */
export function bumpStats<S extends StatsLike>(s: S, answered: number, correct: number): S {
  const a = Math.max(0, s.answered + answered);
  const c = Math.min(a, Math.max(0, s.correct + correct));
  return { ...s, answered: a, correct: c, wrong: a - c, remaining: Math.max(0, s.questions - a), accuracy: a ? Math.round((c / a) * 100) : null };
}

type ChapterLike = StatsLike & { standard: string; chapter: string; topics: (StatsLike & { topic: string })[] };

/**
 * The practice tree after one saved answer to a question in `at`: its topic,
 * its chapter and the subject's summary. A question outside the listed
 * chapters changes nothing (the reload sorts it out).
 */
export function applyAnswer<T extends { summary: StatsLike; chapters: ChapterLike[] }>(
  tree: T,
  at: { standard: string; chapter: string; topic: string },
  delta: { answered: number; correct: number }
): T {
  if (!delta.answered && !delta.correct) return tree;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const index = tree.chapters.findIndex((c) => c.standard === at.standard && same(c.chapter, at.chapter));
  if (index < 0) return tree;
  const chapters = tree.chapters.map((c, i) =>
    i === index ? { ...bumpStats(c, delta.answered, delta.correct), topics: c.topics.map((t) => (same(t.topic, at.topic) ? bumpStats(t, delta.answered, delta.correct) : t)) } : c
  ) as T['chapters'];
  return { ...tree, summary: bumpStats(tree.summary, delta.answered, delta.correct), chapters };
}

/** This session's answers, added up. */
export function sessionTally(results: Record<string, { correct: boolean }>) {
  const all = Object.values(results);
  const correct = all.filter((r) => r.correct).length;
  return { answered: all.length, correct, wrong: all.length - correct };
}
