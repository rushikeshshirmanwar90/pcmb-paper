import { api, ApiError } from '@/services/api-client';
import { toQuestion } from '@/services/apiService';
import { isExamId, sourceMatchesExam } from '@/shared/exam-bank';
import type { Mix, PickSummary, QuestionType } from '@/screens/teacher/make-pdf/model';
import type { Question } from '@/types/pcmb';

// The question bank as the Make PDF flow reads it: one exam's chapters, its
// questions a page at a time, and random picks. Every call names an exam, and
// whatever comes back is checked against it again here, so a question from
// another exam is never shown or selected, even from a server that hasn't
// learned about exams yet. Nothing here changes a question.

/** An exam's chapters and topics for a subject, with how many questions each holds. */
export interface ScopeOptions {
  chapters: string[];
  chapterCounts: Record<string, number>;
  /** Each chapter's topics. */
  chapterTopics: Record<string, string[]>;
  topicCounts: Record<string, number>;
}

const asNames = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string' && name.trim() !== '') : [];

const asCounts = (value: unknown): Record<string, number> =>
  value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, n]) => typeof n === 'number')) as Record<string, number>
    : {};

/** The chapters of an exam's subject that have questions (not the whole syllabus), each with its questions and topics. */
export async function fetchScopeOptions(exam: string, subject: string): Promise<ScopeOptions> {
  if (!isExamId(exam)) throw new ApiError(0, 'Choose an exam first.');
  const query = new URLSearchParams({ exam, subject });
  const data = await api<Record<string, unknown>>(`/filters?${query}`, { auth: false });
  const rawTopics = data.chapterTopics && typeof data.chapterTopics === 'object' ? (data.chapterTopics as Record<string, unknown>) : {};
  return {
    chapters: asNames(data.chapters),
    chapterCounts: asCounts(data.chapterCounts),
    chapterTopics: Object.fromEntries(Object.entries(rawTopics).map(([chapter, topics]) => [chapter, asNames(topics)])),
    topicCounts: asCounts(data.topicCounts),
  };
}

export interface BrowseRequest {
  exam: string;
  subject: string;
  chapters: string[];
  topics: string[];
  levels: string[];
  type: QuestionType;
  search: string;
  page: number;
  limit: number;
}

export interface QuestionsPage {
  questions: Question[];
  /** All the server holds for the request. */
  total: number;
  page: number;
  hasMore: boolean;
}

/** One page of the exam's questions for the scope, with the teacher's search and filters. */
export async function browseQuestions(request: BrowseRequest): Promise<QuestionsPage> {
  if (!isExamId(request.exam)) throw new ApiError(0, 'Choose an exam first.');
  const query = new URLSearchParams({
    exam: request.exam,
    subject: request.subject,
    limit: String(request.limit),
    page: String(request.page),
  });
  for (const chapter of request.chapters) query.append('chapter', chapter);
  for (const topic of request.topics) query.append('topic', topic);
  for (const level of request.levels) query.append('level', level);
  if (request.type !== 'any') query.set('answerType', request.type);
  if (request.search.trim()) query.set('search', request.search.trim());

  const data = await api<{ questions?: unknown[]; total?: number }>(`/questions?${query}`, { auth: false });
  const raw = Array.isArray(data.questions) ? data.questions : [];
  const total = typeof data.total === 'number' ? data.total : raw.length;
  const exam = request.exam;
  return {
    questions: raw.map(toQuestion).filter((question) => sourceMatchesExam(question.source, exam)),
    total,
    page: request.page,
    hasMore: raw.length >= request.limit && request.page * request.limit < total,
  };
}

export interface PickedQuestions extends PickSummary {
  questions: Question[];
}

