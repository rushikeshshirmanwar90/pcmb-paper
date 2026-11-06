import { useMemo } from 'react';
import { STANDARDS_BY_TRACK, syllabusOptions } from '@/constants/syllabus';
import { useLoad } from '@/components/kit';
import { fetchScopeOptions, type ScopeOptions } from '@/services/pdf-questions';
import { orderLike } from '@/screens/teacher/make-pdf/model';
import type { Subject } from '@/types/pcmb';

/** An exam's chapters and topics for a subject, ready for the dropdowns. */
export interface ScopeData extends ScopeOptions {
  /** Chapters in syllabus order. */
  ordered: string[];
}

export type ScopeLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; reload: () => void }
  | { status: 'ready'; data: ScopeData; reload: () => void };

/**
 * The chapters (and their topics and question counts) that the chosen exam
 * has questions in for the chosen subject, from the server. Nothing is shown
 * from the bundled syllabus or from another exam while this loads: a chapter
 * with no questions in the exam would only lead to an empty paper.
 */
export function useScopeOptions(exam: string, subject: string): ScopeLoad {
  const enabled = exam !== '' && subject !== '';
  const key = `${exam}|${subject}`;
  const { data, error, reload } = useLoad(async () => ({ key, options: await fetchScopeOptions(exam, subject) }), [exam, subject], { enabled });
  // Reading the syllabus order is cheap; both classes, since a paper isn't tied to one.
  const reference = useMemo(() => (enabled ? syllabusOptions(STANDARDS_BY_TRACK['JEE/NEET'], [subject as Subject]).chapters : []), [enabled, subject]);
  // The last answer is kept while another loads, so one for another exam or subject doesn't count.
  const fresh = data && data.key === key ? data.options : null;
  const ordered = useMemo(() => (fresh ? orderLike(fresh.chapters, reference) : []), [fresh, reference]);

  if (!enabled) return { status: 'idle' };
  if (fresh) return { status: 'ready', data: { ...fresh, ordered }, reload };
  if (error) return { status: 'error', message: error, reload };
  return { status: 'loading' };
}
