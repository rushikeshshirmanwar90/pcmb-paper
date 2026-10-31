// Self-assessment: the pure parts (picking chapters and topics, time limits,
// labels), kept free of React and the API client so they can be tested on
// their own (tests/self-assessment.test.mjs).

import type { SchoolStandard, SchoolSubject } from '@/constants/school';
import type {
  AssessmentBasis,
  AssessmentMix,
  AssessmentScope,
  AssessmentSummary,
  DifficultySplit,
  StrengthLevel,
} from '@/services/student-api';

export const COUNT_CHOICES = [10, 20, 30, 45] as const;
export const DEFAULT_COUNT = 20;
/** The fewest questions a self-assessment can have (the server checks the same). */
export const MIN_QUESTIONS = 5;

export const MIX_INFO: Record<AssessmentMix, { label: string; text: string }> = {
  smart: {
    label: 'Smart',
    text: 'Follows how you have done in these topics: more easy questions if you are struggling, more hard ones if you are doing well. Weak topics get more questions.',
  },
  balanced: { label: 'Balanced', text: 'Like a real exam: about 30% easy, 50% medium and 20% hard.' },
  challenge: { label: 'Challenge', text: 'Mostly medium and hard questions, to push yourself.' },
};

// ─── Picking chapters and topics ───────────────────────────────────────────

interface ChapterLike {
  standard: SchoolStandard;
  chapter: string;
  questions: number;
  topics: { topic: string; questions: number }[];
}

/** Each picked chapter: 'all' (the whole chapter) or the topics picked. */
export type Selection = Record<string, 'all' | string[]>;

export const chapterKey = (c: { standard: string; chapter: string }) => `${c.standard}|${c.chapter}`;

/** 'all', 'some' or 'none' of a chapter picked. */
export function chapterState(selection: Selection, chapter: ChapterLike): 'all' | 'some' | 'none' {
  const picked = selection[chapterKey(chapter)];
  if (!picked) return 'none';
  return picked === 'all' ? 'all' : picked.length ? 'some' : 'none';
}

/** Picks the whole chapter, or (when it's picked at all) none of it. */
export function toggleChapter(selection: Selection, chapter: ChapterLike): Selection {
  const key = chapterKey(chapter);
  const next = { ...selection };
  if (next[key]) delete next[key];
  else next[key] = 'all';
  return next;
}

/** Picks or drops one topic. Every topic picked becomes the whole chapter. */
export function toggleTopic(selection: Selection, chapter: ChapterLike, topic: string): Selection {
  const key = chapterKey(chapter);
  const all = chapter.topics.map((t) => t.topic);
  const now = selection[key];
  const current = now === 'all' ? all : now ?? [];
  const picked = current.includes(topic) ? current.filter((t) => t !== topic) : [...current, topic];
  const next = { ...selection };
  if (!picked.length) delete next[key];
  else next[key] = picked.length === all.length ? 'all' : all.filter((t) => picked.includes(t));
  return next;
}

export const isTopicPicked = (selection: Selection, chapter: ChapterLike, topic: string) => {
  const picked = selection[chapterKey(chapter)];
  return picked === 'all' || (!!picked && picked.includes(topic));
};

/** The scope to send, in the order the chapters are listed. */
export function scopeOf(selection: Selection, chapters: ChapterLike[]): AssessmentScope[] {
  return chapters
    .filter((c) => selection[chapterKey(c)])
    .map((c) => {
      const picked = selection[chapterKey(c)];
      return { standard: c.standard, chapter: c.chapter, topics: picked === 'all' ? [] : [...picked] };
    });
}

/** Past-year questions in what's picked (as the Practice tab counts them). */
export function pickedQuestions(selection: Selection, chapters: ChapterLike[]): number {
  return chapters.reduce((n, c) => {
    const picked = selection[chapterKey(c)];
    if (!picked) return n;
    if (picked === 'all') return n + c.questions;
    return n + c.topics.filter((t) => picked.includes(t.topic)).reduce((m, t) => m + t.questions, 0);
  }, 0);
}

