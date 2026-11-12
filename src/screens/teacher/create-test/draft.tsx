import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { useNavigation, usePreventRemove } from 'expo-router';
import { confirmAction } from '@/components/confirm-action';
import { EMPTY_BANK_SCOPE, type BankScope } from '@/screens/teacher/make-pdf/bank-scope';
import { timeOf, type StartMode } from '@/screens/teacher/test-schedule';
import type { Question } from '@/types/pcmb';
import type { SubjectSelection } from '@/screens/teacher/question-selection/model';

/** Everything the two Create Test pages hold. It lives in the flow's layout, so Back and Next never lose it. */
export interface TestDraft {
  requestId: string;
  title: string;
  batchIds: string[];
  subject: string;
  selections: SubjectSelection[];
  source: BankScope['source'];
  chapters: string[];
  topics: string[];
  years: string[];
  questions: Question[];
  audienceMode: 'all' | 'selected';
  studentIds: string[];
  excludedStudentIds: string[];
  /** Missing on older drafts, which used scheduled timing exclusively. */
  startMode?: StartMode;
  date: Date;
  start: string;
  /** null until picked: then the end follows the time limit plus an hour. */
  end: string | null;
  minutes: string;
  correct: string;
  wrong: string;
}

/** A fresh draft; `batchIds` pre-picks batches (e.g. Set a test from a batch's page). */
export function newDraft(batchIds: string[] = []): TestDraft {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return {
    requestId: `create_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`,
    title: '', batchIds, subject: '', selections: [], source: EMPTY_BANK_SCOPE.source, chapters: [], topics: [], years: [], questions: [],
    audienceMode: 'all', studentIds: [], excludedStudentIds: [], startMode: 'now', date, start: timeOf(date), end: null, minutes: '60', correct: '4', wrong: '0',
  };
}

interface Ctx {
  draft: TestDraft;
  update: (patch: Partial<TestDraft>) => void;
  /** Whether anything differs from a fresh draft (and the test isn't saved yet). */
  dirty: boolean;
  markSaved: () => void;
}

const DraftContext = createContext<Ctx | null>(null);

export function CreateTestProvider({ children, initialBatchIds = [] }: PropsWithChildren<{ initialBatchIds?: string[] }>) {
  const [initial] = useState(() => newDraft(initialBatchIds));
  const [draft, setDraft] = useState<TestDraft>(initial);
  const [saved, setSaved] = useState(false);
  const value = useMemo<Ctx>(() => {
    const base = initial;
    const dirty =
      !saved &&
      (draft.title.trim() !== '' || draft.batchIds.join('|') !== base.batchIds.join('|') || draft.questions.length > 0 || draft.studentIds.length > 0 || draft.excludedStudentIds.length > 0 ||
        draft.startMode !== base.startMode || draft.minutes !== base.minutes || draft.correct !== base.correct || draft.wrong !== base.wrong || draft.end !== null || draft.date.getTime() !== base.date.getTime() || draft.start !== base.start);
    return { draft, update: (patch) => setDraft((d) => ({ ...d, ...patch })), dirty, markSaved: () => setSaved(true) };
  }, [draft, saved, initial]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

const LeaveContext = createContext<() => void>(() => {});

/**
 * Guards leaving the whole Create Test flow (Back on page 1, Close on page 2,
 * Android's Back on page 1): with anything entered it asks first, and Discard
 * really leaves. Rendered in the flow's layout, so it guards the flow's route
 * itself; going from page 2 back to page 1 isn't leaving and isn't asked about.
 */
export function CreateTestLeaveGuard({ children }: PropsWithChildren) {
  const navigation = useNavigation();
  const { dirty } = useTestDraft();
  const [discarded, setDiscarded] = useState(false);
  // `repeat` turns the guard off and redoes the blocked navigation (dispatching it again would be blocked again).
  usePreventRemove(dirty && !discarded, ({ repeat }) =>
    confirmAction('Discard this test?', 'It hasn\'t been created yet, so what you entered on both pages will be lost.', 'Discard', () => {
      setDiscarded(true);
      repeat();
    })
  );
  const leave = useCallback(() => navigation.goBack(), [navigation]);
  return <LeaveContext.Provider value={leave}>{children}</LeaveContext.Provider>;
}

/** Leaves the Create Test flow (asking first when something was entered). */
export const useLeaveCreateTest = () => useContext(LeaveContext);

export function useTestDraft(): Ctx {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useTestDraft must be used inside the Create Test flow.');
  return ctx;
}
