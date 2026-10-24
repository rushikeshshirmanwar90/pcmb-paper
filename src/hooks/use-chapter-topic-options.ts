import { useEffect, useMemo, useState } from 'react';
import { ALL_SUBJECTS, isSubject, mergeNames, standardsFor, syllabusOptions } from '@/constants/syllabus';
import { fetchFilterOptions } from '@/services/apiService';
import type { FilterOptions } from '@/types/pcmb';

interface Scope {
  examCategory: string;
  standard: string;
  subject: string;
  chapter: string;
}

interface Loaded {
  /** The exam/standard/subject the chapters belong to. */
  scopeKey: string;
  /** That plus the chapter the topics belong to. */
  fullKey: string;
  options: FilterOptions;
}

const NO_COUNTS: Record<string, number> = {};
const NO_TOPICS: Record<string, string[]> = {};

/**
 * Chapter and topic dropdown options for the current selection: every
 * chapter of the chosen class and subject in syllabus order, and every topic
 * of the chosen chapter, each with how many questions it holds.
 *
 * They come from the bundled syllabus at once; the server's lists are merged
 * in when they arrive, adding chapters and topics only uploaded papers have,
 * and its live counts replace the bundled ones.
 *
 * `enabled: false` returns nothing, for a form that has no subject yet.
 */
export function useChapterTopicOptions(
  { examCategory, standard, subject, chapter }: Scope,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const scopeKey = [examCategory, standard, subject].join('|');
  const fullKey = `${scopeKey}|${chapter}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;
    fetchFilterOptions({
      examCategory: examCategory as any,
      standard: standard as any,
      subject: subject as any,
      chapter,
    }).then((options) => {
      if (!isCancelled) setLoaded({ scopeKey, fullKey, options });
    });
    return () => {
      isCancelled = true;
    };
  }, [enabled, examCategory, standard, subject, chapter, scopeKey, fullKey]);

  const bundled = useMemo(
    () => syllabusOptions(standardsFor(examCategory, standard), isSubject(subject) ? [subject] : ALL_SUBJECTS, chapter),
    [examCategory, standard, subject, chapter]
  );

  return useMemo(() => {
    if (!enabled) {
      return {
        chapters: [],
        chapterCounts: NO_COUNTS,
        topics: [],
        topicCounts: NO_COUNTS,
        chapterTopics: NO_TOPICS,
        loading: false,
      };
    }
    // Picking a chapter only changes the topics, so the server's chapter list
    // for the same class and subject still applies while its topics load.
    const server = loaded?.scopeKey === scopeKey ? loaded.options : null;
    const serverTopics = loaded?.fullKey === fullKey ? loaded.options : null;
    const chapterTopics: Record<string, string[]> = { ...bundled.chapterTopics };
    for (const [name, topics] of Object.entries(server?.chapterTopics ?? {})) {
      chapterTopics[name] = mergeNames(chapterTopics[name] ?? [], topics);
    }
    return {
      chapters: mergeNames(bundled.chapters, server?.chapters ?? []),
      chapterCounts: { ...bundled.chapterCounts, ...server?.chapterCounts },
      topics: mergeNames(bundled.topics, serverTopics?.topics ?? []),
      topicCounts: { ...bundled.topicCounts, ...serverTopics?.topicCounts },
      chapterTopics,
      loading: !serverTopics,
    };
  }, [enabled, bundled, loaded, scopeKey, fullKey]);
}
