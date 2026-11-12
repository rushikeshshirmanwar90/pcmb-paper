import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Illustration } from '@/design/illustrations';
import { NeoIconButton, NeoText } from '@/design/neo-kit';
import { StatusBar } from 'expo-status-bar';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  EmptyView,
  ErrorText,
  ErrorView,
  Icon,
  LoadingView,
  Muted,
  Notice,
  ProgressBar,
  SectionTitle,
  Segmented,
  StatGrid,
  StatTile,
  usePalette,
  type IconName,
} from '@/components/kit';
import { MaxContentWidth } from '@/constants/theme';
import { createAnswerSaver, type AnswerSaver, type SaveState } from '@/screens/student/answer-saver';
import { QuestionView } from '@/screens/student/question-view';
import {
  answerRows,
  basisText,
  filterRows,
  type AnswerOutcome,
  durationLabel,
  LEVEL_INFO,
  MIX_INFO,
  questionList,
  resultTree,
  secondsLeft,
  splitLabel,
  topicName,
} from '@/screens/student/self-assessment';
import { clock, percentOf, resultTone, spokenDuration, subjectIcon } from '@/screens/student/test-format';
import {
  studentApi,
  type AssessmentDetail,
  type AssessmentQuestion,
  type AssessmentReport,
  type AssessmentSummary,
  type StrengthTally,
  type TopicStrength,
} from '@/services/student-api';
import { face } from '@/design/type';
import { Neo } from '@/design/tokens';

/** Keeps a column readable on tablets: content stays phone-width, centred. */
export const column = { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' } as const;

/** A topic to practise or retake, from the result. */
export interface TopicPick {
  standard: string;
  chapter: string;
  topic: string;
}

/**
 * One self-assessment, inside the self-assessment screen: the start page, then
 * answering (with the timer when it has one), then the result topic by topic.
 * `backRef` gets what Android's back button should do.
 */
export function AssessmentSession({
  id,
  initial,
  backRef,
  onBack,
  onPractise,
  onRetake,
}: {
  id: string;
  /** Already loaded, e.g. just made. */
  initial?: AssessmentDetail;
  backRef: React.RefObject<(() => void) | null>;
  onBack: () => void;
  /** Opens the topic in the Practice tab. */
  onPractise: (subject: AssessmentSummary['subject'], topic: TopicPick) => void;
  /** Makes a new self-assessment of these topics. */
  onRetake: (subject: AssessmentSummary['subject'], topics: TopicPick[]) => void;
}) {
  const [detail, setDetail] = useState<AssessmentDetail | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    if (initial && round === 0) return;
    let cancelled = false;
    studentApi.assessment(id).then(
      // In progress: Start again just carries on and sends the questions.
      async (d) => {
        const next = d.assessment.state === 'in-progress' ? await studentApi.startAssessment(id) : d;
        if (!cancelled) setDetail(next);
      },
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't open the self-assessment.")
    );
    return () => {
      cancelled = true;
    };
  }, [id, round, initial]);

  // Back goes to the list, except while answering (the runner asks first).
  useEffect(() => {
    if (detail?.assessment.state === 'in-progress') return;
    backRef.current = onBack;
    return () => {
      backRef.current = null;
    };
  }, [detail?.assessment.state, backRef, onBack]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setDetail(await studentApi.startAssessment(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    confirmAction('Delete this self-assessment?', 'It goes from your list. Answers already counted as practice stay.', 'Delete', async () => {
      try {
        await studentApi.deleteAssessment(id);
        onBack();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete it.");
      }
    });

  if (!detail) {
    return error ? (
      <View style={styles.flex}>
        <SheetHeader title="Self-assessment" onBack={onBack} />
        <ErrorView message={error} onRetry={() => { setError(null); setRound((n) => n + 1); }} />
      </View>
    ) : (
      <View style={styles.flex}>
        <SheetHeader title="Self-assessment" onBack={onBack} />
        <LoadingView label="Opening…" />
      </View>
    );
  }

  const { assessment } = detail;
  if (assessment.state === 'ready') return <Intro assessment={assessment} busy={busy} error={error} onStart={start} onDelete={remove} onBack={onBack} />;
  if (assessment.state === 'in-progress') {
    return (
      <Runner
        detail={detail}
        backRef={backRef}
        onLeave={onBack}
        onSubmitted={(d) => {
          setJustSubmitted(true);
          setDetail(d);
        }}
      />
    );
  }
  return (
    <Result
      detail={detail}
      justSubmitted={justSubmitted}
      onBack={onBack}
      onDelete={remove}
      onPractise={(t) => onPractise(assessment.subject, t)}
      onRetake={(topics) => onRetake(assessment.subject, topics)}
    />
  );
}

// ─── Shared chrome ─────────────────────────────────────────────────────────

/** The page's header, like every other page: a square back button (or a round close), the title, any extras. */
export function SheetHeader({ title, onBack, onClose, trailing }: { title: string; onBack?: () => void; onClose?: () => void; trailing?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <StatusBar style="dark" />
      <View style={[styles.headerInner, column]}>
        {onBack ? <NeoIconButton icon={{ ios: 'chevron.left', android: 'arrow_back' }} label="Back" shape="square" onPress={onBack} /> : null}
        <NeoText variant="heading" accessibilityRole="header" numberOfLines={2} style={styles.headerTitle}>
          {title}
        </NeoText>
        {trailing}
        {onClose ? <NeoIconButton icon={{ ios: 'xmark', android: 'close' }} label="Close" onPress={onClose} /> : null}
      </View>
    </View>
  );
}

/** Actions pinned at the bottom of the page, on the page colour under a 2px rule. */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.footer, { borderTopColor: palette.ink, backgroundColor: palette.background }]}>
      <View style={[styles.footerInner, column]}>{children}</View>
    </View>
  );
}

