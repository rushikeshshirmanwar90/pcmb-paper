// The rules of the Make PDF flow, apart from the screens: what a choice does to
// the choices after it, which questions may stay selected, and how the
// selection is added to, replaced, reordered and checked. Plain functions on
// plain data, so each rule is tested without a screen.

import type { Question } from '../../../types/pcmb';

/** Exam PDF: the printable paper. Smart PDF: the classroom slides. Chosen first, and both then share the same steps. */
export type PdfKind = 'exam' | 'smart';
export type Method = 'auto' | 'manual';
export type Level = 'Easy' | 'Mid' | 'Hard';
export const LEVELS: Level[] = ['Easy', 'Mid', 'Hard'];
export type QuestionType = 'any' | 'MCQ' | 'Numerical';

/** The most questions one PDF holds (the server's limit). */
export const MAX_QUESTIONS = 300;

/** Marks for each question in an Exam PDF's total, as papers have always had them. */
export const MARKS_PER_QUESTION = 4;

/** Foundation papers (9th and 10th) give 1 mark a question; every other class keeps 4. `standard` may list classes ("9th, 10th"). */
export function marksPerQuestionFor(standard: string): number {
  const classes = standard.split(',').map((name) => name.trim()).filter(Boolean);
  return classes.length > 0 && classes.every((name) => name === '9th' || name === '10th') ? 1 : MARKS_PER_QUESTION;
}

// ─── What is being made from: exam → subject → chapters → topics ───────────

export interface Scope {
  exam: string;
  subject: string;
  /** None picked means every chapter of the subject. */
  chapters: string[];
  /** None picked means every topic of the picked chapters. */
  topics: string[];
}

export const EMPTY_SCOPE: Scope = { exam: '', subject: '', chapters: [], topics: [] };

/**
 * Another exam. The subject stays only if the new exam has it. The chapters and
 * topics go: they were the other exam's, and may not exist (or hold questions)
 * in this one.
 */
export function withExam(scope: Scope, exam: string, subjectsOfExam: readonly string[]): Scope {
  if (exam === scope.exam) return scope;
  return { exam, subject: subjectsOfExam.includes(scope.subject) ? scope.subject : '', chapters: [], topics: [] };
}

/** Another subject: its chapters and topics are not the old one's. */
export function withSubject(scope: Scope, subject: string): Scope {
  return subject === scope.subject ? scope : { ...scope, subject, chapters: [], topics: [] };
}

/** Other chapters, in the order given; topics of chapters no longer picked go. */
export function withChapters(scope: Scope, chapters: string[], topicsByChapter: Record<string, string[]>): Scope {
  const allowed = new Set(chapters.flatMap((chapter) => topicsByChapter[chapter] ?? []));
  return { ...scope, chapters, topics: scope.topics.filter((topic) => allowed.has(topic)) };
}

export const scopeReady = (scope: Scope) => scope.exam !== '' && scope.subject !== '';

/** "JEE · Physics · 2 chapters" for headings. */
export function scopeSummary(scope: Scope, examLabel: string): string {
  const chapters =
    scope.chapters.length === 0 ? 'All chapters' : scope.chapters.length === 1 ? scope.chapters[0] : `${scope.chapters.length} chapters`;
  return [examLabel, scope.subject, chapters].filter(Boolean).join(' · ');
}

/** Names as the question bank may spell a subject. */
const SUBJECT_NAMES: Record<string, string[]> = { Biology: ['Biology', 'Botany', 'Zoology'] };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether a question belongs to the scope: its exam (by the rule given), subject, chapter and topic. */
export function matchesScope(question: Question, scope: Scope, inExam: (question: Question) => boolean): boolean {
  if (!scopeReady(scope) || !inExam(question)) return false;
  const subjects = SUBJECT_NAMES[scope.subject] ?? [scope.subject];
  if (!subjects.some((name) => same(name, question.subject))) return false;
  if (scope.chapters.length && !scope.chapters.some((chapter) => same(chapter, question.chapter))) return false;
  if (scope.topics.length && !scope.topics.some((topic) => same(topic, question.topic))) return false;
  return true;
}

