import { api } from '@/services/api-client';
import type { Program, SchoolStandard, SchoolSubject } from '@/constants/school';
import type { Batch, Coverage, Student } from '@/services/tuition-api';
import type { TopicStat } from '@/services/student-api';
import type { Question } from '@/types/pcmb';

// Teaching data shared by teachers and students: a batch's details, syllabus
// progress, the weekly timetable and tests.

export interface BatchView {
  batch: Batch & { coverage: Coverage };
  mySubjects: SchoolSubject[];
  students: Student[];
}

export interface ProgressEntry {
  id: string;
  subject: SchoolSubject;
  standard: SchoolStandard;
  chapter: string;
  topic: string;
  coveredOn: string;
  note: string;
  teacher: string;
}

export interface SyllabusProgress {
  recent: ProgressEntry[];
  syllabus: {
    subject: SchoolSubject;
    chapters: { standard: SchoolStandard; chapter: string; topics: { topic: string; covered: { on: string; by: string } | null }[] }[];
  } | null;
}

/** A class of a batch's subject timetable. */
export interface TimetableEntry {
  id: string;
  batch: { id: string; name: string; venue: string };
  /** Empty id and name when the class has no teacher yet. */
  teacher: { id: string; name: string };
  subject: SchoolSubject;
  day: number;
  start: string;
  end: string;
  note: string;
  mine: boolean;
}

export type TestStatus = 'scheduled' | 'open' | 'closed';

export interface TestSummary {
  id: string;
  title: string;
  batch: { id: string; name: string };
  teacher: { id: string; name: string };
  subject: string;
  standard: string;
  questionCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
  maxScore: number;
  durationMinutes: number;
  /** UTC instants (ISO); shown in the phone's time zone. */
  opensAt: string;
  closesAt: string;
  /** The latest a student can start and still get the whole time limit. */
  lastStartAt: string | null;
  status: TestStatus;
  createdAt: string;
  /** Students who have opened it: once any have, it can't be edited. */
  started: number;
  submitted: number;
  batchStudents: number;
  averageScore: number | null;
}

export interface TestResultRow {
  student: { id: string; name: string };
  state: 'not-started' | 'in-progress' | 'submitted';
  score: number | null;
  correct: number;
  wrong: number;
  skipped: number;
  submittedAt: string | null;
  timeTakenSeconds: number;
}

export type TestMonitorState = 'not-started' | 'in-progress' | 'submitted' | 'auto-submitted' | 'violation';

/** One student's place in a test, as the server recorded it. No marks and no answer content. */
export interface TestMonitorRow {
  student: { id: string; name: string };
  state: TestMonitorState;
  answered: number;
  total: number;
  startedAt: string | null;
  submittedAt: string | null;
  /** Seconds left on the server's deadline; only while in progress. */
  remainingSeconds: number | null;
}

export interface TestMonitor {
  status: TestStatus;
  serverTime: string;
  /** total = notStarted + inProgress + submitted; submitted includes the auto-submitted and violation attempts counted again below. */
  counts: { total: number; notStarted: number; inProgress: number; submitted: number; autoSubmitted: number; violations: number };
  students: TestMonitorRow[];
}

/** A question as the test holds it: a copy, with `sourceId` pointing at the bank's original. */
export type TestQuestionCopy = Omit<Question, '_id' | 'questionNumber'> & { sourceId: string | null };

export interface TestDetail {
  test: TestSummary;
  canEdit: boolean;
  questions: TestQuestionCopy[];
  results: TestResultRow[];
}

export interface TeacherOverview {
  totals: { batches: number; students: number; weeklyMinutes: number; classesThisWeek: number };
  batches: (Batch & { mySubjects: SchoolSubject[]; coverage: Coverage })[];
  today: TimetableEntry[];
  week: TimetableEntry[];
}

/** A test to set or change. `startNow` opens it at the server's clock; otherwise `opensAt` (in the future) is needed. */
export type NewTest = {
  batchId: string;
  title: string;
  subject: string;
  standard?: string;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarks: number;
  startNow?: boolean;
  opensAt?: string;
  closesAt: string;
  questions: Question[];
};

const enc = encodeURIComponent;

