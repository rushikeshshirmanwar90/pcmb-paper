import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailRow,
  EmptyView,
  ErrorText,
  ErrorView,
  Icon,
  LoadingView,
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
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion } from '@/context/data-version';
import { AWAY_LIMIT_MS, backAction, cellStatus, createAwayTracker, examCounts, type MultiWindowReading, secondsLeft, skewOf, type CellStatus } from '@/screens/student/exam-guard';
import { useExamSecurity, useMultiWindow } from '@/screens/student/exam-security';
import { createAnswerSaver, type AnswerSaver, type SaveState } from '@/screens/student/answer-saver';
import { RESULT_SECTIONS, numberLabel, percentLabel, resultFigures, type ResultSection } from '@/screens/shared/result-format';

import { TopicPerformanceList, WeakTopicsSection } from '@/screens/shared/topic-performance';
import { QuestionView } from '@/screens/student/question-view';
import { clock, resultTone, spokenDuration, subjectIcon, whenLabel } from '@/screens/student/test-format';
import type { TestSummary } from '@/services/school-api';
import { clearDraft, loadDraft, saveDraft } from '@/services/attempt-store';
import { studentApi, type Attempt, type TestAnalytics, type TestQuestion } from '@/services/student-api';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro'; test: TestSummary }
  | { kind: 'running'; test: TestSummary; attempt: Attempt; questions: TestQuestion[] }
  | { kind: 'review'; test: TestSummary; attempt: Attempt | null; questions: TestQuestion[]; analytics?: TestAnalytics | null; justSubmitted: boolean };

const SCREEN_KEY = 'secure-exam';
const SECTION_KEYS = RESULT_SECTIONS.map((s) => s.value);
const SECTION_LABELS = Object.fromEntries(RESULT_SECTIONS.map((s) => [s.value, s.label]));

/**
 * Screenshots and screen recording are blocked while a test is being taken,
 * and only then. Android's Modal copies the window's secure flag when it is
 * created, so the Modal is only drawn once the flag is on (or off again, for
 * the results), and is rebuilt when that changes. Resolves to null until the
 * first change has settled.
 */
function useScreenProtection(on: boolean): boolean | null {
  const [settled, setSettled] = useState<boolean | null>(Platform.OS === 'web' ? on : null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    (on ? preventScreenCaptureAsync(SCREEN_KEY) : allowScreenCaptureAsync(SCREEN_KEY)).catch(() => {}).finally(() => live && setSettled(on));
    return () => {
      live = false;
    };
  }, [on]);
  // Never leave the protection on behind us, whatever closes the test.
  useEffect(
    () => () => {
      if (Platform.OS !== 'web') void allowScreenCaptureAsync(SCREEN_KEY).catch(() => {});
    },
    []
  );
  return settled;
}

/** A test, full screen: the secure exam's start page, answering with a timer, then the results. */
export function TestRunner({ testId, onClose }: { testId: string; onClose: () => void }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const user = useSignedInUser();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  // Android's back button during the exam: it can't leave, and says so.
  const blockedBackRef = useRef<(() => void) | null>(null);
  const protectedScreen = useScreenProtection(phase.kind !== 'review');
  // Android-only extras, on while the test is being answered and off the moment it isn't (see exam-security.ts).
  useExamSecurity(phase.kind === 'running');
  // Looked at before the test starts, so it isn't begun in split-screen.
  const introWindow = useMultiWindow(phase.kind === 'intro');

  useEffect(() => {
    let cancelled = false;
    studentApi.test(testId).then(
      async ({ test, attempt, questions, analytics }) => {
        if (cancelled) return;
        if (attempt?.state === 'submitted' || (!attempt && test.status === 'closed')) {
          // Submitted (here, elsewhere, or when time ran out): the phone's draft is done with.
          if (attempt) void clearDraft(user.id, testId);
          setPhase({ kind: 'review', test, attempt, questions, analytics, justSubmitted: false });
        } else if (attempt) {
          // Carry on where they left off.
          const resumed = await studentApi.start(testId).catch(() => null);
          if (!cancelled) setPhase(resumed ? { kind: 'running', test, attempt: resumed.attempt, questions: resumed.questions } : { kind: 'error', message: "Couldn't open the test." });
        } else setPhase({ kind: 'intro', test });
      },
      (e: unknown) => !cancelled && setPhase({ kind: 'error', message: e instanceof Error ? e.message : "Couldn't open the test." })
    );
    return () => {
      cancelled = true;
    };
  }, [testId, round, user.id]);

  const start = async (test: TestSummary) => {
    setBusy(true);
    try {
      const { attempt, questions } = await studentApi.start(testId);
      setPhase({ kind: 'running', test, attempt, questions });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : "Couldn't start the test." });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    bumpDataVersion();
    onClose();
  };

  const onSubmitted = useCallback(
    (test: TestSummary, attempt: Attempt, questions: TestQuestion[]) => {
      void clearDraft(user.id, testId);
      setPhase({ kind: 'review', test, attempt, questions, justSubmitted: true });
    },
    [testId, user.id]
  );

  if (protectedScreen === null) return null;

  return (
    <Modal
      key={String(protectedScreen)}
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={backAction(phase.kind) === 'block' ? () => blockedBackRef.current?.() : close}
    >
      {/* A Modal is its own native window, where SafeAreaView reads no insets. It covers the whole
          screen, so the app's own insets are the right ones. */}
      <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
        {phase.kind === 'loading' ? (
          <LoadingView label="Opening the test…" />
        ) : phase.kind === 'error' ? (
          <View style={styles.flex}>
            <ErrorView message={phase.message} onRetry={() => { setPhase({ kind: 'loading' }); setRound((n) => n + 1); }} />
            <View style={styles.pad}>
              <Button label="Close" variant="secondary" onPress={close} />
            </View>
          </View>
        ) : phase.kind === 'intro' ? (
          <Intro test={phase.test} busy={busy} splitScreen={introWindow} onStart={() => start(phase.test)} onClose={close} />
        ) : phase.kind === 'running' ? (
          <Runner
            test={phase.test}
            attempt={phase.attempt}
            questions={phase.questions}
            blockedBackRef={blockedBackRef}
            onExit={close}
            onSubmitted={(attempt, questions) => onSubmitted(phase.test, attempt, questions)}
          />
        ) : (
          <Review test={phase.test} attempt={phase.attempt} questions={phase.questions} analytics={phase.analytics ?? null} justSubmitted={phase.justSubmitted} onClose={close} />
        )}
      </View>
    </Modal>
  );
}