/** Has the server draw random questions for the request (see model.ts autoBody); returns what it found and how it compares to what was asked. */
export async function pickQuestions(exam: string, body: Record<string, unknown>): Promise<PickedQuestions> {
  if (!isExamId(exam)) throw new ApiError(0, 'Choose an exam first.');
  let data: Record<string, unknown>;
  try {
    data = await api<Record<string, unknown>>('/questions/pick', { method: 'POST', body });
  } catch (error) {
    // A server from before automatic selection has no such route.
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      throw new ApiError(error.status, "Automatic selection isn't available on the server yet. Pick the questions by hand instead.");
    }
    throw error;
  }
  const raw = Array.isArray(data.questions) ? data.questions : [];
  const questions = raw.map(toQuestion).filter((question) => sourceMatchesExam(question.source, exam));
  const mix = (value: unknown, fallback: Mix | null): Mix | null =>
    value && typeof value === 'object'
      ? { Easy: Number((value as Mix).Easy) || 0, Mid: Number((value as Mix).Mid) || 0, Hard: Number((value as Mix).Hard) || 0 }
      : fallback;
  const available = (data.available && typeof data.available === 'object' ? data.available : {}) as Partial<Mix & { total: number }>;
  const requested = Number(data.requested) || 0;
  return {
    questions,
    requested,
    found: questions.length,
    complete: questions.length >= requested,
    available: { Easy: available.Easy ?? 0, Mid: available.Mid ?? 0, Hard: available.Hard ?? 0, total: available.total ?? 0 },
    avoided: Number(data.avoided) || 0,
    requestedByLevel: mix(data.requestedByLevel, null),
    foundByLevel: mix(data.foundByLevel, { Easy: 0, Mid: 0, Hard: 0 }) as Mix,
  };
}

// ─── The one-page Make PDF form: Foundation and Competitive MCQs ───────────
// Read-only calls to /make-pdf/*; each names the whole scope and the server
// decides what matches. Nothing here changes a question.

export interface BankOptions {
  chapters: { name: string; count: number }[];
  topics: { chapter: string; name: string; count: number }[];
  years: { name: string; count: number }[];
  total: number;
}

const asRows = <T extends { name: string; count: number }>(value: unknown): T[] =>
  Array.isArray(value) ? (value.filter((row) => row && typeof row.name === 'string' && typeof row.count === 'number') as T[]) : [];

export async function fetchBankOptions(body: Record<string, unknown>): Promise<BankOptions> {
  const data = await api<Record<string, unknown>>('/make-pdf/options', { method: 'POST', body });
  return { chapters: asRows(data.chapters), topics: asRows(data.topics), years: asRows(data.years), total: Number(data.total) || 0 };
}

export interface BankPage {
  questions: Question[];
  total: number;
  hasMore: boolean;
}

export async function fetchBankPage(body: Record<string, unknown>, page: number, limit: number): Promise<BankPage> {
  const data = await api<{ questions?: unknown[]; total?: number; hasMore?: boolean }>('/make-pdf/questions', { method: 'POST', body: { ...body, page, limit } });
  const raw = Array.isArray(data.questions) ? data.questions : [];
  return { questions: raw.map(toQuestion), total: typeof data.total === 'number' ? data.total : raw.length, hasMore: !!data.hasMore };
}

/** `count` random questions from the scope, leaving out the ids given. */
export async function fetchBankRandom(body: Record<string, unknown>, count: number, exclude: string[]): Promise<Question[]> {
  const data = await api<{ questions?: unknown[] }>('/make-pdf/pick', { method: 'POST', body: { ...body, count, exclude } });
  return (Array.isArray(data.questions) ? data.questions : []).map(toQuestion);
}

/** The picked questions the server confirms are inside the scope, in order, and how many it dropped. */
export async function verifyBankQuestions(body: Record<string, unknown>, ids: string[]): Promise<{ questions: Question[]; dropped: number }> {
  const data = await api<{ questions?: unknown[]; dropped?: number }>('/make-pdf/pick', { method: 'POST', body: { ...body, ids } });
  return { questions: (Array.isArray(data.questions) ? data.questions : []).map(toQuestion), dropped: Number(data.dropped) || 0 };
}
