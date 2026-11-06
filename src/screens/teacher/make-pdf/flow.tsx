import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { Button, Muted, usePalette } from '@/components/kit';
import { confirmAction } from '@/components/confirm-action';
import { KeyboardSafeView } from '@/components/keyboard-safe-view';
import { SmartPdfScreen } from '@/components/smart-pdf-screen';
import { useAuth } from '@/context/auth-context';
import { useKeepServerConnection } from '@/hooks/use-keep-server-connection';
import { ApiError } from '@/services/api-client';
import { loadPaperStyle, savePaperStyle } from '@/services/paper-style-prefs';
import { usedQuestionIds, type SavedPdf } from '@/services/pdf-library';
import { pickQuestions } from '@/services/pdf-questions';
import { loadPdfWatermark, savePdfWatermark } from '@/services/pdf-watermark-prefs';
import { createPdfsFor, PdfRequestError, type PdfStage } from '@/services/question-pdf';
import { DEFAULT_PAPER_STYLE, type PaperStyle } from '@/shared/paper-style';
import { EXAMS, isExamId, sourceMatchesExam } from '@/shared/exam-bank';
import { cleanWatermark } from '@/shared/watermark';
import { DoneStep } from '@/screens/teacher/make-pdf/done-step';
import { DEFAULT_DURATION_MINUTES, dayKey, ExamSettingsStep, startOfToday, type ExamForm } from '@/screens/teacher/make-pdf/exam-settings';
import { ManualPicker, type PickMode } from '@/screens/teacher/make-pdf/manual-picker';
import { MethodStep } from '@/screens/teacher/make-pdf/method-step';
import {
  addQuestions,
  autoBody,
  chaptersOf,
  DEFAULT_AUTO,
  editQuestion,
  EMPTY_SCOPE,
  hasWork,
  keepMatching,
  MARKS_PER_QUESTION,
  moveQuestion,
  questionCount,
  removeQuestion,
  replaceQuestion,
  scopeReady,
  scopeSummary,
  shortfallMessage,
  standardsOf,
  titleFromNames,
  type AutoConfig,
  type Method,
  type PdfKind,
  type Scope,
} from '@/screens/teacher/make-pdf/model';
import { ReviewStep } from '@/screens/teacher/make-pdf/review-step';
import { ScopeStep } from '@/screens/teacher/make-pdf/scope-step';
import { ChoiceCard, StepHeader, StepLayout } from '@/screens/teacher/make-pdf/ui';
import { useScopeOptions } from '@/screens/teacher/make-pdf/use-scope-options';
import type { Question } from '@/types/pcmb';

type Step = 'type' | 'scope' | 'method' | 'pick' | 'review' | 'settings' | 'done';

const STEP_COUNT = 5;
const STEP_INFO: Record<Step, { index: number; title: string }> = {
  type: { index: 0, title: 'Make a PDF' },
  scope: { index: 1, title: 'Exam and chapters' },
  method: { index: 2, title: 'Choose questions' },
  pick: { index: 3, title: 'Pick questions' },
  review: { index: 3, title: 'Review questions' },
  settings: { index: 4, title: 'PDF settings' },
  done: { index: 4, title: 'PDF ready' },
};

const KIND_LABEL: Record<PdfKind, string> = { exam: 'Exam PDF', smart: 'Smart PDF' };

/** The most previous questions sent to leave out (the server's limit); the newest PDFs' come first. */
const MAX_LEFT_OUT = 1000;

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

type Message = { tone: 'warning' | 'info' | 'success'; text: string };

