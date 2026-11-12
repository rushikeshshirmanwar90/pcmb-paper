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

// ─── Practising and self-assessment as pages ───────────────────────────────

/** How a topic practice session runs (the same four as topic-practice.ts). */
export const PRACTICE_MODES = ['continue', 'review', 'retry', 'again'] as const;
export type SessionMode = (typeof PRACTICE_MODES)[number];

export interface SessionPlace {
  subject: SchoolSubject;
  standard: string;
  chapter: string;
  /** null: every question of the chapter. */
  topic: string | null;
}

/** The practice session page: /practice/session?subject=…&standard=…&chapter=…[&topic=…]&mode=… */
export function practiceSessionHref(at: SessionPlace, mode: SessionMode): Href {
  const query = new URLSearchParams({ subject: at.subject, standard: at.standard, chapter: at.chapter });
  if (at.topic) query.set('topic', at.topic);
  query.set('mode', mode);
  return `/practice/session?${query.toString()}` as Href;
}

/** The session a link means, or null when it's incomplete or the mode is unknown. */
export function sessionFromParams(p: { subject?: string; standard?: string; chapter?: string; topic?: string; mode?: string }): { at: Omit<SessionPlace, 'subject'> & { subject: string }; mode: SessionMode } | null {
  if (!p.subject || !p.standard || !p.chapter || !p.mode) return null;
  if (!(PRACTICE_MODES as readonly string[]).includes(p.mode)) return null;
  return { at: { subject: p.subject, standard: p.standard, chapter: p.chapter, topic: p.topic ? p.topic : null }, mode: p.mode as SessionMode };
}

/** A topic picked for a new self-assessment (e.g. the weak ones to retake). */
export interface PickedTopic {
  standard: string;
  chapter: string;
  topic: string;
}

/** Where the self-assessment page opens: the list, making one (maybe with topics picked), or one assessment. */
export type AssessmentOpen = { kind: 'home' } | { kind: 'build'; subject: SchoolSubject; preset: PickedTopic[] | null } | { kind: 'session'; id: string };

/** The self-assessment page: /practice/assessment[?id=…|?new=Subject[&topics=JSON]] */
export function assessmentHref(at: AssessmentOpen): Href {
  if (at.kind === 'session') return `/practice/assessment?id=${encodeURIComponent(at.id)}` as Href;
  if (at.kind === 'build') {
    const query = new URLSearchParams({ new: at.subject });
    if (at.preset?.length) query.set('topics', JSON.stringify(at.preset.map((t) => [t.standard, t.chapter, t.topic])));
    return `/practice/assessment?${query.toString()}` as Href;
  }
  return '/practice/assessment' as Href;
}

/** Where a self-assessment link opens; anything unreadable opens the list. */
export function assessmentFromParams(p: { id?: string; new?: string; topics?: string }): { kind: 'home' } | { kind: 'build'; subject: string; preset: PickedTopic[] | null } | { kind: 'session'; id: string } {
  if (p.id) return { kind: 'session', id: p.id };
  if (p.new) {
    let preset: PickedTopic[] | null = null;
    if (p.topics) {
      try {
        const rows: unknown = JSON.parse(p.topics);
        if (Array.isArray(rows)) {
          const picked = rows.filter((r): r is [string, string, string] => Array.isArray(r) && r.length === 3 && r.every((x) => typeof x === 'string'));
          preset = picked.length ? picked.map(([standard, chapter, topic]) => ({ standard, chapter, topic })) : null;
        }
      } catch {
        preset = null;
      }
    }
    return { kind: 'build', subject: p.new, preset };
  }
  return { kind: 'home' };
}