// ─── Shared pieces ─────────────────────────────────────────────────────────

function Header({ title, leading, trailing, onClose }: { title: string; leading?: React.ReactNode; trailing?: React.ReactNode; onClose?: () => void }) {
  const palette = usePalette();
  return (
    <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
      <View style={styles.headerInner}>
        {leading}
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: palette.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        {trailing}
        {onClose ? <IconButton icon={{ ios: 'xmark', android: 'close' }} label="Close" onPress={onClose} /> : null}
      </View>
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} color={palette.foreground} size={18} />
    </Pressable>
  );
}

/** A text-only button for secondary actions, with a full 44 pt target. */
function QuietButton({ label, icon, onPress, disabled = false, tone = 'primary' }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'muted' }) {
  const palette = usePalette();
  const color = tone === 'primary' ? palette.primary : palette.mutedForeground;
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

/** Keeps a column readable on tablets: content stays phone-width, centred. */
const column = { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' } as const;

// ─── Before starting ───────────────────────────────────────────────────────

function Intro({ test, busy, splitScreen, onStart, onClose }: { test: TestSummary; busy: boolean; splitScreen: MultiWindowReading; onStart: () => void; onClose: () => void }) {
  const palette = usePalette();
  const [now] = useState(() => Date.now());
  const minutesUntilClose = test.closesAt ? Math.floor((new Date(test.closesAt).getTime() - now) / 60_000) : null;
  // The time limit is cut short when the test closes first.
  const shortened = minutesUntilClose !== null && minutesUntilClose < test.durationMinutes;

  return (
    <View style={styles.flex}>
      <Header title="Secure examination" onClose={onClose} />
      <ScrollView contentContainerStyle={[styles.body, column]}>
        <Text style={[styles.eyebrow, { color: palette.primary }]}>SECURE EXAMINATION</Text>
        <View style={styles.hero}>
          <View style={[styles.heroTile, { backgroundColor: palette.primarySoft }]}>
            <Icon name={subjectIcon(test.subject)} color={palette.primary} size={24} />
          </View>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.heroTitle, { color: palette.foreground }]}>
              {test.title}
            </Text>
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>
              {test.subject || 'Mixed subjects'} · Set by {test.teacher.name}
            </Text>
          </View>
        </View>

        <View style={styles.facts}>
          <Fact label="Questions" value={String(test.questionCount)} />
          <Fact label="Duration" value={`${test.durationMinutes} min`} />
          <Fact label="Total marks" value={String(test.maxScore)} />
          <Fact label="Each question" value={`+${test.marksPerQuestion}${test.negativeMarks ? ` / −${test.negativeMarks}` : ''}`} />
        </View>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          {test.negativeMarks ? `A wrong answer takes off ${test.negativeMarks} mark${test.negativeMarks === 1 ? '' : 's'}; skipped questions score 0.` : 'No marks are taken off for wrong answers.'}
          {test.closesAt ? ` Closes ${whenLabel(test.closesAt, now)}.` : ''}
        </Text>

        {shortened ? (
          <Notice
            tone="warning"
            title={minutesUntilClose! > 0 ? `You'll have about ${minutesUntilClose} min` : 'This test is about to close'}
            text={`It closes ${whenLabel(test.closesAt!, now)}, before the full ${test.durationMinutes} minutes are up.`}
          />
        ) : null}

        {splitScreen.inMultiWindow ? (
          <Notice
            tone="warning"
            icon={{ ios: 'rectangle.split.2x1', android: 'splitscreen' }}
            title="Return to full screen"
            text={splitScreen.authoritative ? "The app is in split-screen or a small window. Make it full screen to start; the test can't be taken this way." : 'The app looks like it is in a small window. Make it full screen before you start.'}
            live
          />
        ) : null}

        <SectionTitle title="Examination instructions" />
        <Card>
          <Tip icon={{ ios: 'timer', android: 'timer' }} text="The timer starts when you tap the button below and runs on the server's clock. Closing or restarting the app does not pause or reset it." />
          <Tip icon={{ ios: 'checkmark.icloud', android: 'cloud_done' }} text="Your answers save as you go. The bar at the top shows when they're saved." />
          <Tip icon={{ ios: 'bookmark', android: 'bookmark' }} text="Mark questions for review and use the question palette to move around." />
          <Tip icon={{ ios: 'paperplane', android: 'send' }} text="Submit when you are done. When time runs out, your answers are submitted for you." />
        </Card>

        <SectionTitle title="Security restrictions" />
        <Card>
          <Tip icon={{ ios: 'lock', android: 'lock' }} text="In-app navigation is disabled during the examination. You can't leave it until you submit or time runs out." />
          <Tip icon={{ ios: 'rectangle.on.rectangle.slash', android: 'block' }} text={`Switching applications is prohibited. If you leave the app for more than ${AWAY_LIMIT_MS / 1000} seconds, your test ends and is submitted with the answers saved so far.`} />
          <Tip icon={{ ios: 'rectangle.split.2x1', android: 'splitscreen' }} text={`Split-screen and floating windows aren't allowed. On Android, time spent in split-screen counts as leaving the app (more than ${AWAY_LIMIT_MS / 1000} seconds ends the test), and other apps' floating overlays are hidden where your device supports it.`} />
          <Tip icon={{ ios: 'camera.viewfinder', android: 'screenshot' }} text="Screenshots and screen recording are blocked while the test is open." />
          <Tip icon={{ ios: 'hourglass', android: 'hourglass_top' }} text="The examination timer continues during interruptions such as calls or a lost connection." />
          <Tip icon={{ ios: 'exclamationmark.shield', android: 'gpp_maybe' }} text="Confirmed security violations may automatically end the attempt. An ended attempt can't be restarted." />
          <Tip icon={{ ios: 'chart.bar', android: 'bar_chart' }} text="Results become available after the test closes." />
        </Card>
      </ScrollView>
      <Footer>
        <Button label="I Understand — Start Test" icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={onStart} loading={busy} disabled={splitScreen.inMultiWindow && splitScreen.authoritative} />
      </Footer>
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

function Footer({ children }: { children: React.ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.card }]}>
      <View style={[styles.footerInner, column]}>{children}</View>
    </View>
  );
}

