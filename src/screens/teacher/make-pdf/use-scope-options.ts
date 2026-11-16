import { useMemo } from 'react';
import { STANDARDS_BY_TRACK, syllabusOptions } from '@/constants/syllabus';
import { useLoad } from '@/components/kit';
import { fetchScopeOptions, type ScopeOptions } from '@/services/pdf-questions';
import { orderLike } from '@/screens/teacher/make-pdf/model';
import { EXAMS, isExamId } from '@/shared/exam-bank';
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

  // Derive the syllabus track from the actual exam so the right reference
  // standards are used for chapter ordering. The previous code had both
  // ternary branches returning 'JEE/NEET', making it a no-op. "Science" is the
  // only Foundation-specific subject (9th/10th); JEE and NEET never have it,
  // so its presence marks a Foundation exam (Issue 3).
  const track = isExamId(exam)
    ? (EXAMS[exam].subjects.includes('Science') ? 'Foundation' : 'JEE/NEET')
    : 'JEE/NEET';
  // Use the standards that belong to this exam's track for syllabus ordering.
  const referenceStandards = STANDARDS_BY_TRACK[track] ?? STANDARDS_BY_TRACK['JEE/NEET'];
  const reference = useMemo(
    () => (enabled ? syllabusOptions(referenceStandards, [subject as Subject]).chapters : []),
    [enabled, subject, referenceStandards]
  );

  // The last answer is kept while another loads, so one for another exam or subject doesn't count.
  const fresh = data && data.key === key ? data.options : null;
  const ordered = useMemo(() => (fresh ? orderLike(fresh.chapters, reference) : []), [fresh, reference]);

  if (!enabled) return { status: 'idle' };
  if (fresh) return { status: 'ready', data: { ...fresh, ordered }, reload };
  if (error) return { status: 'error', message: error, reload };
  return { status: 'loading' };
}
