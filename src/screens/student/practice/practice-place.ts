import type { Href } from 'expo-router';
import type { SchoolSubject } from '@/constants/school';

// Where topic practice lives: subject → chapter → topic are pushed screens
// (/practice/[subject] and /practice/[subject]/[chapter]?topic=…), so Back and
// the swipe work as everywhere else and any screen can link to a chapter.

/** The `topic` query value for "every question of the chapter". */
export const WHOLE_CHAPTER = '__all__';

export const practiceSubjectHref = (subject: SchoolSubject): Href => `/practice/${encodeURIComponent(subject)}` as Href;

export function practiceChapterHref(at: { subject: SchoolSubject; chapter: string; standard?: string | null; topic?: string | null }): Href {
  const query = new URLSearchParams();
  if (at.standard) query.set('standard', at.standard);
  if (at.topic) query.set('topic', at.topic);
  const search = query.toString();
  return `/practice/${encodeURIComponent(at.subject)}/${encodeURIComponent(at.chapter)}${search ? `?${search}` : ''}` as Href;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The chapter a link means: by name (ignoring case), in the given class if it's
 * there, else the student's own class, else the first match.
 */
export function findChapter<C extends { standard: string; chapter: string; mine: boolean }>(chapters: C[], chapter: string, standard?: string | null): C | null {
  const matches = chapters.filter((c) => same(c.chapter, chapter));
  return (standard ? matches.find((c) => c.standard === standard) : undefined) ?? matches.find((c) => c.mine) ?? matches[0] ?? null;
}

/** A topic of the chapter by name, ignoring case. */
export const findTopic = <T extends { topic: string }>(topics: T[], name: string) => topics.find((t) => same(t.topic, name)) ?? null;

export interface LastPractised {
  subject: SchoolSubject;
  standard: string;
  chapter: string;
  /** null: the whole chapter. */
  topic: string | null;
  at: number;
}

export function isLastPractised(value: unknown): value is LastPractised {
  const v = value as Partial<LastPractised> | null;
  return !!v && typeof v.subject === 'string' && typeof v.standard === 'string' && typeof v.chapter === 'string' && (v.topic === null || typeof v.topic === 'string') && typeof v.at === 'number';
}
