import type { VisibilityPacket } from '@/screens/student/exam-visibility';
import type { AnswerUpdate } from '@/screens/student/answer-saver';
import type { SavedAnswer } from '@/screens/student/answer-sync';
import { api, ApiError } from '@/services/api-client';
import { withEngagement, type EngagementField } from '@/services/engagement-api';
import type { Program, SchoolStandard, SchoolSubject, Track } from '@/constants/school';
import type { TestSummary, TimetableEntry, TopicPerformance, WeakTopic } from '@/services/school-api';
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
  enrollmentStatus?: 'enrolled' | 'approval_pending' | 'batch_pending' | null;
  pendingBatchName?: string | null;
}

export type StudentTest = TestSummary & { mine: { state: 'in-progress' | 'suspended' | 'submitted'; score: number | null } | null };

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
  state: 'in-progress' | 'suspended' | 'submitted';
  id?: string;
  suspendedAt?: string | null;
  remainingMs?: number;
  resumeVersion?: number;
  revision?: number;
  visibilityVerified?: boolean;
  startedAt: string;
  /** "violation" when the attempt was ended for leaving the app during the exam. */
  endedReason?: 'violation' | null;
  deadline: string;
  /** The server's clock when it answered, so the time left doesn't depend on the phone's clock. */
  serverTime?: string;
  answers: { index: number; selected: string | null; correct: boolean | null; version?: number }[];
  result: { score: number; maxScore: number; correct: number; wrong: number; skipped: number; timeTakenSeconds: number; submittedAt: string } | null;
}

/** A student's own analytics for a closed test: their rank (a number, nothing about others) and topic performance. */
export interface TestAnalytics {
  rank: number;
  /** How many attempts were ranked. */
  ranked: number;
  percentage: number | null;
  accuracy: number | null;
  unanswered: number;
  negativeDeducted: number;
  topics: TopicPerformance[];
  weakTopics: WeakTopic[];
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
  /** From Step 2 servers: the student's program, and false when it has no question bank (no chapters then). */
  program?: Program | null;
  available?: boolean;
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
  /** The student's progress after this answer (servers with engagement; null if it failed there). */
  engagement?: EngagementField | null;
};


// ─── Self-assessment ───────────────────────────────────────────────────────
// A test the student makes from past-year questions (papers/src/lib/self-assessment.ts).

export type AssessmentMix = 'smart' | 'balanced' | 'challenge' | 'retake';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type DifficultySplit = Record<Difficulty, number>;
export type StrengthLevel = 'strong' | 'average' | 'weak';

/** A chapter picked, with the topics picked (none: the whole chapter). */
export interface AssessmentScope {
  standard: SchoolStandard;
  chapter: string;
  topics: string[];
}

export interface AssessmentSetup {
  subject: SchoolSubject;
  scope: AssessmentScope[];
  count: number;
  mix: AssessmentMix;
  /** null: no time limit. */
  durationMinutes: number | null;
  negativeMarking: boolean;
  /** The plan's seed, so the test made matches the plan shown. */
  seed?: number;
}

/** Why the Smart mix chose its split. */
export interface AssessmentBasis {
  kind: 'fixed' | 'no-history' | 'struggling' | 'steady' | 'confident';
  accuracy: number | null;
  answered: number;
}

export interface AssessmentPlan {
  /** Send back with the setup when making the test. */
  seed: number;
  plan: {
    count: number;
    requested: number;
    byDifficulty: DifficultySplit;
    split: DifficultySplit;
    fresh: number;
    available: DifficultySplit & { total: number; fresh: number };
  };
  basis: AssessmentBasis;
  topics: { standard: string; chapter: string; topic: string; count: number; available: number; level: Level; accuracy: number | null }[];
}

export interface AssessmentSummary {
  id: string;
  title: string;
  subject: SchoolSubject;
  mix: AssessmentMix;
  state: 'ready' | 'in-progress' | 'submitted';
  scope: AssessmentScope[];
  questionCount: number;
  plan: DifficultySplit & { fresh: number; requested: number };
  basis: AssessmentBasis;
  marksPerQuestion: number;
  negativeMarks: number;
  maxScore: number;
  durationMinutes: number | null;
  createdAt: string;
  startedAt: string | null;
  /** null without a time limit (or before it starts). */
  deadline: string | null;
  submittedAt: string | null;
  answeredCount: number;
  result: {
    score: number;
    maxScore: number;
    correct: number;
    wrong: number;
    skipped: number;
    timeTakenSeconds: number;
    strength: number;
    strongTopics: number;
    weakTopics: number;
  } | null;
}

export interface AssessmentQuestion {
  index: number;
  subject: string;
  standard: string;
  chapter: string;
  topic: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answerType: string;
  diagramUrls: string[];
  optionDiagramUrls: { A: string[]; B: string[]; C: string[]; D: string[] };
  /** Only once submitted. */
  difficulty?: Difficulty;
  correctAnswer?: string;
  explanation?: string;
  explanationDiagramUrls?: string[];
}

/** Right, wrong and skipped for one part of the test. strength = % right of all asked; weakness = 100 − strength. */
export interface StrengthTally {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  strength: number;
  weakness: number;
  accuracy: number | null;
  level: StrengthLevel;
}

export interface TopicStrength extends StrengthTally {
  standard: string;
  chapter: string;
  topic: string;
  /** % of all the questions lost (wrong + skipped) that are in this topic. */
  shareOfMistakes: number;
  wrongNumbers: number[];
  skippedNumbers: number[];
  fewQuestions: boolean;
}