/**
 * Make PDF, for teachers: choose Exam PDF or Smart PDF, then the exam,
 * subject and chapters, then automatic or manual question selection, review
 * the questions, set the PDF's options and generate it. Both kinds share every
 * step but the last settings. Going back keeps what was chosen; the exam,
 * subject and chapters decide which questions may stay selected (model.ts).
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
  const palette = usePalette();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const institute = user?.tuition?.name ?? '';

  const [step, setStep] = useState<Step>('type');
  const [kind, setKind] = useState<PdfKind | null>(null);
  const [scope, setScope] = useState<Scope>(EMPTY_SCOPE);
  const [method, setMethod] = useState<Method | null>(null);
  const [auto, setAuto] = useState<AutoConfig>(DEFAULT_AUTO);
  const [selected, setSelected] = useState<Question[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [pick, setPick] = useState<{ mode: PickMode; back: Step }>({ mode: { type: 'add' }, back: 'method' });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [form, setForm] = useState<ExamForm>(newExamForm);
  const [stage, setStage] = useState<{ stage: PdfStage; count: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [made, setMade] = useState<{ pdfs: SavedPdf[]; questions: Question[] } | null>(null);

  // The form leads to requests; keep the connection fresh while it is filled in.
  useKeepServerConnection(active && (step === 'scope' || step === 'method' || step === 'settings'));

  const scopeLoad = useScopeOptions(scope.exam, scope.subject);
  const examLabel = isExamId(scope.exam) ? EXAMS[scope.exam].label : '';

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

  const busy = generating || stage !== null;
  // Reading the kept questions of every PDF is slow enough to do once, only when asked for.
  const usedCount = useMemo(() => (step === 'method' && auto.avoidUsed ? usedQuestionIds().length : 0), [step, auto.avoidUsed]);

  // ─── Choices that reach the questions ────────────────────────────────────

  const changeScope = (next: Scope) => {
    setScope(next);
    setGenError(null);
    if (selected.length === 0) return;
    // Questions that no longer belong to the exam, subject or chapters leave the selection.
    const { kept, dropped } = keepMatching(selected, next, (question) => isExamId(next.exam) && sourceMatchesExam(question.source, next.exam));
    if (dropped > 0) {
      setSelected(kept);
      setMessage({
        tone: 'warning',
        text: `${questionCount(dropped)} no longer matched the exam, subject or chapters you chose, so ${dropped === 1 ? 'it was' : 'they were'} taken out.`,
      });
    }
  };

  const generate = () => {
    if (!scopeReady(scope)) return;
    const run = async () => {
      setGenerating(true);
      setGenError(null);
      try {
        // Leave out what earlier PDFs on this phone already used, if asked.
        const exclude = auto.avoidUsed ? usedQuestionIds().slice(0, MAX_LEFT_OUT) : [];
        const result = await pickQuestions(scope.exam, autoBody(scope, auto, exclude));
        if (result.found === 0) {
          setGenError(shortfallMessage(result) ?? 'No questions were found for these choices.');
          return;
        }
        setSelected(result.questions);
        const shortfall = shortfallMessage(result);
        setMessage(
          shortfall
            ? { tone: 'warning', text: shortfall }
            : { tone: 'success', text: `${questionCount(result.found)} chosen at random from ${examLabel} ${scope.subject}. Review them, or swap any you don't want.` }
        );
        setStep('review');
      } catch (error) {
        setGenError(error instanceof ApiError || error instanceof Error ? error.message : 'Could not choose questions. Try again.');
      } finally {
        setGenerating(false);
      }
    };
    if (selected.length > 0) {
      confirmAction('Replace your questions?', `This replaces the ${questionCount(selected.length)} you have chosen.`, 'Replace', () => void run());
    } else {
      void run();
    }
  };

  // ─── Choosing and changing the selection ─────────────────────────────────

  const openPicker = (mode: PickMode, back: Step) => {
    setPick({ mode, back });
    setStep('pick');
  };

  const toggleQuestion = (question: Question) => {
    setSelected((current) =>
      current.some((item) => item._id === question._id) ? removeQuestion(current, question._id) : addQuestions(current, [question]).list
    );
    setMessage(null);
  };

  const replaceWith = (question: Question) => {
    if (pick.mode.type !== 'replace') return;
    const next = replaceQuestion(selected, pick.mode.question._id, question);
    if (!next) {
      setMessage({ tone: 'warning', text: 'That question is already in your paper.' });
    } else {
      setSelected(next);
      setMessage({ tone: 'success', text: 'Question replaced. It kept its place in the order.' });
    }
    setStep('review');
  };

  // ─── Making the PDF ──────────────────────────────────────────────────────

  const chapters = scope.topics.length ? scope.topics : scope.chapters.length ? scope.chapters : chaptersOf(selected);
  const titleDefault = titleFromNames(chapters) || [examLabel, scope.subject].filter(Boolean).join(' ');
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
          marksPerQuestion: MARKS_PER_QUESTION,
          standard: (form.standard ?? standardDefault).trim() || undefined,
          subject: scope.subject,
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

  // ─── Moving between steps ────────────────────────────────────────────────

  const reset = () => {
    setStep('type');
    setKind(null);
    setScope(EMPTY_SCOPE);
    setMethod(null);
    setAuto(DEFAULT_AUTO);
    setSelected([]);
    setMessage(null);
    setGenError(null);
    setPdfError(null);
    setMade(null);
    setForm((current) => ({ ...newExamForm(), style: current.style, watermark: current.watermark }));
  };

  const startOver = () => {
    if (busy) return;
    if (hasWork(kind, scope, selected)) {
      confirmAction('Start over?', 'Your exam, chapters and chosen questions will be cleared.', 'Start over', reset);
    } else {
      reset();
    }
  };

  const back = () => {
    if (busy) return;
    setGenError(null);
    setPdfError(null);
    switch (step) {
      case 'scope':
        return setStep('type');
      case 'method':
        return setStep('scope');
      case 'pick':
        return setStep(pick.back);
      case 'review':
        // Back to wherever the questions were chosen: the list, for a hand-picked paper.
        return method === 'manual' ? openPicker({ type: 'add' }, 'method') : setStep('method');
      case 'settings':
        return setStep('review');
      case 'done':
        return reset();
      default:
    }
  };

  // Android's Back button steps back through the flow (keeping what was chosen) instead of leaving the app.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    if (!active || step === 'type') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [active, step]);

  const info = STEP_INFO[step];
  const subtitle = step === 'type' ? undefined : scopeReady(scope) ? scopeSummary(scope, examLabel) : kind ? KIND_LABEL[kind] : undefined;

  return (
    <KeyboardSafeView>
      <StepHeader
        title={info.title}
        subtitle={subtitle}
        step={info.index}
        steps={STEP_COUNT}
        onBack={step === 'type' || step === 'done' ? undefined : back}
        onReset={step !== 'type' && step !== 'done' && !busy ? startOver : undefined}
      />

      {step === 'type' ? (
        <StepLayout
          inset={bottomInset}
          footer={
            <>
              <Button label="Next: choose exam and chapters" icon={{ ios: 'arrow.right', android: 'arrow_forward' }} disabled={!kind} onPress={() => setStep('scope')} />
              {!kind ? <Muted>Choose the kind of PDF to continue.</Muted> : null}
            </>
          }
        >
          <Text accessibilityRole="header" style={{ color: palette.foreground, fontSize: 20, fontWeight: '800' }}>
            What would you like to make?
          </Text>
          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            <ChoiceCard
              icon={{ ios: 'doc.text', android: 'description' }}
              title="Exam PDF"
              text="Printable Question Paper"
              selected={kind === 'exam'}
              onPress={() => setKind('exam')}
            />
            <ChoiceCard
              icon={{ ios: 'rectangle.on.rectangle', android: 'slideshow' }}
              title="Smart PDF"
              text="Digital Classroom Presentation"
              selected={kind === 'smart'}
              onPress={() => setKind('smart')}
            />
          </View>
          <Muted>Both use the same steps to choose questions. Only the final settings differ.</Muted>
        </StepLayout>
      ) : null}

      {step === 'scope' ? <ScopeStep scope={scope} load={scopeLoad} onScope={changeScope} onNext={() => setStep('method')} bottomInset={bottomInset} /> : null}

      {step === 'method' ? (
        <MethodStep
          method={method}
          onMethod={(next) => {
            setMethod(next);
            setGenError(null);
          }}
          auto={auto}
          onAuto={setAuto}
          usedCount={usedCount}
          generating={generating}
          error={genError}
          onGenerate={generate}
          onBrowse={() => openPicker({ type: 'add' }, 'method')}
          hasSelection={selected.length > 0}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'pick' ? (
        <ManualPicker
          scope={scope}
          chapters={scopeLoad.status === 'ready' ? scopeLoad.data.ordered : []}
          selected={selected}
          mode={pick.mode}
          onToggle={toggleQuestion}
          onReplace={replaceWith}
          onDone={() => setStep(pick.mode.type === 'replace' ? 'review' : selected.length > 0 ? 'review' : pick.back)}
          bottomInset={bottomInset}
        />
      ) : null}

      {step === 'review' ? (
        <ReviewStep
          selected={selected}
          message={message}
          kindLabel={kind ? KIND_LABEL[kind] : 'PDF'}
          onMove={(from, to) => setSelected((current) => moveQuestion(current, from, to))}
          onRemove={(id) => {
            setSelected((current) => removeQuestion(current, id));
            setMessage(null);
          }}
          onReplace={(question) => openPicker({ type: 'replace', question }, 'review')}
          onEdit={(edited) => setSelected((current) => editQuestion(current, edited))}
          onAdd={() => openPicker({ type: 'add' }, 'review')}
          onNext={() => {
            setMessage(null);
            setStep('settings');
          }}
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
          subject={scope.subject}
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
          subject={scope.subject}
          bottomInset={bottomInset}
          onMade={(pdf) => {
            setMade({ pdfs: [pdf], questions: selected });
            setStep('done');
          }}
        />
      ) : null}

      {step === 'done' && made && kind ? (
        <DoneStep
          made={made}
          kind={kind}
          standard={standardDefault}
          subject={scope.subject}
          onViewPdfs={onViewPdfs}
          onAnother={reset}
          bottomInset={bottomInset}
        />
      ) : null}
    </KeyboardSafeView>
  );
}
