// The one-page Make PDF form's choices and what each does to the ones after it:
// course → class → (exam) → subject → source → chapters → topics → years.
// Plain functions on plain data, so each rule is tested without a screen.
// The course rules mirror papers/src/lib/makePdfBank.ts; change both together.

export type Course = 'Foundation' | 'Competitive';
export type QuestionSource = 'regular' | 'pyq';
export type CompetitiveExam = 'JEE' | 'NEET';
/** The bank's difficulty values; teachers see Hard as "Difficult". */
export type QuestionLevel = 'Easy' | 'Medium' | 'Hard';
export const LEVEL_OPTIONS: { value: QuestionLevel; label: string }[] = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Difficult' },
];

// These are API selectors, not Question.source provenance strings. Keep in sync
// with papers/readScope: regular is the superset, pyq narrows by exam and year.
export const sourceOptions = (scope: Pick<BankScope, 'course'>) => [
  { value: 'regular' as const, label: 'Regular Questions' },
  ...(scope.course === 'Competitive' ? [{ value: 'pyq' as const, label: 'PYQs' }] : []),
];

export const COURSES: readonly Course[] = ['Foundation', 'Competitive'];
export const CLASSES: Record<Course, readonly string[]> = { Foundation: ['9th', '10th'], Competitive: ['11th', '12th'] };
export const COMPETITIVE_EXAMS: readonly CompetitiveExam[] = ['JEE', 'NEET'];
const FOUNDATION_SUBJECTS = ['Mathematics', 'Science'] as const;
const COMPETITIVE_SUBJECTS: Record<CompetitiveExam, readonly string[]> = {
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

/** What the form holds. Empty text means not chosen yet. */
export interface BankScope {
  course: Course | '';
  standard: string;
  exam: CompetitiveExam | '';
  subject: string;
  source: QuestionSource;
  sources?: QuestionSource[];
  search?: string;
  /** Question levels to keep; none means every level. */
  levels?: QuestionLevel[];
  chapters: string[];
  topics: string[];
  years: string[];
}

export const EMPTY_BANK_SCOPE: BankScope = { course: '', standard: '', exam: '', subject: '', source: 'regular', chapters: [], topics: [], years: [] };

/** The subjects the course (and, for Competitive, the exam) offers. */
export function subjectsOf(scope: Pick<BankScope, 'course' | 'exam'>): string[] {
  if (scope.course === 'Foundation') return [...FOUNDATION_SUBJECTS];
  if (scope.course === 'Competitive' && scope.exam) return [...COMPETITIVE_SUBJECTS[scope.exam]];
  return [];
}

/** Only Competitive has PYQs we can identify; Foundation offers regular MCQs only. */
export const hasPyqs = (scope: Pick<BankScope, 'course'>) => scope.course === 'Competitive';

const NO_CHOICES = (): Pick<BankScope, 'chapters' | 'topics' | 'years'> => ({ chapters: [], topics: [], years: [] });

/** Another course: the class, exam and subject belong to the old one, so all go. */
export function withCourse(scope: BankScope, course: Course): BankScope {
  return course === scope.course ? scope : { ...EMPTY_BANK_SCOPE, course };
}

/** Another class: the chosen chapters and topics were that class's. */
export function withClass(scope: BankScope, standard: string): BankScope {
  return standard === scope.standard ? scope : { ...scope, standard, ...NO_CHOICES() };
}

/** Another exam: the subject stays only if the new exam has it; chapters, topics and years go. */
export function withExam(scope: BankScope, exam: CompetitiveExam): BankScope {
  if (exam === scope.exam) return scope;
  const next = { ...scope, exam, ...NO_CHOICES() };
  return { ...next, subject: subjectsOf(next).includes(scope.subject) ? scope.subject : '' };
}

export function withSubject(scope: BankScope, subject: string): BankScope {
  return subject === scope.subject ? scope : { ...scope, subject, ...NO_CHOICES() };
}

/** Regular or PYQ: the years only exist for PYQs, and the chapters may differ between the two. */
export function withSource(scope: BankScope, source: QuestionSource): BankScope {
  return source === scope.source ? scope : { ...scope, source, ...NO_CHOICES() };
}

/** Other chapters; topics of chapters no longer chosen go. */
export function withChapters(scope: BankScope, chapters: string[], topics: readonly { chapter: string; name: string }[]): BankScope {
  const allowed = new Set(chapters.map((chapter) => chapter.toLowerCase()));
  const keep = new Set(topics.filter((topic) => allowed.has(topic.chapter.toLowerCase())).map((topic) => topic.name.toLowerCase()));
  return { ...scope, chapters, topics: scope.topics.filter((topic) => keep.has(topic.toLowerCase())) };
}

/** Whether the form names a complete place to take questions from. */
export const bankReady = (scope: BankScope) => bankMissing(scope) === null;

/** What is missing, in the order the form asks for it, or null. */
export function bankMissing(scope: BankScope): string | null {
  if (!scope.course) return 'Choose Foundation or Competitive.';
  if (!scope.standard) return 'Choose a class.';
  if (scope.course === 'Competitive' && !scope.exam) return 'Choose an exam.';
  if (!scope.subject) return 'Choose a subject.';
  return null;
}

/** The body the make-pdf endpoints take. */
export function bankBody(scope: BankScope): Record<string, unknown> {
  return {
    course: scope.course,
    standard: scope.standard,
    exam: scope.exam || undefined,
    subject: scope.subject,
    source: scope.sources?.length ? scope.sources : scope.source,
    chapters: scope.chapters,
    topics: scope.topics,
    years: (scope.sources ? scope.sources.length === 1 && scope.sources[0] === 'pyq' : scope.source === 'pyq') ? scope.years : [],
    ...(scope.search?.trim() ? { search: scope.search.trim() } : {}),
    ...(scope.levels?.length ? { levels: scope.levels } : {}),
  };
}

interface Picked {
  standard: string;
  subject: string;
  chapter: string;
  topic: string;
  source?: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The selected questions that still belong after the form changed. A different
 * course, class, exam, subject or source takes them all out; narrower chapters,
 * topics or years only take out the questions outside them. Nothing incompatible
 * stays selected silently: the screen says how many went.
 */
export function keepSelected<Q extends Picked>(questions: Q[], before: BankScope, after: BankScope): Q[] {
  const base = (s: BankScope) => [s.course, s.standard, s.exam, s.subject, s.source].join('|');
  if (base(before) !== base(after)) return [];
  return questions.filter((question) => {
    if (after.chapters.length && !after.chapters.some((chapter) => same(chapter, question.chapter))) return false;
    if (after.topics.length && !after.topics.some((topic) => same(topic, question.topic))) return false;
    if (after.source === 'pyq' && after.years.length) {
      const year = /\b((?:19|20)\d{2})\b/.exec(question.source ?? '')?.[1];
      if (!year || !after.years.includes(year)) return false;
    }
    return true;
  });
}

/** A key that changes whenever the choices that decide which questions match do. */
export const bankKey = (scope: BankScope) => JSON.stringify(bankBody(scope));

/** "Foundation · 9th · Science", "JEE · 12th · Physics · PYQs" for headings. */
export function bankSummary(scope: BankScope): string {
  const place = scope.course === 'Competitive' ? scope.exam : scope.course;
  return [place, scope.standard, scope.subject, scope.source === 'pyq' ? 'PYQs' : ''].filter(Boolean).join(' · ');
}