export interface AssessmentReport {
  overall: StrengthTally;
  /** Weakest first. */
  topics: TopicStrength[];
  chapters: (StrengthTally & { standard: string; chapter: string; topics: number })[];
  difficulty: (StrengthTally & { difficulty: Difficulty })[];
  strongTopics: number;
  weakTopics: number;
  headline: string;
  advice: string[];
}

export interface AssessmentDetail {
  assessment: AssessmentSummary;
  answers: { index: number; selected: string | null; correct: boolean | null }[];
  /** Empty until started. */
  questions: AssessmentQuestion[];
  report: AssessmentReport | null;
}

const enc = encodeURIComponent;

/**
 * Self-assessment calls that can only 404 when the server is older than the
 * app (the routes are missing), so say that instead of "couldn't do that (404)".
 */
const SERVER_TOO_OLD = "Self-assessment isn't on the server yet. The server needs the latest update; try again after that.";
const needsAssessments = <T,>(request: Promise<T>) =>
  request.catch((e: unknown) => {
    throw e instanceof ApiError && e.status === 404 ? new ApiError(404, SERVER_TOO_OLD) : e;
  });

export const studentApi = {
  overview: () => api<StudentOverview>('/student/overview'),
  roadmap: (subject: SchoolSubject) => api<Roadmap>(`/student/roadmap?subject=${enc(subject)}`),

  /** The batch's tests, upcoming (scheduled) ones included as summaries; they can't be opened until they open. */
  tests: () => api<{ tests: StudentTest[] }>('/tests?upcoming=1').then((r) => r.tests),
  /** `analytics` is null (or missing from older servers) until the test has closed and the student has submitted. */
  test: (id: string) => api<{ test: TestSummary; access?: import('./school-api').TestAccess; attempt: Attempt | null; questions: TestQuestion[]; analytics?: TestAnalytics | null }>(`/tests/${id}`),
  requestTestAccess: (id: string) => api('/tests/' + id + '/access', { method: 'POST', body: { action: 'request' } }),
  reportVisibility: (id: string, body: VisibilityPacket) => api<{ attempt: Attempt; questions?: TestQuestion[] }>(`/tests/${id}/visibility`, { method: 'POST', body }),
  attemptStatus: (id: string) => api<{ attempt: Attempt | null; questions?: TestQuestion[] }>(`/tests/${id}/status`),
  start: (id: string) => api<{ attempt: Attempt; questions: TestQuestion[] }>(`/tests/${id}/start`, { method: 'POST', body: { visibility: true, answerVersions: true } }),
  saveAnswers: (id: string, answers: AnswerUpdate[], resumeVersion = 0) =>
    api<{ saved: number; answers: SavedAnswer[] }>(`/tests/${id}/answers`, { method: 'PUT', body: { answers, resumeVersion } }),
  /** The response's `engagement` field (participation XP) goes to the progress store; the runner never sees it. */
  submit: (id: string, answers: AnswerUpdate[], resumeVersion = 0) =>
    withEngagement(
      api<{ attempt: Attempt; questions: TestQuestion[]; engagement?: EngagementField | null }>(`/tests/${id}/submit`, { method: 'POST', body: { answers, resumeVersion } })
    ),

  /** The app came back after `awayMs` out of the foreground. The server records it and ends the attempt if that was too long. */
  reportAway: (id: string, awayMs: number, answers: { index: number; selected: string | null }[], resumeVersion = 0) =>
    api<{ attempt: Attempt; questions: TestQuestion[] }>(`/tests/${id}/events`, { method: 'POST', body: { type: 'away', awayMs, answers, resumeVersion } }),

  answerPyq: (questionId: string, selected: string) =>
    withEngagement(
      api<PyqAnswerResult>('/pyq/answer', {
        method: 'POST',
        body: { questionId, selected },
      })
    ),

  /** Topic practice: the subject's syllabus with question counts, coverage and the student's progress. */
  practiceTree: (subject: SchoolSubject) => api<PracticeTree>(`/pyq/topics?subject=${enc(subject)}`),
  /** A page of a chapter's or topic's questions; see practiceQuery. */
  practiceQuestions: (node: PracticeNode, status: PracticeStatus, after: string | null) =>
    api<PracticePage>(`/pyq/questions?${practiceQuery(node, status, after)}`),

  /** Self-assessment: the student's own, newest first. */
  assessments: () => needsAssessments(api<{ assessments: AssessmentSummary[] }>('/self-assessments')).then((r) => r.assessments),
  /** What a self-assessment with these choices would be, without making it. */
  planAssessment: (setup: AssessmentSetup) => needsAssessments(api<AssessmentPlan>('/self-assessments/plan', { method: 'POST', body: setup })),
  createAssessment: (setup: AssessmentSetup) => needsAssessments(api<AssessmentDetail>('/self-assessments', { method: 'POST', body: setup })),
  assessment: (id: string) => api<AssessmentDetail>(`/self-assessments/${id}`),
  startAssessment: (id: string) => api<AssessmentDetail>(`/self-assessments/${id}/start`, { method: 'POST' }),
  saveAssessmentAnswers: (id: string, answers: { index: number; selected: string | null }[]) =>
    api<{ saved: number }>(`/self-assessments/${id}/answers`, { method: 'PUT', body: { answers } }),
  submitAssessment: (id: string, answers: { index: number; selected: string | null }[]) =>
    withEngagement(api<AssessmentDetail & { engagement?: EngagementField | null }>(`/self-assessments/${id}/submit`, { method: 'POST', body: { answers } })),
  deleteAssessment: (id: string) => api<{ ok: true }>(`/self-assessments/${id}`, { method: 'DELETE' }),
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