export const schoolApi = {
  teacherOverview: () => api<TeacherOverview>('/teacher/overview'),
  batch: (id: string) => api<BatchView>(`/batches/${id}`),

  progress: (batchId: string, subject?: SchoolSubject) =>
    api<SyllabusProgress>(`/batches/${batchId}/progress${subject ? `?subject=${enc(subject)}` : ''}`),
  markCovered: (batchId: string, input: { subject: SchoolSubject; standard: SchoolStandard; chapter: string; topics: string[]; coveredOn?: string }) =>
    api(`/batches/${batchId}/progress`, { method: 'POST', body: input }),
  unmarkCovered: (batchId: string, input: { subject: SchoolSubject; standard: SchoolStandard; chapter: string; topic: string }) =>
    api(
      `/batches/${batchId}/progress?subject=${enc(input.subject)}&standard=${enc(input.standard)}&chapter=${enc(input.chapter)}&topic=${enc(input.topic)}`,
      { method: 'DELETE' }
    ),

  timetable: (batchId?: string) =>
    api<{ entries: TimetableEntry[] }>(`/timetable${batchId ? `?batchId=${batchId}` : ''}`).then((r) => r.entries),
  addClass: (input: { batchId: string; subject: SchoolSubject; day: number; start: string; end: string; note?: string }) =>
    api<{ entry: TimetableEntry }>('/timetable', { method: 'POST', body: input }).then((r) => r.entry),
  /**
   * The same class on several days at once (all or none). The tuition picks
   * the teacher, or none (null); left out, it's the batch's teacher for the subject.
   */
  addClasses: (input: { batchId: string; subject: SchoolSubject; days: number[]; start: string; end: string; note?: string; teacherId?: string | null }) =>
    api<{ entry: TimetableEntry; entries?: TimetableEntry[] }>('/timetable', { method: 'POST', body: input }).then((r) => r.entries ?? [r.entry]),
  updateClass: (id: string, input: Partial<{ batchId: string; subject: SchoolSubject; day: number; start: string; end: string; note: string; teacherId: string | null }>) =>
    api<{ entry: TimetableEntry }>(`/timetable/${id}`, { method: 'PATCH', body: input }).then((r) => r.entry),
  deleteClass: (id: string) => api(`/timetable/${id}`, { method: 'DELETE' }),

  tests: (batchId?: string) => api<{ tests: TestSummary[] }>(`/tests${batchId ? `?batchId=${batchId}` : ''}`).then((r) => r.tests),
  test: (id: string) => api<TestDetail>(`/tests/${id}`),
  /** Who has started, is answering or has finished a test (teachers and the tuition). */
  testMonitor: (id: string) => api<TestMonitor>(`/tests/${id}/monitor`),
  createTest: (input: NewTest) => api<{ test: TestSummary }>('/tests', { method: 'POST', body: input }).then((r) => r.test),
  /** Edits an upcoming test that nobody has started, or closes an open one early with { closeNow: true }. */
  updateTest: (id: string, input: Partial<Omit<NewTest, 'batchId' | 'subject' | 'standard'>> & { closeNow?: boolean }) =>
    api<{ test: TestSummary }>(`/tests/${id}`, { method: 'PATCH', body: input }).then((r) => r.test),
  /** Cancels an upcoming test that nobody has started. */
  deleteTest: (id: string) => api(`/tests/${id}`, { method: 'DELETE' }),
};

/** "Today", "Yesterday" or "12 Oct". */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "26 Oct, 4:30 PM" */
export function dateTimeLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Today as "YYYY-MM-DD" in the phone's time zone. */
export function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Analysis ──────────────────────────────────────────────────────────────


export interface StudentAnalysis {
  /** `program` comes from Step 2 servers; older ones send only `track`. */
  student: { id: string; name: string; program?: Program | null; track: string | null; standard: string | null; batch: string | null };
  summary: { testsTaken: number; averagePercent: number | null; answered: number; accuracy: number | null };
  strong: TopicStat[];
  weak: TopicStat[];
  subjects: { subject: string; answered: number; accuracy: number; chapters: TopicStat[] }[];
  tests: { testId: string; title: string; subject: string; score: number; maxScore: number; percent: number; correct: number; wrong: number; skipped: number; submittedAt: string }[];
}

export interface TestAnalysis {
  submitted: number;
  maxScore: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  bands: { from: number; to: number; students: number }[];
  topics: TopicStat[];
  hardest: { index: number; chapter: string; topic: string; questionText: string; correctAnswer: string; answered: number; skipped: number; accuracy: number | null; choices: Record<string, number> }[];
}

export interface BatchAnalysis {
  batch: { id: string; name: string };
  students: {
    student: { id: string; name: string };
    testsTaken: number;
    averagePercent: number | null;
    accuracy: number | null;
    level: TopicStat['level'];
    strongTopics: number;
    weakTopics: number;
    weakest: string[];
  }[];
  weakTopics: TopicStat[];
  strongTopics: TopicStat[];
}

export const analysisApi = {
  student: (id: string) => api<StudentAnalysis>(`/analysis/student/${id}`),
  test: (id: string) => api<TestAnalysis>(`/analysis/test/${id}`),
  batch: (id: string) => api<BatchAnalysis>(`/analysis/batch/${id}`),
};