/** "2 chapters · 5 topics", "Kinematics", "Kinematics · 2 topics". */
export function selectionLabel(selection: Selection, chapters: ChapterLike[]): string {
  const scope = scopeOf(selection, chapters);
  if (!scope.length) return 'Nothing picked yet';
  if (scope.length === 1) {
    const [s] = scope;
    return s.topics.length ? `${s.chapter} · ${s.topics.length} topic${s.topics.length === 1 ? '' : 's'}` : s.chapter;
  }
  const parts = scope.filter((s) => s.topics.length).reduce((n, s) => n + s.topics.length, 0);
  const whole = scope.filter((s) => !s.topics.length).length;
  const detail = whole && parts ? `${whole} whole, ${parts} topic${parts === 1 ? '' : 's'}` : !whole ? `${parts} topic${parts === 1 ? '' : 's'}` : null;
  return [`${scope.length} chapters`, detail].filter(Boolean).join(' · ');
}

// ─── Time ──────────────────────────────────────────────────────────────────

/** About as long as the real exam gives: 1 minute a question for Biology, 2 for the others; rounded up to 5 minutes. */
export function suggestedMinutes(count: number, subject: SchoolSubject): number {
  const perQuestion = subject === 'Biology' ? 1 : 2;
  return Math.max(5, Math.ceil((count * perQuestion) / 5) * 5);
}

/** The time limits to offer: the suggested one, a relaxed one and none ("0" = no limit). */
export function timeChoices(count: number, subject: SchoolSubject): string[] {
  const s = suggestedMinutes(count, subject);
  const relaxed = Math.ceil((s * 1.5) / 5) * 5;
  return [String(s), String(relaxed), '0'];
}

export const timeLabel = (value: string, suggested: number) =>
  value === '0' ? 'No limit' : Number(value) === suggested ? `${value} min · exam pace` : `${value} min`;

export const durationLabel = (minutes: number | null) => (minutes ? `${minutes} min` : 'No time limit');

// ─── Labels ────────────────────────────────────────────────────────────────

/** "6 easy · 10 medium · 4 hard". */
export function splitLabel(split: DifficultySplit) {
  return [`${split.Easy} easy`, `${split.Medium} medium`, `${split.Hard} hard`].join(' · ');
}

/** Why the Smart mix chose its split, in a sentence. */
export function basisText(mix: AssessmentMix, basis: AssessmentBasis): string {
  if (mix !== 'smart') return MIX_INFO[mix].text;
  switch (basis.kind) {
    case 'struggling':
      return `You've got ${basis.accuracy}% right in these topics so far, so this starts with more easy questions to build up.`;
    case 'steady':
      return `You've got ${basis.accuracy}% right in these topics so far, so this is an exam-like mix, with extra questions on your weak topics.`;
    case 'confident':
      return `You've got ${basis.accuracy}% right in these topics so far, so this has more hard questions to stretch you.`;
    default:
      return 'Not enough practice in these topics yet to adjust, so this is an exam-like mix. It adapts as you practise.';
  }
}

export const LEVEL_INFO: Record<StrengthLevel, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  strong: { label: 'Strong', tone: 'success' },
  average: { label: 'Getting there', tone: 'warning' },
  weak: { label: 'Weak', tone: 'danger' },
};

/** A topic's name, or its chapter's when it has no named topics. */
export const topicName = (t: { chapter: string; topic: string }) => t.topic || t.chapter;

/** "Q2, Q5 and Q7". */
export function questionList(numbers: number[]): string {
  const qs = numbers.map((n) => `Q${n}`);
  return qs.length < 2 ? qs.join('') : `${qs.slice(0, -1).join(', ')} and ${qs[qs.length - 1]}`;
}

/** The line under an assessment in the list. */
export function summaryLine(a: Pick<AssessmentSummary, 'state' | 'questionCount' | 'answeredCount' | 'result' | 'durationMinutes' | 'subject'>): string {
  if (a.state === 'submitted' && a.result) {
    const weak = a.result.weakTopics ? ` · ${a.result.weakTopics} weak topic${a.result.weakTopics === 1 ? '' : 's'}` : '';
    return `${a.subject} · ${a.result.correct}/${a.questionCount} right${weak}`;
  }
  if (a.state === 'in-progress') return `${a.subject} · In progress · ${a.answeredCount} of ${a.questionCount} answered`;
  return `${a.subject} · Not started · ${a.questionCount} questions · ${durationLabel(a.durationMinutes)}`;
}

/** Seconds left, from the deadline (null: no limit). */
export const secondsLeft = (deadline: string | null, now = Date.now()) =>
  deadline === null ? null : Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000));