/** A text-only button for secondary actions, with a full 44 pt target. */
export function QuietButton({ label, icon, onPress, disabled = false, tone = 'primary' }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'muted' | 'danger' }) {
  const palette = usePalette();
  const color = tone === 'primary' ? palette.primary : tone === 'danger' ? palette.danger : palette.mutedForeground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quiet, { opacity: disabled ? 0.45 : pressed ? 0.6 : 1 }]}
    >
      {icon ? <Icon name={icon} color={color} size={16} /> : null}
      <Text style={[styles.quietText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Right, wrong and skipped as one bar. The numbers always go with it, so colour is never the only cue. */
export function StrengthBar({ tally, height = 10 }: { tally: Pick<StrengthTally, 'correct' | 'wrong' | 'skipped' | 'total'>; height?: number }) {
  const palette = usePalette();
  const total = Math.max(1, tally.total);
  return (
    <View
      accessible
      accessibilityLabel={`${tally.correct} right, ${tally.wrong} wrong, ${tally.skipped} skipped`}
      style={[styles.bar, { height, borderRadius: height / 2, backgroundColor: palette.secondary }]}
    >
      {tally.correct ? <View style={{ flex: tally.correct / total, backgroundColor: palette.success }} /> : null}
      {tally.wrong ? <View style={{ flex: tally.wrong / total, backgroundColor: palette.danger }} /> : null}
      {tally.skipped ? <View style={{ flex: tally.skipped / total, backgroundColor: palette.borderStrong }} /> : null}
    </View>
  );
}

// ─── Before starting ───────────────────────────────────────────────────────

function Intro({
  assessment: a,
  busy,
  error,
  onStart,
  onDelete,
  onBack,
}: {
  assessment: AssessmentSummary;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const palette = usePalette();
  const short = a.questionCount < a.plan.requested;
  return (
    <View style={styles.flex}>
      <SheetHeader title="Ready to start" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.body, column]}>
        <View style={styles.hero}>
          <View style={[styles.heroTile, { backgroundColor: palette.primarySoft }]}>
            <Icon name={subjectIcon(a.subject)} color={palette.primary} size={24} />
          </View>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.heroTitle, { color: palette.foreground }]}>
              {a.title}
            </Text>
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>
              {a.subject} · {MIX_INFO[a.mix].label} mix
            </Text>
          </View>
        </View>

        <View style={styles.facts}>
          <Fact label="Questions" value={String(a.questionCount)} />
          <Fact label="Time" value={a.durationMinutes ? `${a.durationMinutes} min` : 'No limit'} />
          <Fact label="Total marks" value={String(a.maxScore)} />
          <Fact label="Each question" value={`+${a.marksPerQuestion}${a.negativeMarks ? ` / −${a.negativeMarks}` : ''}`} />
        </View>

        <Card style={styles.planCard}>
          <Text style={[styles.cardLabel, { color: palette.mutedForeground }]}>Difficulty</Text>
          <DifficultyBar split={a.plan} />
          <Text style={[styles.planLine, { color: palette.foreground }]}>{splitLabel(a.plan)}</Text>
          <Muted>{basisText(a.mix, a.basis)}</Muted>
          {a.plan.fresh ? <Muted>{a.plan.fresh === a.questionCount ? "You haven't answered any of these before." : `${a.plan.fresh} of these are new to you.`}</Muted> : null}
        </Card>
        {short ? <Notice tone="warning" title={`${a.questionCount} questions, not ${a.plan.requested}`} text="These topics don't have more past-year questions yet." /> : null}

        <SectionTitle title="Chapters" />
        <Card style={styles.listCard}>
          {a.scope.map((s, i) => (
            <View key={`${s.standard}|${s.chapter}`} style={[styles.scopeRow, i < a.scope.length - 1 && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }]}>
              <Text style={[styles.rowTitle, { color: palette.foreground }]}>{s.chapter}</Text>
              <Text style={[styles.meta, { color: palette.mutedForeground }]}>{s.topics.length ? s.topics.join(', ') : `Whole chapter · ${s.standard}`}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <Tip icon={{ ios: 'timer', android: 'timer' }} text={a.durationMinutes ? `The ${a.durationMinutes}-minute timer starts when you tap Start, and keeps running if you leave.` : 'No time limit: take as long as you need.'} />
          <Tip icon={{ ios: 'checkmark.icloud', android: 'cloud_done' }} text="Your answers save as you go." />
          <Tip icon={{ ios: 'chart.bar.xaxis', android: 'insights' }} text="After you submit, you'll see which topics you're strong and weak in, and by how much." />
        </Card>
        <QuietButton label="Delete" icon={{ ios: 'trash', android: 'delete' }} tone="danger" onPress={onDelete} />
      </ScrollView>
      <SheetFooter>
        <ErrorText message={error} />
        <Button label="Start" icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={onStart} loading={busy} />
      </SheetFooter>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.fact, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.factLabel, { color: palette.mutedForeground }]}>{label}</Text>
      <Text style={[styles.factValue, { color: palette.foreground }]}>{value}</Text>
    </View>
  );
}

function Tip({ icon, text }: { icon: IconName; text: string }) {
  const palette = usePalette();
  return (
    <View style={styles.tip}>
      <Icon name={icon} color={palette.primary} size={18} />
      <Text style={[styles.tipText, { color: palette.foreground }]}>{text}</Text>
    </View>
  );
}