/** The questions that still belong after the scope changed, and how many didn't. */
export function keepMatching(
  questions: Question[],
  scope: Scope,
  inExam: (question: Question) => boolean
): { kept: Question[]; dropped: number } {
  const kept = questions.filter((question) => matchesScope(question, scope, inExam));
  return { kept, dropped: questions.length - kept.length };
}

// ─── The selection: an ordered list of questions, each once, by its id ─────

/** The list with these added at the end: ones already there, and any past the limit, are skipped. */
export function addQuestions(
  list: Question[],
  more: Question[],
  limit = MAX_QUESTIONS
): { list: Question[]; added: number; duplicates: number; overLimit: number } {
  const have = new Set(list.map((question) => question._id));
  const next = [...list];
  let duplicates = 0;
  let overLimit = 0;
  for (const question of more) {
    if (have.has(question._id)) duplicates++;
    else if (next.length >= limit) overLimit++;
    else {
      have.add(question._id);
      next.push(question);
    }
  }
  return { list: next, added: next.length - list.length, duplicates, overLimit };
}

export const removeQuestion = (list: Question[], id: string) => list.filter((question) => question._id !== id);

/**
 * Swaps a question for another, which takes its place in the order. Null when
 * the other is already in the list (it would be there twice) or the question
 * to replace isn't.
 */
export function replaceQuestion(list: Question[], oldId: string, next: Question): Question[] | null {
  const at = list.findIndex((question) => question._id === oldId);
  if (at < 0) return null;
  if (next._id !== oldId && list.some((question) => question._id === next._id)) return null;
  return list.map((question, i) => (i === at ? next : question));
}

