import { api } from '@/services/api-client';
import type { SchoolStandard, SchoolSubject, Track } from '@/constants/school';
import type { TestSummary, TimetableEntry } from '@/services/school-api';
import type { Batch, Coverage } from '@/services/tuition-api';

// The student's side: home, tests (take and review), roadmap and PYQ practice.

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

export interface PyqQuestion {
  _id: string;
  subject: string;
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
  correctAnswer: string;
  explanation: string;
  diagramUrls: string[];
  optionDiagramUrls: { A: string[]; B: string[]; C: string[]; D: string[] };
  explanationDiagramUrls: string[];
  mine: { selected: string; correct: boolean } | null;
}

const enc = encodeURIComponent;

export const studentApi = {
  overview: () => api<StudentOverview>('/student/overview'),
  roadmap: (subject: SchoolSubject) => api<Roadmap>(`/student/roadmap?subject=${enc(subject)}`),

  tests: () => api<{ tests: StudentTest[] }>('/tests').then((r) => r.tests),
  test: (id: string) => api<{ test: TestSummary; attempt: Attempt | null; questions: TestQuestion[] }>(`/tests/${id}`),
  start: (id: string) => api<{ attempt: Attempt; questions: TestQuestion[] }>(`/tests/${id}/start`, { method: 'POST' }),
  saveAnswers: (id: string, answers: { index: number; selected: string | null }[]) =>
    api<{ saved: number }>(`/tests/${id}/answers`, { method: 'PUT', body: { answers } }),
  submit: (id: string, answers: { index: number; selected: string | null }[]) =>
    api<{ attempt: Attempt; questions: TestQuestion[] }>(`/tests/${id}/submit`, { method: 'POST', body: { answers } }),

  pyqChapters: (subject: SchoolSubject) =>
    api<{ total: number; chapters: { chapter: string; standard: string; questions: number; practised: number; correct: number }[] }>(`/pyq/chapters?subject=${enc(subject)}`),
  pyq: (subject: SchoolSubject, chapter: string | null, skip = 0) =>
    api<{ total: number; nextSkip: number | null; questions: PyqQuestion[] }>(`/pyq?subject=${enc(subject)}${chapter ? `&chapter=${enc(chapter)}` : ''}&skip=${skip}`),
  answerPyq: (questionId: string, selected: string) =>
    api<{ correct: boolean; selected: string; correctAnswer: string; explanation: string; explanationDiagramUrls: string[] }>('/pyq/answer', {
      method: 'POST',
      body: { questionId, selected },
    }),
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
