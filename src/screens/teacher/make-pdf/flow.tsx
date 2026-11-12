import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { confirmAction } from '@/components/confirm-action';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { SmartPdfScreen } from '@/components/smart-pdf-screen';
import { useAuth } from '@/context/auth-context';
import { useKeepServerConnection } from '@/hooks/use-keep-server-connection';
import { loadPaperStyle, savePaperStyle } from '@/services/paper-style-prefs';
import { type SavedPdf } from '@/services/pdf-library';
import { loadPdfWatermark, savePdfWatermark } from '@/services/pdf-watermark-prefs';
import { createPdfsFor, PdfRequestError, type PdfStage } from '@/services/question-pdf';
import { DEFAULT_PAPER_STYLE, type PaperStyle } from '@/shared/paper-style';
import { cleanWatermark } from '@/shared/watermark';
import { bankSummary, EMPTY_BANK_SCOPE, type BankScope } from '@/screens/teacher/make-pdf/bank-scope';
import { DoneStep } from '@/screens/teacher/make-pdf/done-step';
import { DEFAULT_DURATION_MINUTES, dayKey, ExamSettingsStep, startOfToday, type ExamForm } from '@/screens/teacher/make-pdf/exam-settings';
import { chaptersOf, marksPerQuestionFor, standardsOf, titleFromNames, type PdfKind } from '@/screens/teacher/make-pdf/model';
import { PaperClassStep, PaperFormatStep, PaperQuestionsStep } from '@/screens/teacher/make-pdf/one-page';
import { deriveSubjects, subjectHeader } from '@/screens/teacher/make-pdf/pdf-subjects';
import { SubjectReview } from '@/screens/teacher/make-pdf/subject-review';
import { StepHeader } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';
import { selectedQuestions, type SubjectSelection } from '@/screens/teacher/question-selection/model';

/** Four short steps, each with one job, then the finished paper. */
type Step = 'class' | 'questions' | 'format' | 'settings' | 'done';

const STEPS = 4;
const STEP_INFO: Record<Step, { index: number; name: string }> = {
  class: { index: 0, name: 'Class' },
  questions: { index: 1, name: 'Questions' },
  format: { index: 2, name: 'Paper or slides' },
  settings: { index: 3, name: 'Paper details' },
  done: { index: 3, name: '' },
};


const newExamForm = (): ExamForm => ({
  title: null,
  standard: null,
  paperSet: '1',
  date: startOfToday(),
  duration: DEFAULT_DURATION_MINUTES,
  choice: 'answers',
  watermark: '',
  style: DEFAULT_PAPER_STYLE,
});

/**
 * Make a paper, for teachers, in four short steps: the class, the questions (by
 * hand or at random), what to make of them (an exam paper or classroom slides),
 * then that one's details, and the finished paper. One header says where the teacher
 * is. The rules for what a choice does to the ones after it live in bank-scope.ts.
 */
