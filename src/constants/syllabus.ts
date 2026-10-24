import syllabusData from '@/data/syllabus.json';
import type { ExamCategory, Standard, Subject } from '@/types/pcmb';

export const ALL_STANDARDS: Standard[] = ['9th', '10th', '11th', '12th'];
export const ALL_SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science'];

/** Foundation is 9th and 10th; JEE/NEET is 11th and 12th. */
export const STANDARDS_BY_TRACK: Record<ExamCategory, Standard[]> = {
  Foundation: ['9th', '10th'],
  'JEE/NEET': ['11th', '12th'],
};

/** 9th and 10th study Science and Mathematics; 11th and 12th the four PCMB subjects. */
export const SUBJECTS_BY_TRACK: Record<ExamCategory, Subject[]> = {
  Foundation: ['Science', 'Mathematics'],
  'JEE/NEET': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

export const isStandard = (value: string): value is Standard => (ALL_STANDARDS as string[]).includes(value);
export const isSubject = (value: string): value is Subject => (ALL_SUBJECTS as string[]).includes(value);
const isTrack = (value: string): value is ExamCategory => value === 'Foundation' || value === 'JEE/NEET';

export const trackOf = (standard: Standard): ExamCategory =>
  standard === '9th' || standard === '10th' ? 'Foundation' : 'JEE/NEET';

/** The classes a selection covers; a chosen class wins over the track. */
export function standardsFor(examCategory: string, standard: string): Standard[] {
  if (isStandard(standard)) return [standard];
  return isTrack(examCategory) ? STANDARDS_BY_TRACK[examCategory] : ALL_STANDARDS;
}

/** The subjects to offer for a selection; a chosen class wins over the track. */
export function subjectsFor(examCategory: string, standard: string): Subject[] {
  const track = isStandard(standard) ? trackOf(standard) : examCategory;
  return isTrack(track) ? SUBJECTS_BY_TRACK[track] : ALL_SUBJECTS;
}

interface SyllabusChapter {
  name: string;
  topics: { name: string; questions: number }[];
}

// Every chapter and topic in the question bank, in syllabus order, with the
// questions each topic holds (Descriptive ones left out). Generated from the
// database by extractor/export_syllabus.py; run it again after loading more.
const SYLLABUS = syllabusData as Partial<Record<Standard, Partial<Record<Subject, SyllabusChapter[]>>>>;

export interface SyllabusOptions {
  chapters: string[];
  chapterCounts: Record<string, number>;
  topics: string[];
  topicCounts: Record<string, number>;
  /** Each chapter's topics in syllabus order. */
  chapterTopics: Record<string, string[]>;
}

/**
 * The chapters of the given classes and subjects in syllabus order, and the
 * topics of the chosen chapter (all of their topics when none is chosen),
 * each with its question count.
 */
export function syllabusOptions(
  standards: readonly Standard[],
  subjects: readonly Subject[],
  chapter?: string
): SyllabusOptions {
  const chosen = chapter && chapter !== 'All' ? chapter.toLowerCase() : null;
  const chapterCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const chapterTopics: Record<string, string[]> = {};

  for (const standard of standards) {
    for (const subject of subjects) {
      for (const { name, topics } of SYLLABUS[standard]?.[subject] ?? []) {
        let inChapter = 0;
        chapterTopics[name] = mergeNames(chapterTopics[name] ?? [], topics.map((topic) => topic.name));
        for (const topic of topics) {
          inChapter += topic.questions;
          if (!chosen || name.toLowerCase() === chosen) {
            topicCounts.set(topic.name, (topicCounts.get(topic.name) ?? 0) + topic.questions);
          }
        }
        chapterCounts.set(name, (chapterCounts.get(name) ?? 0) + inChapter);
      }
    }
  }

  return {
    chapters: [...chapterCounts.keys()],
    chapterCounts: Object.fromEntries(chapterCounts),
    topics: [...topicCounts.keys()],
    topicCounts: Object.fromEntries(topicCounts),
    chapterTopics,
  };
}

/** `first` in its own order, then whatever `extra` adds (compared case-insensitively). */
export function mergeNames(first: readonly string[], extra: readonly string[]): string[] {
  const seen = new Set(first.map((name) => name.toLowerCase()));
  return [...first, ...extra.filter((name) => !seen.has(name.toLowerCase()))];
}