/** Moves the question at `from` to `to` (both within the list); anything else leaves the list as it is. */
export function moveQuestion(list: Question[], from: number, to: number): Question[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const hasQuestion = (list: Question[], id: string) => list.some((question) => question._id === id);

/** The exact edit a teacher made to a question for this PDF: it keeps its id and its place. */
export const editQuestion = (list: Question[], edited: Question) => list.map((question) => (question._id === edited._id ? edited : question));

/** "12 questions", "1 question". */
export const questionCount = (n: number) => `${n} question${n === 1 ? '' : 's'}`;

// ─── Automatic generation ──────────────────────────────────────────────────

export type Mix = Record<Level, number>;

export interface AutoConfig {
  count: number;
  /** Ask for a number of each level instead of one total. */
  byLevel: boolean;
  mix: Mix;
  type: QuestionType;
  /** Leave out questions already in a PDF made on this phone. */
  avoidUsed: boolean;
}

export const DEFAULT_AUTO: AutoConfig = {
  count: 20,
  byLevel: false,
  mix: { Easy: 8, Mid: 8, Hard: 4 },
  type: 'any',
  avoidUsed: false,
};

export const mixTotal = (mix: Mix) => LEVELS.reduce((sum, level) => sum + mix[level], 0);

/** How many questions the settings ask for. */
export const autoTotal = (config: AutoConfig) => (config.byLevel ? mixTotal(config.mix) : config.count);

/** What is wrong with the settings, or null. */
export function autoProblem(config: AutoConfig): string | null {
  const total = autoTotal(config);
  if (!Number.isInteger(total) || total < 1) return 'Ask for at least one question.';
  if (total > MAX_QUESTIONS) return `A PDF holds up to ${MAX_QUESTIONS} questions.`;
  if (config.byLevel && LEVELS.some((level) => !Number.isInteger(config.mix[level]) || config.mix[level] < 0)) {
    return 'Each level needs a whole number of questions.';
  }
  return null;
}

/** Splits a total across the levels as 40% easy, 40% medium, 20% hard, summing to the total. */
export function mixFromCount(count: number): Mix {
  const easy = Math.round(count * 0.4);
  const hard = Math.round(count * 0.2);
  return { Easy: easy, Mid: Math.max(0, count - easy - hard), Hard: hard };
}

/** The body for POST /questions/pick. */
export function autoBody(scope: Scope, config: AutoConfig, exclude: string[]): Record<string, unknown> {
  return {
    exam: scope.exam,
    subject: scope.subject,
    chapters: scope.chapters,
    topics: scope.topics,
    answerType: config.type,
    ...(config.byLevel ? { mix: config.mix } : { count: config.count }),
    exclude,
  };
}

export interface PickSummary {
  requested: number;
  found: number;
  complete: boolean;
  available: Mix & { total: number };
  avoided: number;
  requestedByLevel: Mix | null;
  foundByLevel: Mix;
}

/** Words for the teacher when fewer questions were found than asked for; null when all were. */
export function shortfallMessage(summary: PickSummary): string | null {
  if (summary.complete) return null;
  if (summary.found === 0) {
    return summary.avoided > 0
      ? `No questions are left for these choices: ${summary.avoided} ${summary.avoided === 1 ? 'was' : 'were'} left out because ${summary.avoided === 1 ? 'it is' : 'they are'} in PDFs you already made.`
      : 'The question bank has no questions for these choices. Try other chapters, another question type or level.';
  }
  const levels = summary.requestedByLevel
    ? LEVELS.filter((level) => summary.foundByLevel[level] < (summary.requestedByLevel as Mix)[level])
        .map((level) => `${level}: ${summary.foundByLevel[level]} of ${(summary.requestedByLevel as Mix)[level]}`)
        .join(', ')
    : '';
  return (
    `Only ${summary.found} of the ${summary.requested} questions you asked for ${summary.found === 1 ? 'is' : 'are'} available for these choices` +
    (levels ? ` (${levels})` : '') +
    (summary.avoided > 0 ? `, with ${summary.avoided} left out because ${summary.avoided === 1 ? 'it is' : 'they are'} in earlier PDFs` : '') +
    '. Add more chapters, ask for fewer, or use these as they are.'
  );
}

// ─── Showing lists ─────────────────────────────────────────────────────────

/** `names` in the order `reference` lists them; names it doesn't list follow, in their own order. */
export function orderLike(names: readonly string[], reference: readonly string[]): string[] {
  const rank = new Map(reference.map((name, i) => [name.trim().toLowerCase(), i]));
  const at = (name: string) => rank.get(name.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
  return names.map((name, i) => ({ name, i })).sort((a, b) => at(a.name) - at(b.name) || a.i - b.i).map((entry) => entry.name);
}

/** Whether leaving now would lose work: a kind, a scope or questions have been chosen. */
export const hasWork = (kind: PdfKind | null, scope: Scope, selected: Question[]) =>
  kind !== null && (scope.exam !== '' || selected.length > 0);

// ─── Names for the paper ───────────────────────────────────────────────────

/** A paper's name from the chapters or topics picked: "EMI", or "EMI, Optics +2 more" once it would be too long for a heading. */
export function titleFromNames(names: string[]): string {
  let title = '';
  for (let i = 0; i < names.length; i++) {
    const next = title ? `${title}, ${names[i]}` : names[i];
    if (title && next.length > 60) return `${title} +${names.length - i} more`;
    title = next;
  }
  return title.slice(0, 80);
}

/** "11th", or "11th, 12th" when the questions come from more than one class, in class order. */
export function standardsOf(questions: Question[]): string {
  const order = ['9th', '10th', '11th', '12th'];
  return [...new Set(questions.map((question) => question.standard).filter(Boolean))].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', ');
}

/** The distinct chapters of some questions, in the order they first appear. */
export const chaptersOf = (questions: Question[]) => [...new Set(questions.map((question) => question.chapter).filter(Boolean))];