export function MakePdfFlow({
  onViewPdfs,
  onExit,
  bottomInset = 0,
  active = true,
}: {
  onViewPdfs?: () => void;
  /** Leaves the flow from its first step (back to Papers); what was chosen is kept. */
  onExit?: () => void;
  bottomInset?: number;
  /** The tab is on screen; the flow stays mounted (keeping its choices) while other tabs show. */
  active?: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const institute = user?.tuition?.name ?? '';

  const [step, setStep] = useState<Step>('class');
  const [kind, setKind] = useState<PdfKind>('exam');
  const [scope, setScope] = useState<BankScope>(EMPTY_BANK_SCOPE);
  const [selected, setSelected] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<SubjectSelection[]>([]);
  const [form, setForm] = useState<ExamForm>(newExamForm);
  const [stage, setStage] = useState<{ stage: PdfStage; count: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [made, setMade] = useState<{ pdfs: SavedPdf[]; questions: Question[] } | null>(null);

  // The form leads to requests; keep the connection fresh while it is filled in.
  useKeepServerConnection(active && step !== 'done');

  // The teacher's remembered watermark and paper style, unless they've already changed them here.
  const touchedForm = useRef(false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void Promise.all([loadPaperStyle(userId), loadPdfWatermark(userId)]).then(([style, watermark]) => {
      if (cancelled || touchedForm.current) return;
      setForm((current) => ({ ...current, style: style.saved ? style.style : current.style, watermark: watermark ?? current.watermark }));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const changeForm = (next: ExamForm) => {
    touchedForm.current = true;
    setForm(next);
    if (userId && next.style !== form.style) void savePaperStyle(userId, next.style);
  };

  const busy = stage !== null;
  // The picked questions are already in the teacher's subject order, which is the order the PDF prints them in.
  const subject = subjectHeader(deriveSubjects(selected));
  const chapters = scope.topics.length ? scope.topics : scope.chapters.length ? scope.chapters : chaptersOf(selected);
  const titleDefault = titleFromNames(chapters) || [scope.course === 'Competitive' ? scope.exam : scope.course, scope.standard, subject].filter(Boolean).join(' ');
  const standardDefault = standardsOf(selected);

  const makeExamPdf = async (style: PaperStyle) => {
    if (selected.length === 0) return;
    setPdfError(null);
    setStage({ stage: 'making', count: selected.length });
    const watermark = cleanWatermark(form.watermark);
    // What this paper used is what the next one starts with.
    if (userId) {
      void savePdfWatermark(userId, watermark);
      void savePaperStyle(userId, form.style);
    }
    try {
      const pdfs = await createPdfsFor(
        {
          title: (form.title ?? titleDefault).trim(),
          questions: selected,
          marksPerQuestion: marksPerQuestionFor(form.standard ?? standardDefault),
          standard: (form.standard ?? standardDefault).trim() || undefined,
          subject,
          paper: {
            paperSet: form.paperSet.trim() || '1',
            date: dayKey(form.date),
            durationMinutes: form.duration || undefined,
            watermark: watermark || undefined,
            style,
          },
        },
        form.choice,
        (next) => setStage((current) => (current ? { ...current, stage: next } : current))
      );
      setMade({ pdfs, questions: selected });
      setStep('done');
    } catch (error) {
      setPdfError(error instanceof PdfRequestError ? error.message : 'Could not make the PDF. Try again, or pick fewer questions.');
    } finally {
      setStage(null);
    }
  };

  const reset = () => {
    setStep('class');
    setScope(EMPTY_BANK_SCOPE);
    setSelected([]);
    setSessions([]);
    setPdfError(null);
    setMade(null);
    setForm((current) => ({ ...newExamForm(), style: current.style, watermark: current.watermark }));
  };

  const startOver = () => {
    if (busy) return;
    if (scope.course !== '' || selected.length > 0) {
      confirmAction('Start over?', 'Your choices and picked questions will be cleared.', 'Start over', reset);
    } else {
      reset();
    }
  };

  const back = () => {
    if (busy) return;
    setPdfError(null);
    if (step === 'settings') setStep('format');
    else if (step === 'format') setStep('questions');
    else if (step === 'questions') setStep('class');
    else if (step === 'done') reset();
    else onExit?.();
  };

  // Android's Back button goes one step back (keeping what was chosen) instead of leaving the app.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    if (!active || step === 'class') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [active, step]);

  const info = STEP_INFO[step];

  return (
    <KeyboardSafeView>
      <StepHeader
        title={step === 'done' ? 'Paper ready' : 'Make a paper'}
        subtitle={step === 'done' ? bankSummary(scope) : `Step ${info.index + 1} of ${STEPS} · ${step === 'settings' && kind === 'smart' ? 'Slide settings' : info.name}`}
        step={info.index}
        steps={STEPS}
        onBack={step === 'done' || (step === 'class' && !onExit) ? undefined : back}
        backLabel={step === 'class' ? 'Back to Papers' : 'Back'}
        onReset={step !== 'done' && !busy && (scope.course !== '' || selected.length > 0) ? startOver : undefined}
      />

      {step === 'class' ? (
        <PaperClassStep
          scope={scope}
          onScope={setScope}
          sessions={sessions}
          onSessions={next => { setSessions(next); setSelected(selectedQuestions(next)); }}
          onNext={() => setStep('questions')}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'questions' ? (
        <PaperQuestionsStep
          scope={scope}
          sessions={sessions}
          onSessions={next => { setSessions(next); setSelected(selectedQuestions(next)); }}
          onContinue={(questions) => {
            setSelected(questions);
            setStep('format');
          }}
          bottomInset={bottomInset}
        />
      ) : null}

      {/* The summary of what was picked is part of this page and scrolls with it (it used to stay pinned over the settings). */}
      {step === 'format' ? (
        <PaperFormatStep
          kind={kind}
          onKind={setKind}
          summary={<SubjectReview questions={selected} onEdit={back} />}
          onNext={() => setStep('settings')}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'settings' && kind === 'exam' ? (
        <ExamSettingsStep
          form={form}
          onForm={changeForm}
          titleDefault={titleDefault}
          standardDefault={standardDefault}
          institute={institute}
          subject={subject}
          questionTotal={selected.length}
          stage={stage}
          error={pdfError}
          onGenerate={(style) => void makeExamPdf(style)}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'settings' && kind === 'smart' ? (
        <SmartPdfScreen
          title={titleDefault}
          questions={selected}
          standard={standardDefault || undefined}
          subject={subject}
          bottomInset={bottomInset}
          onMade={(pdf) => {
            setMade({ pdfs: [pdf], questions: selected });
            setStep('done');
          }}
        />
      ) : null}

      {step === 'done' && made ? (
        <DoneStep made={made} kind={kind} standard={standardDefault} subject={subject} onViewPdfs={onViewPdfs} onAnother={reset} bottomInset={bottomInset} />
      ) : null}
    </KeyboardSafeView>
  );
}
