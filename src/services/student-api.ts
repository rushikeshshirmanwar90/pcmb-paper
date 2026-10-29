import { api } from '@/services/api-client';
import type { SchoolStandard, SchoolSubject, Track } from '@/constants/school';
import type { TestSummary, TimetableEntry } from '@/services/school-api';
import type { Batch, Coverage } from '@/services/tuition-api';
import { practiceQuery, type PracticeNode, type PracticeStatus } from '@/screens/student/topic-practice';

// The student's side: home, tests (take and review), roadmap and topic practice (PYQs).

export type Level = 'strong' | 'average' | 'weak' | 'not-enough';

export interface TopicStat {
  subject: string;
  chapter: string;
  topic: string;
  answered: number;
  correct: number;
  accuracy: number;
  level: Level;
}

export interface StudentOverview {
  subjects: SchoolSubject[];
  batch: (Batch & { coverage: Coverage }) | null;
  today: TimetableEntry[];
  week: TimetableEntry[];
  recent: { id: string; subject: string; chapter: string; topic: string; coveredOn: string }[];
  openTests: TestSummary[];
  insight: {
    weak: TopicStat[];
    strong: TopicStat[];
    lastResult: { title: string; score: number; maxScore: number; submittedAt: string } | null;
  };
}

export type StudentTest = TestSummary & { mine: { state: 'in-progress' | 'submitted'; score: number | null } | null };

export interface TestQuestion {
  index: number;
  subject: string;
  chapter: string;
  topic: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answerType: 'MCQ' | 'Numerical' | string;
  diagramUrls: string[];
  optionDiagramUrls: { A: string[]; B: string[]; C: string[]; D: string[] };
  /** Only once the test is submitted (or closed). */
  correctAnswer?: string;
  explanation?: string;
  explanationDiagramUrls?: string[];
}

export interface Attempt {
  state: 'in-progress' | 'submitted';
  startedAt: string;
  deadline: string;
  answers: { index: number; selected: string | null; correct: boolean | null }[];
  result: { score: number; maxScore: number; correct: number; wrong: number; skipped: number; timeTakenSeconds: number; submittedAt: string } | null;
}

export interface RoadmapChapter {
  standard: SchoolStandard;
  chapter: string;
  marks: number | null;
  topics: { topic: string; coveredOn: string | null; answered: number; accuracy: number | null; level: Level }[];
  coveredTopics: number;
  answered: number;
  accuracy: number | null;
  level: Level;
  strong: string[];
  weak: string[];
}

export interface Roadmap {
  subject: SchoolSubject;
  track: Track;
  standard: SchoolStandard | null;
  hasBatch: boolean;
  summary: { totalMarks: number; coveredPercent: number; coveredTopics: number; totalTopics: number; strongTopics: number; weakTopics: number };
  chapters: RoadmapChapter[];
}

/** Counts for a chapter or topic in topic practice, from the student's saved answers. */
export interface PracticeStats {
  questions: number;
  answered: number;
  correct: number;
  wrong: number;
  remaining: number;
  accuracy: number | null;
}

export interface PracticeTopic extends PracticeStats {
  topic: string;
  coveredOn: string | null;
}

export interface PracticeChapter extends PracticeStats {
  standard: SchoolStandard;
  chapter: string;
  /** The student's own class. */
  mine: boolean;
  /** For a chapter without named topics: when the batch covered it. */
  coveredOn: string | null;
  coveredTopics: number;
  totalTopics: number;
  /** Questions in the chapter tagged to none of its topics. */
  untagged: number;
  /** Empty when the chapter has no named topics: it's practised as a whole. */
  topics: PracticeTopic[];
}

export interface PracticeTree {
  subject: SchoolSubject;
  track: Track;
  standard: SchoolStandard | null;
  hasBatch: boolean;
  summary: PracticeStats & { coveredTopics: number; totalTopics: number };
  chapters: PracticeChapter[];
}

/** A topic practice question. The answer and solution come only when reviewing answered ones. */
export interface PracticeQuestion {
  _id: string;
  standard: string;
  chapter: string;
  topic: string;
  source: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answerType: string;
  diagramUrls: string[];
  optionDiagramUrls: { A: string[]; B: string[]; C: string[]; D: string[] };
  mine: { selected: string; correct: boolean } | null;
  correctAnswer?: string;
  explanation?: string;
  explanationDiagramUrls?: string[];
}

export interface PracticePage {
  total: number;
  summary: PracticeStats;
  questions: PracticeQuestion[];
  /** Pass as `after` for the next page; null on the last one. */
  next: string | null;
}

export type PyqAnswerResult = {
  correct: boolean;
  selected: string;
  /** Whether the server kept the answer (always, for a student). */
  saved?: boolean;
  correctAnswer: string;
  explanation: string;
  explanationDiagramUrls: string[];
};

const enc = encodeURIComponent;

export const studentApi = {
  overview: () => api<StudentOverview>('/student/overview'),
  roadmap: (subject: SchoolSubject) => api<Roadmap>(`/student/roadmap?subject=${enc(subject)}`),

  /** The batch's tests, upcoming (scheduled) ones included as summaries; they can't be opened until they open. */
  tests: () => api<{ tests: StudentTest[] }>('/tests?upcoming=1').then((r) => r.tests),
  test: (id: string) => api<{ test: TestSummary; attempt: Attempt | null; questions: TestQuestion[] }>(`/tests/${id}`),
  start: (id: string) => api<{ attempt: Attempt; questions: TestQuestion[] }>(`/tests/${id}/start`, { method: 'POST' }),
  saveAnswers: (id: string, answers: { index: number; selected: string | null }[]) =>
    api<{ saved: number }>(`/tests/${id}/answers`, { method: 'PUT', body: { answers } }),
  submit: (id: string, answers: { index: number; selected: string | null }[]) =>
    api<{ attempt: Attempt; questions: TestQuestion[] }>(`/tests/${id}/submit`, { method: 'POST', body: { answers } }),

  answerPyq: (questionId: string, selected: string) =>
    api<PyqAnswerResult>('/pyq/answer', {
      method: 'POST',
      body: { questionId, selected },
    }),

  /** Topic practice: the subject's syllabus with question counts, coverage and the student's progress. */
  practiceTree: (subject: SchoolSubject) => api<PracticeTree>(`/pyq/topics?subject=${enc(subject)}`),
  /** A page of a chapter's or topic's questions; see practiceQuery. */
  practiceQuestions: (node: PracticeNode, status: PracticeStatus, after: string | null) =>
    api<PracticePage>(`/pyq/questions?${practiceQuery(node, status, after)}`),
};

export const LEVEL_LABEL: Record<Level, string> = {
  strong: 'Strong',
  average: 'Getting there',
  weak: 'Weak',
  'not-enough': 'Not enough answers yet',
};

export const LEVEL_TONE: Record<Level, 'success' | 'warning' | 'danger' | 'neutral'> = {
  strong: 'success',
  average: 'warning',
  weak: 'danger',
  'not-enough': 'neutral',
};