/** Easy, medium and hard as one bar, with a legend. */
export function DifficultyBar({ split }: { split: { Easy: number; Medium: number; Hard: number } }) {
  const palette = usePalette();
  const total = Math.max(1, split.Easy + split.Medium + split.Hard);
  const parts = [
    { key: 'Easy', n: split.Easy, color: palette.success },
    { key: 'Medium', n: split.Medium, color: palette.warning },
    { key: 'Hard', n: split.Hard, color: palette.danger },
  ];
  return (
    <View style={styles.diffWrap}>
      <View accessible accessibilityLabel={`${split.Easy} easy, ${split.Medium} medium, ${split.Hard} hard`} style={[styles.bar, { height: 14, borderRadius: Neo.radius.full, borderWidth: Neo.border.width, borderColor: palette.ink, backgroundColor: palette.secondary }]}>
        {parts.map((p) => (p.n ? <View key={p.key} style={{ flex: p.n / total, backgroundColor: p.color }} /> : null))}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text style={[styles.legendText, { color: palette.mutedForeground }]}>
              {p.key} {p.n}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Answering ─────────────────────────────────────────────────────────────

function Runner({
  detail,
  backRef,
  onLeave,
  onSubmitted,
}: {
  detail: AssessmentDetail;
  backRef: React.RefObject<(() => void) | null>;
  onLeave: () => void;
  onSubmitted: (detail: AssessmentDetail) => void;
}) {
  const palette = usePalette();
  const { assessment: a, questions } = detail;
  const [answers, setAnswers] = useState<Map<number, string | null>>(() => new Map(detail.answers.map((x) => [x.index, x.selected])));
  const answersRef = useRef(answers);
  // Marked for review: a study aid kept on the phone only.
  const [marked, setMarked] = useState<Set<number>>(() => new Set());
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(() => secondsLeft(a.deadline));
  const [showGrid, setShowGrid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const submittedRef = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const saverRef = useRef<AnswerSaver | null>(null);
  // The latest callback, so the clock below isn't restarted on every render.
  const onSubmittedRef = useRef(onSubmitted);
  useEffect(() => {
    onSubmittedRef.current = onSubmitted;
  });

  useEffect(() => {
    const latest = answersRef;
    const saver = createAnswerSaver({
      save: (changed) => studentApi.saveAssessmentAnswers(a.id, changed),
      read: (index) => latest.current.get(index) ?? null,
      onState: setSaveState,
    });
    saverRef.current = saver;
    return () => {
      const rest = saver.unsent();
      saver.dispose();
      saverRef.current = null;
      if (rest.length && !submittedRef.current) studentApi.saveAssessmentAnswers(a.id, rest).catch(() => {});
    };
  }, [a.id]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    saverRef.current?.pause();
    setSubmitting(true);
    setError(null);
    AccessibilityInfo.announceForAccessibility('Submitting your answers');
    try {
      // Every answer goes with the submission, saved or not.
      const all = questions.map((q) => ({ index: q.index, selected: answersRef.current.get(q.index) ?? null }));
      onSubmittedRef.current(await studentApi.submitAssessment(a.id, all));
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof Error ? e.message : "Couldn't submit. Check your internet and try again.");
      saverRef.current?.resume();
    } finally {
      setSubmitting(false);
    }
  }, [a.id, questions]);

  // The clock (when there's a time limit): a warning at 1 minute; at zero it submits.
  const warned = useRef(false);
  useEffect(() => {
    if (a.deadline === null) return;
    const timer = setInterval(() => {
      const left = secondsLeft(a.deadline) ?? 0;
      setRemaining(left);
      if (left === 0) void submit();
      else if (left <= 60 && !warned.current) {
        warned.current = true;
        AccessibilityInfo.announceForAccessibility('1 minute left');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [a.deadline, submit]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [current]);

  const select = (value: string | null) => {
    const index = questions[current].index;
    answersRef.current = new Map(answersRef.current).set(index, value);
    setAnswers(answersRef.current);
    saverRef.current?.change(index);
  };
  const toggleMark = () => {
    const index = questions[current].index;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const isAnswered = (index: number) => (answers.get(index) ?? null) !== null;
  const answeredCount = questions.filter((q) => isAnswered(q.index)).length;

  const askSubmit = () => {
    const left = questions.length - answeredCount;
    const notes = [
      left ? `${left} question${left === 1 ? ' is' : 's are'} not answered.` : 'Every question is answered.',
      marked.size ? `${marked.size} marked for review.` : null,
      "You can't change answers after submitting.",
    ];
    confirmAction('Submit your answers?', notes.filter(Boolean).join(' '), 'Submit', () => void submit());
  };

  const askLeave = useCallback(() => {
    confirmAction(
      'Leave for now?',
      `Your answers are saved${saveState === 'saved' ? '' : ' as soon as they reach the server'}. ${a.deadline ? 'The timer keeps running; when it runs out, your saved answers are submitted.' : 'Carry on any time from the list.'}`,
      'Leave',
      async () => {
        await saverRef.current?.settle();
        onLeave();
      }
    );
  }, [saveState, a.deadline, onLeave]);

  useEffect(() => {
    backRef.current = askLeave;
    return () => {
      backRef.current = null;
    };
  }, [askLeave, backRef]);

  const q = questions[current];
  if (!q) {
    return (
      <View style={styles.flex}>
        <SheetHeader title={a.title} onBack={onLeave} />
        <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="No questions" text="This self-assessment has no questions." />
      </View>
    );
  }
  const last = current === questions.length - 1;
  const markedNow = marked.has(q.index);
  const timerColors =
    remaining === null ? null : remaining <= 60 ? [palette.dangerSoft, palette.dangerInk] : remaining <= 300 ? [palette.warningSoft, palette.warningInk] : [palette.secondary, palette.foreground];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <SheetHeader
        title={a.title}
        onBack={askLeave}
        trailing={
          remaining !== null && timerColors ? (
            <View accessible accessibilityRole="timer" accessibilityLabel={`Time left, ${spokenDuration(remaining)}`} style={[styles.timer, { backgroundColor: timerColors[0] }]}>
              <Icon name={{ ios: 'timer', android: 'timer' }} color={timerColors[1]} size={15} />
              <Text style={[styles.timerText, { color: timerColors[1] }]}>{clock(remaining)}</Text>
            </View>
          ) : null
        }
      />

      <View style={[styles.statusBar, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
        <View style={[styles.statusRow, column]}>
          <View style={styles.flex}>
            <Text style={[styles.position, { color: palette.foreground }]}>
              Question {current + 1} <Text style={{ color: palette.mutedForeground }}>of {questions.length}</Text>
            </Text>
            <SaveStatus state={saveState} onRetry={() => saverRef.current?.retryNow()} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showGrid }}
            accessibilityLabel={`All questions, ${answeredCount} of ${questions.length} answered`}
            onPress={() => setShowGrid((v) => !v)}
            style={({ pressed }) => [styles.gridToggle, { borderColor: palette.border, backgroundColor: showGrid ? palette.secondary : palette.card }, pressed && styles.pressed]}
          >
            <Icon name={{ ios: 'square.grid.3x3', android: 'apps' }} color={palette.foreground} size={16} />
            <Text style={[styles.gridToggleText, { color: palette.foreground }]}>
              {answeredCount}/{questions.length}
            </Text>
          </Pressable>
        </View>
        <View style={column}>
          <ProgressBar value={(answeredCount / questions.length) * 100} />
        </View>
      </View>

      {showGrid ? (
        <View style={[styles.gridPanel, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
          <ScrollView style={styles.gridScroll} contentContainerStyle={[styles.grid, column]} nestedScrollEnabled>
            {questions.map((x, i) => {
              const done = isAnswered(x.index);
              const here = i === current;
              const isMarked = marked.has(x.index);
              return (
                <Pressable
                  key={x.index}
                  accessibilityRole="button"
                  accessibilityLabel={`Question ${i + 1}, ${[done ? 'answered' : 'not answered', isMarked ? 'marked for review' : null, here ? 'current' : null].filter(Boolean).join(', ')}`}
                  onPress={() => {
                    setCurrent(i);
                    setShowGrid(false);
                  }}
                  style={({ pressed }) => [
                    styles.cell,
                    { backgroundColor: done ? palette.primarySoft : palette.card, borderColor: here ? palette.primary : done ? palette.primaryBorder : palette.borderStrong, borderWidth: here ? 2 : 1 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.cellText, { color: done ? palette.primaryInk : palette.foreground }]}>{i + 1}</Text>
                  {isMarked ? <View style={[styles.cellMark, { backgroundColor: palette.violet, borderColor: palette.card }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.body, column]} keyboardShouldPersistTaps="handled">
        <View style={styles.qMeta}>
          <Text style={[styles.qMetaText, { color: palette.foreground }]} numberOfLines={1}>
            Q{current + 1} · {q.chapter || q.subject}
          </Text>
          <Text style={[styles.qMarks, { color: palette.mutedForeground }]}>
            +{a.marksPerQuestion}
            {a.negativeMarks ? ` / −${a.negativeMarks}` : ''}
          </Text>
        </View>
        <QuestionView question={q} selected={answers.get(q.index) ?? null} onSelect={select} />
        <View style={styles.qTools}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: markedNow }}
            accessibilityLabel="Mark for review"
            onPress={toggleMark}
            style={({ pressed }) => [
              styles.markButton,
              { backgroundColor: markedNow ? palette.violetSoft : palette.card, borderColor: markedNow ? palette.violetBorder : palette.border },
              pressed && styles.pressed,
            ]}
          >
            <Icon name={markedNow ? { ios: 'bookmark.fill', android: 'bookmark' } : { ios: 'bookmark', android: 'bookmark_border' }} color={markedNow ? palette.violet : palette.foreground} size={16} />
            <Text style={[styles.markText, { color: markedNow ? palette.violet : palette.foreground }]}>{markedNow ? 'Marked for review' : 'Mark for review'}</Text>
          </Pressable>
          {isAnswered(q.index) ? <QuietButton label="Clear answer" icon={{ ios: 'xmark.circle', android: 'backspace' }} tone="muted" onPress={() => select(null)} /> : null}
        </View>
      </ScrollView>

      <SheetFooter>
        <ErrorText message={error} />
        {/* Only that it's on its way: the result shows once the server has marked it. */}
        {submitting ? (
          <View style={styles.submitting} accessible accessibilityLabel="Submitting your answers">
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.saveText, { color: palette.mutedForeground }]}>Submitting your answers…</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Button label="Previous" variant="secondary" icon={{ ios: 'chevron.left', android: 'chevron_left' }} onPress={() => setCurrent((i) => Math.max(0, i - 1))} disabled={current === 0} style={styles.flex} />
          {last ? (
            <Button label="Submit" icon={{ ios: 'paperplane.fill', android: 'send' }} onPress={askSubmit} loading={submitting} style={styles.flex} />
          ) : (
            <Button label="Next" onPress={() => setCurrent((i) => Math.min(questions.length - 1, i + 1))} style={styles.flex} />
          )}
        </View>
        {!last ? <QuietButton label="Submit now" onPress={askSubmit} disabled={submitting} /> : null}
      </SheetFooter>
    </KeyboardAvoidingView>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const palette = usePalette();
  if (state === 'error') {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Some answers aren't saved yet. Retry now" onPress={onRetry} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={styles.saveStatus}>
        <Icon name={{ ios: 'exclamationmark.icloud', android: 'cloud_off' }} color={palette.warningInk} size={14} />
        <Text style={[styles.saveText, { color: palette.warningInk, fontFamily: face.bold }]}>Not saved yet · Retry</Text>
      </Pressable>
    );
  }
  const saving = state !== 'saved';
  return (
    <View style={styles.saveStatus} accessible accessibilityLabel={saving ? 'Saving your answers' : 'All answers saved'}>
      <Icon name={saving ? { ios: 'arrow.triangle.2.circlepath', android: 'sync' } : { ios: 'checkmark.icloud', android: 'cloud_done' }} color={saving ? palette.mutedForeground : palette.success} size={14} />
      <Text style={[styles.saveText, { color: palette.mutedForeground }]}>{saving ? 'Saving…' : 'All answers saved'}</Text>
    </View>
  );
}

// ─── The result ────────────────────────────────────────────────────────────

type Filter = 'all' | 'wrong' | 'skipped';

function Result({
  detail,
  justSubmitted,
  onBack,
  onDelete,
  onPractise,
  onRetake,
}: {
  detail: AssessmentDetail;
  justSubmitted: boolean;
  onBack: () => void;
  onDelete: () => void;
  onPractise: (topic: TopicPick) => void;
  onRetake: (topics: TopicPick[]) => void;
}) {
  const palette = usePalette();
  const { assessment: a, questions, report } = detail;
  const [filter, setFilter] = useState<Filter>('all');
  const [topicFilter, setTopicFilter] = useState<TopicStrength | null>(null);
  // The report and the answers are two views of one result: the topics first, the answers a tap away.
  const [view, setView] = useState<'topics' | 'answers'>(report ? 'topics' : 'answers');
  const listRef = useRef<FlatList<ResultRow>>(null);
  const answersY = useRef(0);

  const answerOf = useMemo(() => new Map(detail.answers.map((x) => [x.index, x])), [detail.answers]);
  const rows = useMemo(() => answerRows(questions, detail.answers, topicFilter), [questions, detail.answers, topicFilter]);
  const shown = useMemo(() => filterRows(rows, filter), [rows, filter]);

  const seeQuestions = (t: TopicStrength) => {
    setTopicFilter(t);
    setFilter('all');
    setView('answers');
    // The answers heading's place in the header, plus the list's top padding.
    listRef.current?.scrollToOffset({ offset: answersY.current + styles.body.padding, animated: true });
  };

  // Only the cards on screen and nearby are mounted (each draws its maths as native views).
  const renderAnswer = useCallback(
    ({ item: { q, outcome } }: { item: ResultRow }) => {
      const answer = answerOf.get(q.index);
      return (
        <AnswerCard
          question={q}
          outcome={outcome}
          selected={answer?.selected ?? null}
          correct={answer?.correct ?? null}
          solutionOpen={filter !== 'all'}
          marksPerQuestion={a.marksPerQuestion}
          negativeMarks={a.negativeMarks}
        />
      );
    },
    [answerOf, filter, a.marksPerQuestion, a.negativeMarks]
  );

  const toPick = (t: TopicStrength): TopicPick => ({ standard: t.standard, chapter: t.chapter, topic: t.topic });
  const needWork = report ? report.topics.filter((t) => t.level !== 'strong') : [];

  const header = (
      <View style={styles.resultHeader}>
        {justSubmitted ? <Notice tone="success" title="Submitted" text="Here's how you did, topic by topic." live /> : null}
        <View>
          <Text accessibilityRole="header" style={[styles.reviewTitle, { color: palette.foreground }]}>
            {a.title}
          </Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>
            {a.subject} · {MIX_INFO[a.mix].label} mix · {splitLabel(a.plan)}
          </Text>
        </View>

        {a.result ? (
          <>
            <View style={styles.resultArt}>
              <Illustration name="assessmentResult" />
            </View>
            <ScoreCard assessment={a} />
          </>
        ) : null}

        {report ? (
          <>
            <Notice tone={report.overall.wrong + report.overall.skipped ? 'info' : 'success'} icon={{ ios: 'lightbulb', android: 'lightbulb' }} title={report.headline} />

            {/* The next step right under the score (peak-end): advice, then the two ways to act on it. */}
            <SectionTitle title="What to do next" />
            <Card style={styles.adviceCard}>
              {report.advice.map((line) => (
                <Tip key={line} icon={{ ios: 'arrow.right.circle', android: 'arrow_circle_right' }} text={line} />
              ))}
            </Card>
            {needWork.length ? (
              <View style={styles.actions}>
                <Button
                  label={`Retake my ${needWork.length === 1 ? 'weak topic' : `${needWork.length} weaker topics`}`}
                  icon={{ ios: 'arrow.counterclockwise', android: 'replay' }}
                  onPress={() => onRetake(needWork.map(toPick))}
                />
                <Button label={`Practise ${topicName(needWork[0])}`} variant="tonal" icon={{ ios: 'book', android: 'menu_book' }} onPress={() => onPractise(toPick(needWork[0]))} />
              </View>
            ) : null}
          </>
        ) : null}

        <View onLayout={(e) => (answersY.current = e.nativeEvent.layout.y)}>
          {report ? (
            <Segmented
              label="Result details"
              value={view}
              onChange={setView}
              options={[
                { value: 'topics', label: 'Topics' },
                { value: 'answers', label: 'Answers', count: rows.length },
              ]}
            />
          ) : (
            <SectionTitle title="Answers and solutions" />
          )}
        </View>

        {report && view === 'topics' ? (
          <>
            <StatGrid>
              <StatTile label="Strong topics" value={report.strongTopics} icon={{ ios: 'arrow.up.circle', android: 'trending_up' }} tone="success" />
              <StatTile label="Weak topics" value={report.weakTopics} icon={{ ios: 'arrow.down.circle', android: 'trending_down' }} tone="danger" />
              <StatTile label="Accuracy" value={report.overall.accuracy === null ? '–' : `${report.overall.accuracy}%`} icon={{ ios: 'target', android: 'my_location' }} tone={report.overall.accuracy === null ? 'neutral' : resultTone(report.overall.accuracy)} />
            </StatGrid>

            <SectionTitle title="Topic strength" />
            <Muted>Each topic&apos;s questions: how many you got right, wrong and skipped. Weakest topics are first.</Muted>
            {report.topics.map((t) => (
              <TopicCard
                key={`${t.standard}|${t.chapter}|${t.topic}`}
                topic={t}
                several={report.topics.length > 1}
                onPractise={() => onPractise(toPick(t))}
                onSee={() => seeQuestions(t)}
              />
            ))}

            {/* One chapter with no named topics would only repeat its one topic card. */}
            {report.chapters.length > 1 || report.topics.some((t) => t.topic) ? (
              <>
                <SectionTitle title="By chapter and topic" />
                <ChapterTree report={report} onSee={seeQuestions} />
              </>
            ) : null}

            <SectionTitle title="By difficulty" />
            <Card style={styles.listCard}>
              {report.difficulty.map((d, i) => (
                <BreakdownRow key={d.difficulty} title={d.difficulty} tally={d} last={i === report.difficulty.length - 1} />
              ))}
            </Card>
          </>
        ) : (
          <>
            {topicFilter ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Showing ${topicName(topicFilter)} only. Show every topic`}
                onPress={() => setTopicFilter(null)}
                style={({ pressed }) => [styles.filterChip, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }, pressed && styles.pressed]}
              >
                <Text style={[styles.filterChipText, { color: palette.primaryInk }]} numberOfLines={1}>
                  {topicName(topicFilter)} only
                </Text>
                <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.primaryInk} size={14} />
              </Pressable>
            ) : null}
            <Segmented
              label="Show answers"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: rows.length },
                { value: 'wrong', label: 'Wrong', count: rows.filter((r) => r.outcome === 'wrong').length },
                { value: 'skipped', label: 'Skipped', count: rows.filter((r) => r.outcome === 'skipped').length },
              ]}
            />
          </>
        )}
      </View>
  );

  return (
    <View style={styles.flex}>
      <SheetHeader title="Result" onBack={onBack} />
      {/* One list: the score and report are its header, the answer cards its items (virtualized). */}
      <FlatList
        ref={listRef}
        data={view === 'answers' ? shown : []}
        // The filter is in the key: another filter remounts the cards, so solutions start open or closed for it.
        keyExtractor={(r) => `${filter}-${r.q.index}`}
        renderItem={renderAnswer}
        ListHeaderComponent={header}
        ListEmptyComponent={
          view !== 'answers' ? undefined : (
          <Card>
            <EmptyView
              icon={{ ios: 'checkmark.seal', android: 'verified' }}
              title={filter === 'wrong' ? 'No wrong answers' : 'Nothing skipped'}
              text={filter === 'wrong' ? 'Every question you answered here was right.' : 'You answered every question here.'}
            />
          </Card>
          )
        }
        ListFooterComponent={<QuietButton label="Delete this self-assessment" icon={{ ios: 'trash', android: 'delete' }} tone="danger" onPress={onDelete} />}
        initialNumToRender={RESULT_CARDS.initial}
        maxToRenderPerBatch={RESULT_CARDS.batch}
        windowSize={RESULT_CARDS.window}
        contentContainerStyle={[styles.body, column]}
      />
      <SheetFooter>
        <Button label="Done" onPress={onBack} />
      </SheetFooter>
    </View>
  );
}

type ResultRow = { q: AssessmentQuestion; outcome: AnswerOutcome };

/** Answer cards mounted at first, added per batch, and kept around the screen (in screen heights). */
const RESULT_CARDS = { initial: 3, batch: 4, window: 5 } as const;

/**
 * One question of the result with the student's answer and the solution.
 * Memoised: a card redraws only when its own answer or the filter changes.
 */
const AnswerCard = React.memo(function AnswerCard({
  question: q,
  outcome: o,
  selected,
  correct,
  solutionOpen,
  marksPerQuestion,
  negativeMarks,
}: {
  question: AssessmentQuestion;
  outcome: AnswerOutcome;
  selected: string | null;
  correct: boolean | null;
  solutionOpen: boolean;
  marksPerQuestion: number;
  negativeMarks: number;
}) {
  const palette = usePalette();
  return (
    <Card style={styles.answerCard}>
      <View style={styles.answerTop}>
        {/* Two lines, so a long topic isn't cut short by the badges beside it. */}
        <Text style={[styles.qMetaText, { color: palette.foreground }]} numberOfLines={2}>
          Q{q.index + 1} · {q.topic || q.chapter}
        </Text>
        {q.difficulty ? <Badge label={q.difficulty} tone="neutral" /> : null}
        {o === 'right' ? (
          <Badge label={`Right · +${marksPerQuestion}`} tone="success" />
        ) : o === 'wrong' ? (
          <Badge label={`Wrong · ${negativeMarks ? `−${negativeMarks}` : '0'}`} tone="danger" />
        ) : (
          <Badge label="Skipped · 0" />
        )}
      </View>
      <QuestionView question={q} selected={selected} reveal solutionOpen={solutionOpen} answerCorrect={correct} />
    </Card>
  );
});

function ScoreCard({ assessment: a }: { assessment: AssessmentSummary }) {
  const palette = usePalette();
  const r = a.result!;
  const percent = percentOf(r.score, r.maxScore);
  const minutes = Math.max(1, Math.round(r.timeTakenSeconds / 60));
  return (
    <Card style={styles.scoreCard}>
      <Text style={[styles.cardLabel, { color: palette.mutedForeground }]}>Your score</Text>
      <View style={styles.scoreRow} accessible accessibilityLabel={`Score ${r.score} out of ${r.maxScore}, ${percent} percent`}>
        <Text style={[styles.scoreBig, { color: palette.foreground }]}>
          {r.score}
          <Text style={[styles.scoreOf, { color: palette.mutedForeground }]}> / {r.maxScore}</Text>
        </Text>
        <Badge label={`${percent}%`} tone={resultTone(percent)} />
      </View>
      <StrengthBar tally={{ correct: r.correct, wrong: r.wrong, skipped: r.skipped, total: r.correct + r.wrong + r.skipped }} />
      <Text style={[styles.meta, { color: palette.mutedForeground }]}>
        {r.correct} right · {r.wrong} wrong · {r.skipped} skipped
      </Text>
      <View style={[styles.divider, { backgroundColor: palette.border }]} />
      <DetailRow label="Marks" value={`+${r.correct * a.marksPerQuestion} for right${a.negativeMarks ? `, −${r.wrong * a.negativeMarks} for wrong` : ''}`} />
      <DetailRow label="Time taken" value={a.durationMinutes ? `${minutes} of ${a.durationMinutes} min` : `${minutes} min`} />
      <DetailRow label="Time limit" value={durationLabel(a.durationMinutes)} />
    </Card>
  );
}

/** One topic's questions (right, wrong, skipped), with where its marks went and what to do. */
function TopicCard({ topic: t, several, onPractise, onSee }: { topic: TopicStrength; several: boolean; onPractise: () => void; onSee: () => void }) {
  const palette = usePalette();
  const info = LEVEL_INFO[t.level];
  const percents = [
    `${t.strength}% strong`,
    `${t.weakness}% weak`,
    several && t.shareOfMistakes ? `${t.shareOfMistakes}% of marks lost` : null,
    t.accuracy !== null && t.skipped ? `${t.accuracy}% right when answered` : null,
  ];
  return (
    <Card style={styles.topicCard}>
      <View style={styles.topicTop}>
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, { color: palette.foreground }]}>{topicName(t)}</Text>
          {t.topic ? <Text style={[styles.meta, { color: palette.mutedForeground }]}>{t.chapter} · {t.standard}</Text> : <Text style={[styles.meta, { color: palette.mutedForeground }]}>{t.standard}</Text>}
        </View>
        <Badge label={info.label} tone={info.tone} />
      </View>

      <View style={styles.countRow} accessible accessibilityLabel={countsLabel(t)}>
        <CountFigure value={t.total} label={t.total === 1 ? 'Question' : 'Questions'} color={palette.foreground} />
        <CountFigure value={t.correct} label="Correct" color={palette.successInk} />
        <CountFigure value={t.wrong} label="Wrong" color={palette.dangerInk} />
        {t.skipped ? <CountFigure value={t.skipped} label="Skipped" color={palette.mutedForeground} /> : null}
      </View>
      <StrengthBar tally={t} />
      <Text style={[styles.meta, { color: palette.mutedForeground }]}>{percents.filter(Boolean).join(' · ')}</Text>
      {t.wrongNumbers.length ? <Text style={[styles.detailText, { color: palette.dangerInk }]}>Went wrong: {questionList(t.wrongNumbers)}</Text> : null}
      {t.skippedNumbers.length ? <Text style={[styles.detailText, { color: palette.mutedForeground }]}>Skipped: {questionList(t.skippedNumbers)}</Text> : null}
      {t.fewQuestions ? <Muted>Only 1 question here, so this is a rough guide.</Muted> : null}
      <View style={styles.topicActions}>
        {t.wrong + t.skipped ? <QuietButton label="See its questions" icon={{ ios: 'list.bullet', android: 'list' }} onPress={onSee} /> : null}
        {t.level !== 'strong' ? <QuietButton label="Practise" icon={{ ios: 'book', android: 'menu_book' }} onPress={onPractise} /> : null}
      </View>
    </Card>
  );
}

/** "5 questions: 3 correct, 1 wrong, 1 skipped", for screen readers. */
const countsLabel = (t: StrengthTally) =>
  `${t.total} question${t.total === 1 ? '' : 's'}: ${t.correct} correct, ${t.wrong} wrong${t.skipped ? `, ${t.skipped} skipped` : ''}`;

function CountFigure({ value, label, color }: { value: number; label: string; color: string }) {
  const palette = usePalette();
  return (
    <View style={styles.countCol}>
      <Text style={[styles.countBig, { color }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: palette.mutedForeground }]}>{label}</Text>
    </View>
  );
}

/** "5 questions · 3 correct · 1 wrong · 1 skipped" on one line, the counts in their colours. */
function CountLine({ tally: t }: { tally: StrengthTally }) {
  const palette = usePalette();
  return (
    <Text accessibilityLabel={countsLabel(t)} style={[styles.countLine, { color: palette.mutedForeground }]}>
      {t.total} question{t.total === 1 ? '' : 's'} · <Text style={[styles.countStrong, { color: palette.successInk }]}>{t.correct} correct</Text> ·{' '}
      <Text style={[styles.countStrong, { color: palette.dangerInk }]}>{t.wrong} wrong</Text>
      {t.skipped ? ` · ${t.skipped} skipped` : ''}
    </Text>
  );
}

/**
 * The result as a tree: each chapter with its questions, and its topics
 * branching under it with theirs. A chapter with no named topics has no branches.
 */
function ChapterTree({ report, onSee }: { report: AssessmentReport; onSee: (t: TopicStrength) => void }) {
  const palette = usePalette();
  const tree = resultTree(report.chapters, report.topics);
  return (
    <Card style={styles.listCard}>
      {tree.map(({ chapter: c, topics }, i) => {
        const branches = topics.some((t) => t.topic) ? topics : [];
        return (
          <View
            key={`${c.standard}|${c.chapter}`}
            style={[styles.treeChapter, i < tree.length - 1 && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }]}
          >
            <View style={styles.topicTop}>
              <View style={styles.treeIcon}>
                <Icon name={{ ios: 'book.closed', android: 'menu_book' }} color={palette.primary} size={18} />
              </View>
              <View style={styles.flex}>
                <Text accessibilityRole="header" style={[styles.rowTitle, { color: palette.foreground }]}>
                  {c.chapter}
                </Text>
                <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                  {c.standard}
                  {branches.length ? ` · ${branches.length} topic${branches.length === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
              <Badge label={`${c.strength}%`} tone={LEVEL_INFO[c.level].tone} />
            </View>
            <View style={styles.treeIndent}>
              <CountLine tally={c} />
            </View>
            {branches.length ? (
              <View>
                {branches.map((t, j) => (
                  <TreeBranch
                    key={t.topic}
                    last={j === branches.length - 1}
                    accessibilityLabel={`${t.topic || 'Not tagged to a topic'}: ${countsLabel(t)}, ${t.strength}% strength. See its questions`}
                    onPress={() => onSee(t)}
                  >
                    <View style={styles.topicTop}>
                      <Text style={[styles.branchTitle, styles.flex, { color: t.topic ? palette.foreground : palette.mutedForeground }]}>
                        {t.topic || 'Not tagged to a topic'}
                      </Text>
                      <Badge label={`${t.strength}%`} tone={LEVEL_INFO[t.level].tone} />
                    </View>
                    <CountLine tally={t} />
                  </TreeBranch>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

/** A topic under its chapter: a line down from the chapter, and a tick across to the topic. */
function TreeBranch({ last, children, accessibilityLabel, onPress }: { last: boolean; children: React.ReactNode; accessibilityLabel: string; onPress: () => void }) {
  const palette = usePalette();
  const line = { backgroundColor: palette.borderStrong };
  // A topic opens its questions in the answers below, like "See its questions" on its card.
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.branch, pressed && styles.pressed]}>
      <View style={styles.branchGutter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.branchStem, last ? styles.branchStemLast : styles.branchStemFull, line]} />
        <View style={[styles.branchTick, line]} />
      </View>
      <View style={[styles.flex, styles.branchBody]}>{children}</View>
      <View style={styles.branchChevron}>
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={14} />
      </View>
    </Pressable>
  );
}

function BreakdownRow({ title, tally, last }: { title: string; tally: StrengthTally; last: boolean }) {
  const palette = usePalette();
  return (
    <View style={[styles.breakdown, !last && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }]}>
      <View style={styles.topicTop}>
        <Text style={[styles.rowTitle, styles.flex, { color: palette.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.breakdownValue, { color: palette.foreground }]}>
          {tally.correct}/{tally.total}
        </Text>
        <Badge label={`${tally.strength}%`} tone={LEVEL_INFO[tally.level].tone} />
      </View>
      <StrengthBar tally={tally} height={8} />
    </View>
  );
}

const styles = StyleSheet.create({
  resultArt: { alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 10 },
  pressed: { opacity: 0.7 },

  header: {},
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, minHeight: 64 },
  headerTitle: { flex: 1, minWidth: 0 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  quiet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, alignSelf: 'center' },
  quietText: { fontSize: 15, fontFamily: face.bold },
  footer: { borderTopWidth: Neo.border.width },
  footerInner: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8 },
  body: { padding: 16, gap: 16, paddingBottom: 32 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroTile: { width: 52, height: 52, borderRadius: Neo.radius.lg, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, lineHeight: 28, fontFamily: face.heavy },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexGrow: 1, flexBasis: '45%', borderWidth: Neo.border.width, borderRadius: Neo.radius.md, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  factLabel: { fontSize: 12, fontFamily: face.semibold },
  factValue: { fontSize: 20, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  planCard: { gap: 10, padding: 16 },
  planLine: { fontSize: 15, fontFamily: face.bold },
  cardLabel: { fontSize: 13, fontFamily: face.semibold },
  listCard: { paddingVertical: 0 },
  scopeRow: { paddingVertical: 12 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: face.bold },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 2 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20 },

  bar: { flexDirection: 'row', overflow: 'hidden' },
  diffWrap: { gap: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  swatch: { width: 12, height: 12, borderRadius: Neo.radius.xs },

  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: Neo.radius.full, marginRight: 4 },
  timerText: { fontSize: 16, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  statusBar: { borderBottomWidth: Neo.border.width, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  position: { fontSize: 15, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, alignSelf: 'flex-start' },
  saveText: { fontSize: 12, lineHeight: 16 },
  resultHeader: { gap: 14 },
  submitting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 24 },
  gridToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: Neo.radius.md, borderWidth: Neo.border.width },
  gridToggleText: { fontSize: 14, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  gridPanel: { borderBottomWidth: Neo.border.width, paddingHorizontal: 16, paddingVertical: 12 },
  gridScroll: { maxHeight: 232 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4, paddingRight: 4 },
  cell: { width: 44, height: 44, borderRadius: Neo.radius.md, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 15, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  cellMark: { position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, borderWidth: Neo.border.width },

  qMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  qMetaText: { flex: 1, fontSize: 13, fontFamily: face.heavy, letterSpacing: 0.3 },
  qMarks: { fontSize: 13, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  qTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  markButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: Neo.radius.full, borderWidth: Neo.border.width },
  markText: { fontSize: 14, fontFamily: face.bold },

  reviewTitle: { fontSize: 20, lineHeight: 26, fontFamily: face.heavy },
  scoreCard: { gap: 12, padding: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -6 },
  scoreBig: { fontSize: 44, lineHeight: 52, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 20, fontFamily: face.semibold },
  divider: { height: Neo.border.width },

  topicCard: { gap: 10, padding: 16 },
  topicTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countRow: { flexDirection: 'row', gap: 8 },
  countCol: { flex: 1, minWidth: 0 },
  countBig: { fontSize: 26, lineHeight: 32, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 12, fontFamily: face.semibold },
  countLine: { fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  countStrong: { fontFamily: face.bold },
  treeChapter: { paddingVertical: 12, gap: 4 },
  treeIcon: { width: 20, alignItems: 'center' },
  // Lines the chapter's counts up with its name, past the icon.
  treeIndent: { paddingLeft: 30 },
  branch: { flexDirection: 'row' },
  // The stem runs down from the middle of the chapter's icon.
  branchGutter: { width: 30, marginLeft: 9 },
  branchStem: { position: 'absolute', left: 0, top: 0, width: 1.5 },
  branchStemFull: { bottom: 0 },
  // The last branch's stem stops at its tick: the corner of an "L".
  branchStemLast: { height: 21 },
  branchTick: { position: 'absolute', left: 0, top: 20, width: 14, height: 1.5 },
  branchBody: { paddingTop: 10, paddingBottom: 4, gap: 2, marginLeft: -9 },
  branchTitle: { fontSize: 14, lineHeight: 20, fontFamily: face.semibold },
  // In line with the topic's name.
  branchChevron: { paddingTop: 13, paddingLeft: 6 },
  detailText: { fontSize: 13, lineHeight: 18, fontFamily: face.semibold },
  topicActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: -8, marginLeft: -12 },
  breakdown: { paddingVertical: 12, gap: 8 },
  breakdownValue: { fontSize: 14, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  adviceCard: { gap: 10 },
  actions: { gap: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: Neo.radius.full, borderWidth: Neo.border.width, maxWidth: '100%' },
  filterChipText: { fontSize: 14, fontFamily: face.bold, flexShrink: 1 },
  answerCard: { gap: 12 },
  answerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
