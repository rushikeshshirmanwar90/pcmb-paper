import { useEffect, useState } from 'react';
import { fetchFilterOptions } from '@/services/apiService';

interface Scope {
  examCategory: string;
  standard: string;
  subject: string;
  chapter: string;
}

/**
 * Chapter and topic dropdown options for the current selection — only the
 * chapters that uploaded papers contain under the chosen exam, standard and
 * subject, and only the topics within the chosen chapter. A standard with no
 * uploads yet (e.g. 12th) gets empty lists.
 */
export function useChapterTopicOptions({ examCategory, standard, subject, chapter }: Scope) {
  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    fetchFilterOptions({
      examCategory: examCategory as any,
      standard: standard as any,
      subject: subject as any,
      chapter,
    }).then((opts) => {
      if (isCancelled) return;
      setChapters(opts.chapters || []);
      setTopics(opts.topics || []);
    });
    return () => {
      isCancelled = true;
    };
  }, [examCategory, standard, subject, chapter]);

  return { chapters, topics };
}