// ─── Taking the test ───────────────────────────────────────────────────────

function Runner({
  test,
  attempt,
  questions,
  blockedBackRef,
  onExit,
  onSubmitted,
}: {
  test: TestSummary;
  attempt: Attempt;
  questions: TestQuestion[];
  blockedBackRef: React.RefObject<(() => void) | null>;
  /** Leaves the exam without submitting: only offered once time is up and the server has the saved answers. */
  onExit: () => void;
  onSubmitted: (attempt: Attempt, questions: TestQuestion[]) => void;
}) {
  const palette = usePalette();
  const user = useSignedInUser();
  const [answers, setAnswers] = useState<Map<number, string | null>>(() => new Map(attempt.answers.map((a) => [a.index, a.selected])));
  // Questions marked for review: a study aid kept on the phone (with answers
  // the server hasn't confirmed yet), never sent to the server.
  const [marked, setMarked] = useState<Set<number>>(() => new Set());
  const markedRef = useRef(marked);
  const touched = useRef(new Set<number>());
  const [restored, setRestored] = useState(false);
  const [current, setCurrent] = useState(0);
  // Questions opened so far, for the palette's "not visited".
  const [visited, setVisited] = useState<Set<number>>(() => new Set([questions[0]?.index]));
  // The time left is the deadline by the server's clock; the phone's clock only tells how long ago the server answered.
  const skewRef = useRef(skewOf(attempt.serverTime));
  const [remaining, setRemaining] = useState(() => secondsLeft(attempt.deadline, skewOf(attempt.serverTime)));
  // Set when the app was away longer than allowed and the server hasn't confirmed the outcome yet: the exam is frozen until it does.
  const [frozen, setFrozen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [warning, setWarning] = useState<{ minutes: number } | null>(null);
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Autosave: changed answers go a moment after the last change; a failed
  // save is kept and tried again, and the status always says which it is.
  const saverRef = useRef<AnswerSaver | null>(null);
  useEffect(() => {
    const latest = answersRef;
    const done = submittedRef;
    const saver = createAnswerSaver({
      save: (changed) => studentApi.saveAnswers(test.id, changed),
      read: (index) => latest.current.get(index) ?? null,
      onState: setSaveState,
    });
    saverRef.current = saver;
    const marks = markedRef;
    // Leaving the screen: send whatever hasn't gone yet, and keep it on the
    // phone too in case that last try fails; reopening the test sends it.
    return () => {
      const rest = saver.unsent();
      const unconfirmed = saver.unconfirmed();
      saver.dispose();
      saverRef.current = null;
      if (done.current) return;
      void saveDraft(user.id, test.id, { startedAt: attempt.startedAt, marks: [...marks.current], pending: unconfirmed });
      if (rest.length) studentApi.saveAnswers(test.id, rest).catch(() => {});
    };
  }, [test.id, user.id, attempt.startedAt]);

  // Coming back: restore review marks, and answers the server never confirmed
  // (unless they've been changed again since opening).
  useEffect(() => {
    let cancelled = false;
    void loadDraft(user.id, test.id, attempt.startedAt).then((draft) => {
      if (cancelled) return;
      if (draft) {
        const known = new Set(questions.map((q) => q.index));
        const marks = new Set([...draft.marks.filter((i) => known.has(i)), ...markedRef.current]);
        markedRef.current = marks;
        setMarked(marks);
        const pending = draft.pending.filter((p) => known.has(p.index) && !touched.current.has(p.index));
        if (pending.length) {
          const next = new Map(answersRef.current);
          pending.forEach((p) => next.set(p.index, p.selected));
          answersRef.current = next;
          setAnswers(next);
          pending.forEach((p) => saverRef.current?.change(p.index));
        }
      }
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id, test.id, attempt.startedAt, questions]);

  /** Writes the draft now; false if the phone couldn't store it. */
  const persistDraft = useCallback(
    () => saveDraft(user.id, test.id, { startedAt: attempt.startedAt, marks: [...markedRef.current], pending: saverRef.current?.unconfirmed() ?? [] }),
    [user.id, test.id, attempt.startedAt]
  );

  // Keep the draft current, shortly after changes, so it survives the app being closed.
  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => {
      if (!submittedRef.current) void persistDraft();
    }, 300);
    return () => clearTimeout(timer);
  }, [marked, answers, saveState, restored, persistDraft]);

  const all = () => questions.map((q) => ({ index: q.index, selected: answersRef.current.get(q.index) ?? null }));

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    saverRef.current?.pause();
    setSubmitting(true);
    setError(null);
    try {
      // Every answer goes with the submission, saved or not.
      const result = await studentApi.submit(test.id, all());
      onSubmitted(result.attempt, result.questions);
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof Error ? e.message : "Couldn't submit. Check your internet and try again.");
      saverRef.current?.resume();
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id, onSubmitted]);

  // ── The clock; warnings at 5 minutes and 1 minute; at zero the test is
  // submitted with what's answered.
  const warned = useRef({ five: false, one: false });
  const lastExpiryTry = useRef(0);
  useEffect(() => {
    const warn = (secondsLeft: number) => {
      const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
      setWarning({ minutes });
      AccessibilityInfo.announceForAccessibility(`${minutes} minute${minutes === 1 ? '' : 's'} left`);
    };
    const timer = setInterval(() => {
      const left = secondsLeft(attempt.deadline, skewRef.current);
      setRemaining(left);
      if (left === 0) {
        // Time is up: submit what is saved. If that can't reach the server, try again every few seconds.
        if (Date.now() - lastExpiryTry.current >= 5000) {
          lastExpiryTry.current = Date.now();
          void submit();
        }
      } else if (left <= 60 && !warned.current.one) {
        warned.current.one = warned.current.five = true;
        warn(left);
      } else if (left <= 300 && !warned.current.five) {
        warned.current.five = true;
        warn(left);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt.deadline, submit]);

  useEffect(() => {
    if (!warning) return;
    const timer = setTimeout(() => setWarning(null), 10_000);
    return () => clearTimeout(timer);
  }, [warning]);

  // A new question starts at its top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [current]);

  /** Opens a question (by its place in the test) and counts it as visited. */
  const goTo = (position: number) => {
    const target = Math.min(questions.length - 1, Math.max(0, position));
    setCurrent(target);
    setVisited((v) => (v.has(questions[target].index) ? v : new Set(v).add(questions[target].index)));
  };

  // ── Leaving the app. Only the app really going to the background counts (not
  // the keyboard, the app's own dialogs, or moving between questions). On
  // return the time away goes to the server, which records it and ends the
  // attempt if it was too long; the exam stays frozen until it answers. A
  // report that can't be sent (no connection) is kept and retried, and a
  // dropped connection by itself is never treated as leaving.
  const awayTracker = useRef(createAwayTracker());
  const pendingAway = useRef<number | null>(null);
  const reporting = useRef(false);
  const reportAway = useCallback(async () => {
    const ms = pendingAway.current;
    if (ms === null || reporting.current || submittedRef.current) return;
    reporting.current = true;
    try {
      const result = await studentApi.reportAway(test.id, ms, all());
      pendingAway.current = null;
      skewRef.current = skewOf(result.attempt.serverTime);
      if (result.attempt.state === 'submitted') {
        submittedRef.current = true;
        saverRef.current?.pause();
        onSubmitted(result.attempt, result.questions);
      } else setFrozen(false);
    } catch {
      // Kept and tried again shortly.
    } finally {
      reporting.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id, onSubmitted]);

  useEffect(() => {
    const tracker = awayTracker.current;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') tracker.background();
      else if (state === 'active') {
        const ms = tracker.foreground();
        if (ms === null) return;
        pendingAway.current = Math.max(pendingAway.current ?? 0, ms);
        if (ms > AWAY_LIMIT_MS) setFrozen(true);
        void reportAway();
      }
    });
    const retry = setInterval(() => void reportAway(), 4000);
    return () => {
      sub.remove();
      clearInterval(retry);
    };
  }, [reportAway]);

  // Split-screen. Android's own answer (native build) blocks the exam and the time spent there is
  // reported like any other time away, so the same limit applies, also while the student stays in it.
  // Without the native module it's only a guess from the window size: a notice, never held against them.
  const split = useMultiWindow(true);
  const splitBlocked = split.inMultiWindow && split.authoritative;
  const splitTracker = useRef(createAwayTracker());
  useEffect(() => {
    if (!splitBlocked) return;
    const tracker = splitTracker.current;
    tracker.background();
    const overLimit = setTimeout(() => {
      pendingAway.current = Math.max(pendingAway.current ?? 0, tracker.elapsed() ?? 0);
      setFrozen(true);
      void reportAway();
    }, AWAY_LIMIT_MS + 250);
    return () => {
      clearTimeout(overLimit);
      const ms = tracker.foreground();
      if (ms === null) return;
      pendingAway.current = Math.max(pendingAway.current ?? 0, ms);
      if (ms > AWAY_LIMIT_MS) setFrozen(true);
      void reportAway();
    };
  }, [splitBlocked, reportAway]);

  // Android's back button and back gestures can't leave the exam; they say so.
  useEffect(() => {
    blockedBackRef.current = () => setHint('Navigation is disabled during the exam. Submit the test to finish.');
    return () => {
      blockedBackRef.current = null;
    };
  }, [blockedBackRef]);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 4000);
    return () => clearTimeout(timer);
  }, [hint]);

  const select = (value: string | null) => {
    const index = questions[current].index;
    answersRef.current = new Map(answersRef.current).set(index, value);
    setAnswers(answersRef.current);
    touched.current.add(index);
    saverRef.current?.change(index);
  };

  const toggleMark = () => {
    const index = questions[current].index;
    const next = new Set(marked);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    markedRef.current = next;
    setMarked(next);
  };

  const isAnswered = (index: number) => (answers.get(index) ?? null) !== null;
  const statusOf = (index: number): CellStatus => cellStatus(isAnswered(index), marked.has(index), visited.has(index));
  const counts = examCounts(questions.map((x) => statusOf(x.index)));
  const answeredCount = counts.answered;

  const askSubmit = () => {
    const message = `Answered: ${counts.answered}
Unanswered: ${counts.unanswered}
Marked for Review: ${counts.marked}

You can't change answers after submitting.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`SUBMIT TEST?

${message}`)) void submit();
      return;
    }
    Alert.alert('SUBMIT TEST?', message, [
      { text: 'Continue Exam', style: 'cancel' },
      { text: 'Submit Test', onPress: () => void submit() },
    ]);
  };

  const q = questions[current];
  const last = current === questions.length - 1;
  const answeredNow = isAnswered(q.index);
  const markedNow = marked.has(q.index);
  const timeUp = remaining === 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Header title={test.title} trailing={<TimerPill seconds={remaining} />} />

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
            accessibilityState={{ expanded: showPalette }}
            accessibilityLabel={`All questions, ${answeredCount} of ${questions.length} answered`}
            onPress={() => setShowPalette((v) => !v)}
            style={({ pressed }) => [styles.paletteToggle, { borderColor: palette.border, backgroundColor: showPalette ? palette.secondary : palette.card }, pressed && styles.pressed]}
          >
            <Icon name={{ ios: 'square.grid.3x3', android: 'apps' }} color={palette.foreground} size={16} />
            <Text style={[styles.paletteToggleText, { color: palette.foreground }]}>
              {answeredCount}/{questions.length}
            </Text>
            <Icon name={showPalette ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.mutedForeground} size={14} />
          </Pressable>
        </View>
        <View style={column}>
          <ProgressBar value={(answeredCount / questions.length) * 100} />
        </View>
      </View>

      {showPalette ? (
        <QuestionPalette
          questions={questions}
          current={current}
          statusOf={statusOf}
          onPick={(i) => {
            goTo(i);
            setShowPalette(false);
          }}
        />
      ) : null}

      {split.inMultiWindow && !split.authoritative ? (
        <View style={[styles.warning, column]}>
          <Notice tone="warning" icon={{ ios: 'rectangle.split.2x1', android: 'splitscreen' }} title="Use full screen" text="The app looks like it is in a small window. Please use the whole screen for the exam." live />
        </View>
      ) : null}

      {hint ? (
        <View style={[styles.warning, column]}>
          <Notice tone="warning" icon={{ ios: 'lock', android: 'lock' }} title="Exam in progress" text={hint} live />
        </View>
      ) : null}

      {warning ? (
        <View style={[styles.warning, column]}>
          <Notice
            tone={warning.minutes <= 1 ? 'danger' : 'warning'}
            icon={{ ios: 'timer', android: 'timer' }}
            title={`${warning.minutes} minute${warning.minutes === 1 ? '' : 's'} left`}
            text="Your answers save as you go. The test submits itself when time runs out."
            onDismiss={() => setWarning(null)}
          />
        </View>
      ) : null}

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.body, column]} keyboardShouldPersistTaps="handled">
        <View style={styles.qMeta}>
          <Text style={[styles.qMetaText, { color: palette.primary }]} numberOfLines={1}>
            Q{current + 1} · {q.chapter || q.subject}
          </Text>
          <Text style={[styles.qMarks, { color: palette.mutedForeground }]}>
            +{test.marksPerQuestion}
            {test.negativeMarks ? ` / −${test.negativeMarks}` : ''}
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
          {answeredNow ? <QuietButton label="Clear answer" icon={{ ios: 'xmark.circle', android: 'backspace' }} tone="muted" onPress={() => select(null)} /> : null}
        </View>
      </ScrollView>

      <Footer>
        <ErrorText message={error} />
        <View style={styles.row}>
          <Button
            label="Previous"
            variant="secondary"
            icon={{ ios: 'chevron.left', android: 'chevron_left' }}
            onPress={() => goTo(current - 1)}
            disabled={current === 0}
            style={styles.flex}
          />
          {last ? (
            <Button label="Submit test" icon={{ ios: 'paperplane.fill', android: 'send' }} onPress={askSubmit} loading={submitting} style={styles.flex} />
          ) : (
            <Button label="Next" onPress={() => goTo(current + 1)} style={styles.flex} />
          )}
        </View>
        {!last ? <QuietButton label="Submit test" onPress={askSubmit} disabled={submitting} /> : null}
        {timeUp && error ? <QuietButton label="Time is up — exit (saved answers are submitted)" tone="muted" onPress={onExit} /> : null}
      </Footer>
      {splitBlocked && !frozen ? (
        <View style={[styles.frozen, { backgroundColor: palette.background }]} accessibilityViewIsModal>
          <Icon name={{ ios: 'rectangle.split.2x1', android: 'splitscreen' }} color={palette.primary} size={32} />
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.frozenTitle, { color: palette.foreground }]}>
            Return to full screen
          </Text>
          <Text style={[styles.frozenText, { color: palette.mutedForeground }]}>
            {`The exam can't be taken in split-screen. Close the other window to continue. Time in split-screen counts as leaving the app: more than ${AWAY_LIMIT_MS / 1000} seconds ends your test. The timer keeps running.`}
          </Text>
        </View>
      ) : null}
      {frozen ? (
        <View style={[styles.frozen, { backgroundColor: palette.background }]} accessibilityViewIsModal>
          <Icon name={{ ios: 'lock.shield', android: 'gpp_maybe' }} color={palette.primary} size={32} />
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.frozenTitle, { color: palette.foreground }]}>
            Ending your test
          </Text>
          <Text style={[styles.frozenText, { color: palette.mutedForeground }]}>
            You left the app for longer than allowed. Your saved answers are being submitted. If you have no connection, this finishes as soon as you are back online.
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Time left; amber from 5 minutes, red from 1 minute. The digits always carry the meaning. */
function TimerPill({ seconds }: { seconds: number }) {
  const palette = usePalette();
  const [bg, fg] = seconds <= 60 ? [palette.dangerSoft, palette.dangerInk] : seconds <= 300 ? [palette.warningSoft, palette.warningInk] : [palette.secondary, palette.foreground];
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={`Time left, ${spokenDuration(seconds)}`} style={[styles.timer, { backgroundColor: bg }]}>
      <Icon name={{ ios: 'timer', android: 'timer' }} color={fg} size={15} />
      <Text style={[styles.timerText, { color: fg }]}>{clock(seconds)}</Text>
    </View>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const palette = usePalette();
  if (state === 'error') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Some answers aren't saved yet. Retry now"
        accessibilityLiveRegion="polite"
        onPress={onRetry}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        style={({ pressed }) => [styles.saveStatus, pressed && styles.pressed]}
      >
        <Icon name={{ ios: 'exclamationmark.icloud', android: 'cloud_off' }} color={palette.warningInk} size={14} />
        <Text style={[styles.saveText, { color: palette.warningInk, fontWeight: '700' }]}>Not saved yet · Retry</Text>
      </Pressable>
    );
  }
  const saving = state !== 'saved';
  return (
    <View style={styles.saveStatus} accessible accessibilityLabel={saving ? 'Saving your answers' : 'All answers saved'}>
      <Icon
        name={saving ? { ios: 'arrow.triangle.2.circlepath', android: 'sync' } : { ios: 'checkmark.icloud', android: 'cloud_done' }}
        color={saving ? palette.mutedForeground : palette.success}
        size={14}
      />
      <Text style={[styles.saveText, { color: palette.mutedForeground }]}>{saving ? 'Saving…' : 'All answers saved'}</Text>
    </View>
  );
}

