import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { confirmAction } from '@/components/confirm-action';
import { Notice } from '@/components/kit';
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
import { OnePageSelect } from '@/screens/teacher/make-pdf/one-page';
import { deriveSubjects, subjectHeader, unresolvedSubjectMessage } from '@/screens/teacher/make-pdf/pdf-subjects';
import { SubjectReview } from '@/screens/teacher/make-pdf/subject-review';
import { StepHeader } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';
import { selectedQuestions, type SubjectSelection } from '@/screens/teacher/question-selection/model';

/** One screen to choose the questions, then the existing PDF settings, then the finished PDF. */
type Step = 'select' | 'settings' | 'done';

const STEP_INFO: Record<Step, { index: number; title: string }> = {
  select: { index: 0, title: 'Make PDF' },
  settings: { index: 1, title: 'PDF settings' },
  done: { index: 1, title: 'PDF ready' },
};

const DEFAULT_COUNT = 30;

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
 * Make PDF, for teachers: one screen to choose the course, class, exam, subject,
 * source, chapters and topics and then the questions (by hand or at random),
 * followed by the existing Exam PDF or Smart PDF settings. The rules for what a
 * choice does to the ones after it live in bank-scope.ts.
 */
export function MakePdfFlow({
  onViewPdfs,
  bottomInset = 0,
  active = true,
}: {
  onViewPdfs?: () => void;
  bottomInset?: number;
  /** The tab is on screen; the flow stays mounted (keeping its choices) while other tabs show. */
  active?: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const institute = user?.tuition?.name ?? '';

  const [step, setStep] = useState<Step>('select');
  const [kind, setKind] = useState<PdfKind>('exam');
  const [scope, setScope] = useState<BankScope>(EMPTY_BANK_SCOPE);
  const [count, setCount] = useState(DEFAULT_COUNT);
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
  const subjectBlock = unresolvedSubjectMessage(selected);
  const chapters = scope.topics.length ? scope.topics : scope.chapters.length ? scope.chapters : chaptersOf(selected);
  const titleDefault = titleFromNames(chapters) || [scope.course === 'Competitive' ? scope.exam : scope.course, scope.standard, subject].filter(Boolean).join(' ');
  const standardDefault = standardsOf(selected);

  const makeExamPdf = async (style: PaperStyle) => {
    if (selected.length === 0) return;
    if (subjectBlock) {
      setPdfError(subjectBlock);
      return;
    }
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
    setStep('select');
    setScope(EMPTY_BANK_SCOPE);
    setCount(DEFAULT_COUNT);
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
    if (step === 'settings') setStep('select');
    else if (step === 'done') reset();
  };

  // Android's Back button returns from the settings to the questions (keeping what was chosen) instead of leaving the app.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    if (!active || step === 'select') return;
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
        title={info.title}
        subtitle={step === 'select' ? undefined : bankSummary(scope)}
        step={info.index}
        steps={2}
        onBack={step === 'select' || step === 'done' ? undefined : back}
        onReset={step === 'select' && !busy && (scope.course !== '' || selected.length > 0) ? startOver : undefined}
      />

      {step === 'select' ? (
        <OnePageSelect
          kind={kind}
          onKind={setKind}
          scope={scope}
          onScope={setScope}
          sessions={sessions}
          onSessions={next => { setSessions(next); setSelected(selectedQuestions(next)); }}
          count={count}
          onContinue={(questions) => {
            setSelected(questions);
            setStep('settings');
          }}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'settings' ? <SubjectReview questions={selected} onEdit={back} /> : null}

      {step === 'settings' && kind === 'exam' ? (
        <ExamSettingsStep
          form={form}
          onForm={changeForm}
          titleDefault={titleDefault}
          standardDefault={standardDefault}
          institute={institute}
          subject={subject}
          questionTotal={selected.length}
          blocked={subjectBlock}
          stage={stage}
          error={pdfError}
          onGenerate={(style) => void makeExamPdf(style)}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'settings' && kind === 'smart' && subjectBlock ? <Notice tone="danger" title="Subjects needed" text={subjectBlock} live /> : null}

      {step === 'settings' && kind === 'smart' && !subjectBlock ? (
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