/** Every question at a glance: answered, not answered, marked, and where you are. */
function QuestionPalette({
  questions,
  current,
  statusOf,
  onPick,
}: {
  questions: TestQuestion[];
  current: number;
  statusOf: (index: number) => CellStatus;
  onPick: (position: number) => void;
}) {
  const palette = usePalette();
  const counts = examCounts(questions.map((x) => statusOf(x.index)));
  return (
    <View style={[styles.palettePanel, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
      <View style={[styles.paletteInner, column]}>
        <Text style={[styles.paletteSummary, { color: palette.foreground }]}>
          {counts.answered} answered · {counts.unanswered} not answered · {counts.marked} marked · {counts.notVisited} not visited
        </Text>
        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LegendItem label="Answered" swatch={{ backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }} />
          <LegendItem label="Not answered" swatch={{ backgroundColor: palette.card, borderColor: palette.borderStrong }} />
          <LegendItem label="Not visited" swatch={{ backgroundColor: palette.secondary, borderColor: palette.border }} />
          <LegendItem label="Current" swatch={{ backgroundColor: palette.card, borderColor: palette.primary, borderWidth: 2 }} />
          <View style={styles.legendItem}>
            <Icon name={{ ios: 'bookmark.fill', android: 'bookmark' }} color={palette.violet} size={13} />
            <Text style={[styles.legendText, { color: palette.mutedForeground }]}>Marked · answered and marked</Text>
          </View>
        </View>
        <ScrollView style={styles.paletteScroll} contentContainerStyle={styles.grid} nestedScrollEnabled>
          {questions.map((x, i) => {
            const status = statusOf(x.index);
            const done = status === 'answered' || status === 'answered-marked';
            const isMarked = status === 'marked' || status === 'answered-marked';
            const unseen = status === 'not-visited';
            const here = i === current;
            const states = [
              done ? 'answered' : unseen ? 'not visited' : 'not answered',
              isMarked ? 'marked for review' : null,
              here ? 'current' : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <Pressable
                key={x.index}
                accessibilityRole="button"
                accessibilityLabel={`Question ${i + 1}, ${states}`}
                onPress={() => onPick(i)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor: done ? palette.primarySoft : unseen ? palette.secondary : palette.card,
                    borderColor: here ? palette.primary : done ? palette.primaryBorder : unseen ? palette.border : palette.borderStrong,
                    borderWidth: here ? 2 : 1,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cellText, { color: done ? palette.primaryInk : palette.foreground }]}>{i + 1}</Text>
                {isMarked ? (
                  <View style={[styles.cellMark, { backgroundColor: palette.violet, borderColor: palette.card }]}>
                    <Icon name={{ ios: 'bookmark.fill', android: 'bookmark' }} color={palette.card} size={8} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function LegendItem({ label, swatch }: { label: string; swatch: { backgroundColor: string; borderColor: string; borderWidth?: number } }) {
  const palette = usePalette();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { borderWidth: 1 }, swatch]} />
      <Text style={[styles.legendText, { color: palette.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Results ───────────────────────────────────────────────────────────────

type Outcome = 'right' | 'wrong' | 'skipped';
type Filter = 'all' | 'wrong' | 'skipped';

function outcomeOf(question: TestQuestion, answer: Attempt['answers'][number] | undefined): Outcome {
  const selected = answer?.selected ?? null;
  if (answer?.correct === true) return 'right';
  if (selected === null) return 'skipped';
  if (answer?.correct === false) return 'wrong';
  // Not graded on this answer (shouldn't happen once submitted): compare with the key.
  return (question.correctAnswer ?? '').trim().toUpperCase() === selected.trim().toUpperCase() ? 'right' : 'wrong';
}

function Review({
  test,
  attempt,
  questions,
  analytics,
  justSubmitted,
  onClose,
}: {
  test: TestSummary;
  attempt: Attempt | null;
  questions: TestQuestion[];
  analytics: TestAnalytics | null;
  justSubmitted: boolean;
  onClose: () => void;
}) {
  const palette = usePalette();
  const [filter, setFilter] = useState<Filter>('all');
  const [section, setSection] = useState<ResultSection>('overview');
  const result = attempt?.result;

  const rows = questions.map((q, position) => {
    const answer = attempt?.answers.find((a) => a.index === q.index);
    return { q, position, answer, selected: answer?.selected ?? null, outcome: attempt ? outcomeOf(q, answer) : null };
  });
  const count = (o: Outcome) => rows.filter((r) => r.outcome === o).length;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.outcome === filter);

  // Until the test closes the server sends only the submission time: confirm it, show nothing about marks or answers.
  if (attempt && typeof result?.score !== 'number') {
    return <Submitted test={test} attempt={attempt} total={questions.length} justSubmitted={justSubmitted} onClose={onClose} />;
  }

  return (
    <View style={styles.flex}>
      <Header title="Results" onClose={onClose} />
      <ScrollView contentContainerStyle={[styles.body, column]}>
        {attempt?.endedReason === 'violation' ? (
          <Notice
            tone="danger"
            icon={{ ios: 'exclamationmark.shield', android: 'gpp_maybe' }}
            title="Your test was ended"
            text="You left the app during the examination, so it was submitted with the answers saved up to then. It can't be restarted."
            live
          />
        ) : justSubmitted ? (
          <Notice
            tone="success"
            icon={{ ios: 'checkmark.seal', android: 'verified' }}
            title="✓ TEST SUBMITTED SUCCESSFULLY"
            text={result && 'score' in result ? "Your answers are in. Here's how you did." : 'Your answers are in. Your results will be available after the test closes.'}
            live
          />
        ) : null}

        <Text accessibilityRole="header" style={[styles.reviewTitle, { color: palette.foreground }]}>
          {test.title}
        </Text>

        {result ? (
          <>
            <Chips label="Result sections" choices={SECTION_KEYS} selected={section} onChange={setSection} labels={SECTION_LABELS} />
            {section === 'overview' ? (
              <>
                <ScoreCard test={test} result={result} analytics={analytics} />
                <StatGrid>
                  <StatTile label="Correct" value={result.correct} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
                  <StatTile label="Incorrect" value={result.wrong} icon={{ ios: 'xmark.circle', android: 'cancel' }} tone="danger" />
                  <StatTile label="Unanswered" value={analytics?.unanswered ?? result.skipped} icon={{ ios: 'minus.circle', android: 'remove_circle_outline' }} tone="neutral" />
                </StatGrid>
              </>
            ) : null}
          </>
        ) : (
          <Notice tone="info" title="You didn't take this test" text="It has closed. Its answers and solutions are below to learn from." />
        )}

        {section === 'topics' && result ? (
          analytics ? (
            <>
              <SectionTitle title="Topic performance" />
              <TopicPerformanceList topics={analytics.topics} audience="student" />
              <WeakTopicsSection weak={analytics.weakTopics} audience="student" />
            </>
          ) : (
            <Notice tone="info" title="Topic performance isn't available" text="Your topic-wise results could not be loaded. Close this and open the result again." />
          )
        ) : null}

        {section === 'questions' || !result ? <SectionTitle title="Question review" /> : null}
        {(section === 'questions' || !result) && attempt ? (
          <Segmented
            label="Show answers"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: rows.length },
              { value: 'wrong', label: 'Incorrect', count: count('wrong') },
              { value: 'skipped', label: 'Unanswered', count: count('skipped') },
            ]}
          />
        ) : null}

        {section !== 'questions' && result ? null : shown.length ? (
          shown.map(({ q, position, selected, outcome, answer }) => (
            // Keyed by the filter too, so solutions open or close to suit it.
            <Card key={`${filter}-${q.index}`} style={styles.answerCard}>
              <View style={styles.answerTop}>
                <Text style={[styles.qMetaText, { color: palette.primary }]} numberOfLines={1}>
                  Q{position + 1} · {q.chapter || q.subject}
                </Text>
                {outcome ? <OutcomeBadge outcome={outcome} test={test} /> : null}
              </View>
              <QuestionView question={q} selected={selected} reveal solutionOpen={filter !== 'all'} answerCorrect={answer?.correct ?? null} />
            </Card>
          ))
        ) : (
          <Card>
            <EmptyView
              icon={{ ios: 'checkmark.seal', android: 'verified' }}
              title={filter === 'wrong' ? 'No incorrect answers' : 'Nothing unanswered'}
              text={filter === 'wrong' ? 'Every question you answered was correct.' : 'You answered every question.'}
            />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

/** A submitted attempt while the test is still open: that it is in, and nothing about marks, right answers or solutions. */
function Submitted({ test, attempt, total, justSubmitted, onClose }: { test: TestSummary; attempt: Attempt; total: number; justSubmitted: boolean; onClose: () => void }) {
  const palette = usePalette();
  const [now] = useState(() => Date.now());
  const answered = attempt.answers.filter((a) => a.selected !== null).length;
  const submittedAt = attempt.result?.submittedAt;
  const violation = attempt.endedReason === 'violation';
  return (
    <View style={styles.flex}>
      <Header title="Test submitted" />
      <ScrollView contentContainerStyle={[styles.body, column]}>
        {violation ? (
          <Notice
            tone="danger"
            icon={{ ios: 'exclamationmark.shield', android: 'gpp_maybe' }}
            title="Your test was ended"
            text="You left the app during the examination, so it was submitted with the answers saved up to then. It can't be restarted."
            live
          />
        ) : (
          <Notice tone="success" icon={{ ios: 'checkmark.seal', android: 'verified' }} title="✓ TEST SUBMITTED SUCCESSFULLY" text="Your answers are in." live={justSubmitted} />
        )}
        <Text accessibilityRole="header" style={[styles.reviewTitle, { color: palette.foreground }]}>
          {test.title}
        </Text>
        <Card>
          <DetailRow label="Answered" value={`${answered} of ${total}`} />
          {submittedAt ? <DetailRow label="Submitted" value={whenLabel(submittedAt, now)} /> : null}
        </Card>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          Your score, the right answers and the solutions become available after the test closes{test.closesAt ? ` (${whenLabel(test.closesAt, now)})` : ''}.
        </Text>
      </ScrollView>
      <Footer>
        <Button label="Done" onPress={onClose} />
      </Footer>
    </View>
  );
}

function ScoreCard({ test, result, analytics }: { test: TestSummary; result: NonNullable<Attempt['result']>; analytics: TestAnalytics | null }) {
  const palette = usePalette();
  const figures = resultFigures(test, result, analytics);
  const total = Math.max(1, result.correct + result.wrong + result.skipped);
  return (
    <Card style={styles.scoreCard}>
      <Text accessibilityRole="header" style={[styles.eyebrow, { color: palette.mutedForeground }]}>
        YOUR TEST RESULT
      </Text>
      <View style={styles.scoreRow} accessible accessibilityLabel={`Score ${numberLabel(result.score)} out of ${numberLabel(result.maxScore)}, ${percentLabel(figures.percentage)}`}>
        <Text style={[styles.scoreBig, { color: palette.foreground }]}>
          {numberLabel(result.score)}
          <Text style={[styles.scoreOf, { color: palette.mutedForeground }]}> / {numberLabel(result.maxScore)}</Text>
        </Text>
        <Badge label={percentLabel(figures.percentage)} tone={figures.percentage === null ? 'neutral' : resultTone(figures.percentage)} />
      </View>
      <View
        accessible
        accessibilityLabel={`${result.correct} correct, ${result.wrong} incorrect, ${result.skipped} unanswered`}
        style={[styles.outcomeBar, { backgroundColor: palette.secondary }]}
      >
        {result.correct ? <View style={{ flex: result.correct / total, backgroundColor: palette.success }} /> : null}
        {result.wrong ? <View style={{ flex: result.wrong / total, backgroundColor: palette.danger }} /> : null}
        {result.skipped ? <View style={{ flex: result.skipped / total, backgroundColor: palette.borderStrong }} /> : null}
      </View>
      <View style={[styles.divider, { backgroundColor: palette.border }]} />
      <DetailRow label="Percentage" value={percentLabel(figures.percentage)} />
      <DetailRow label="Accuracy" value={figures.accuracy === null ? 'None answered' : `${percentLabel(figures.accuracy)} of answered`} />
      <DetailRow label="Marks" value={`+${numberLabel(result.correct * test.marksPerQuestion)} for correct`} />
      <DetailRow label="Negative marking" value={test.negativeMarks ? (figures.negativeDeducted ? `−${numberLabel(figures.negativeDeducted)} deducted` : 'Nothing deducted') : 'None in this test'} />
      <DetailRow label="Time taken" value={figures.time} />
      {figures.rank ? <DetailRow label="Your rank" value={figures.rank} /> : null}
    </Card>
  );
}

function OutcomeBadge({ outcome, test }: { outcome: Outcome; test: TestSummary }) {
  if (outcome === 'right') return <Badge label={`Correct · +${test.marksPerQuestion}`} tone="success" />;
  if (outcome === 'wrong') return <Badge label={`Incorrect · ${test.negativeMarks ? `−${test.negativeMarks}` : '0'}`} tone="danger" />;
  return <Badge label="Unanswered · 0" />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  pad: { padding: 16 },
  row: { flexDirection: 'row', gap: 10 },
  pressed: { opacity: 0.7 },

  header: { borderBottomWidth: 1 },
  headerInner: { ...column, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, minHeight: 56 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', paddingHorizontal: 8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  quiet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, alignSelf: 'center' },
  quietText: { fontSize: 15, fontWeight: '700' },

  body: { padding: 16, gap: 14, paddingBottom: 24 },
  footer: { borderTopWidth: 1 },
  footerInner: { padding: 16, paddingBottom: 12, gap: 6 },

  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  frozen: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  frozenTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  frozenText: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  meta: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  factLabel: { fontSize: 12, fontWeight: '600' },
  factValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 2 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20 },

  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: 999, marginRight: 4 },
  timerText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statusBar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  position: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, alignSelf: 'flex-start' },
  saveText: { fontSize: 12, lineHeight: 16 },
  paletteToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  paletteToggleText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  warning: { paddingHorizontal: 16, paddingTop: 10 },

  palettePanel: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
  paletteInner: { gap: 10 },
  paletteSummary: { fontSize: 14, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  paletteScroll: { maxHeight: 232 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4, paddingRight: 4 },
  cell: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cellMark: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  qMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  qMetaText: { flex: 1, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  qMarks: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  qTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  markButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  markText: { fontSize: 14, fontWeight: '700' },

  reviewTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  scoreCard: { gap: 12, padding: 16 },
  scoreLabel: { fontSize: 13, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -6 },
  scoreBig: { fontSize: 44, lineHeight: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 20, fontWeight: '600' },
  outcomeBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },
  answerCard: { gap: 12 },
  answerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
