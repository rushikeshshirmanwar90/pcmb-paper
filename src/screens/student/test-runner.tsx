import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { Button, Card, DetailRow, ErrorText, ErrorView, Icon, LoadingView, Muted, SectionTitle, StatGrid, StatTile, usePalette } from '@/components/kit';
import { bumpDataVersion } from '@/context/data-version';
import { QuestionView } from '@/screens/student/question-view';
import type { TestSummary } from '@/services/school-api';
import { studentApi, type Attempt, type TestQuestion } from '@/services/student-api';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro'; test: TestSummary }
  | { kind: 'running'; test: TestSummary; attempt: Attempt; questions: TestQuestion[] }
  | { kind: 'review'; test: TestSummary; attempt: Attempt | null; questions: TestQuestion[] };

/** A test, full screen: the start page, answering with a timer, then the review. */
export function TestRunner({ testId, onClose }: { testId: string; onClose: () => void }) {
  const palette = usePalette();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    studentApi.test(testId).then(
      async ({ test, attempt, questions }) => {
        if (cancelled) return;
        if (attempt?.state === 'submitted' || (!attempt && test.status === 'closed')) setPhase({ kind: 'review', test, attempt, questions });
        else if (attempt) {
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
  }, [testId, round]);

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

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={phase.kind === 'running' ? () => {} : close}>
      <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
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
          <Intro test={phase.test} busy={busy} onStart={() => start(phase.test)} onClose={close} />
        ) : phase.kind === 'running' ? (
          <Runner
            test={phase.test}
            attempt={phase.attempt}
            questions={phase.questions}
            onSubmitted={(attempt, questions) => setPhase({ kind: 'review', test: phase.test, attempt, questions })}
          />
        ) : (
          <Review test={phase.test} attempt={phase.attempt} questions={phase.questions} onClose={close} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Header({ title, right, onClose }: { title: string; right?: React.ReactNode; onClose?: () => void }) {
  const palette = usePalette();
  return (
    <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
      <Text accessibilityRole="header" style={[styles.headerTitle, { color: palette.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
      {onClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.close}>
          <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Intro({ test, busy, onStart, onClose }: { test: TestSummary; busy: boolean; onStart: () => void; onClose: () => void }) {
  return (
    <View style={styles.flex}>
      <Header title={test.title} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <DetailRow label="Subject" value={test.subject || 'Mixed'} />
          <DetailRow label="Questions" value={String(test.questionCount)} />
          <DetailRow label="Time" value={`${test.durationMinutes} minutes`} />
          <DetailRow label="Marks" value={`+${test.marksPerQuestion} right${test.negativeMarks ? `, −${test.negativeMarks} wrong` : ''}, 0 skipped`} />
          <DetailRow label="Set by" value={test.teacher.name} />
        </Card>
        <Muted>
          The timer starts when you press Start and keeps running if you leave the app. Your answers are saved as you go; when time is up the test is
          submitted for you.
        </Muted>
      </ScrollView>
      <View style={styles.pad}>
        <Button label="Start the test" onPress={onStart} loading={busy} />
      </View>
    </View>
  );
}

const remainingOf = (deadline: string) => Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Runner({
  test,
  attempt,
  questions,
  onSubmitted,
}: {
  test: TestSummary;
  attempt: Attempt;
  questions: TestQuestion[];
  onSubmitted: (attempt: Attempt, questions: TestQuestion[]) => void;
}) {
  const palette = usePalette();
  const [answers, setAnswers] = useState<Map<number, string | null>>(() => new Map(attempt.answers.map((a) => [a.index, a.selected])));
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(() => remainingOf(attempt.deadline));
  const [showPalette, setShowPalette] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsaved = useRef(new Set<number>());
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const all = () => questions.map((q) => ({ index: q.index, selected: answersRef.current.get(q.index) ?? null }));

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await studentApi.submit(test.id, all());
      onSubmitted(result.attempt, result.questions);
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof Error ? e.message : "Couldn't submit. Check your internet and try again.");
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id, onSubmitted]);

  // The clock; at zero the test is submitted with what's answered.
  useEffect(() => {
    const timer = setInterval(() => {
      const left = remainingOf(attempt.deadline);
      setRemaining(left);
      if (left === 0) void submit();
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt.deadline, submit]);

  // Save changed answers a moment after the last change.
  useEffect(() => {
    if (!unsaved.current.size) return;
    const timer = setTimeout(() => {
      const changed = [...unsaved.current].map((index) => ({ index, selected: answersRef.current.get(index) ?? null }));
      unsaved.current.clear();
      studentApi.saveAnswers(test.id, changed).catch(() => changed.forEach((c) => unsaved.current.add(c.index)));
    }, 800);
    return () => clearTimeout(timer);
  }, [answers, test.id]);

  const select = (value: string | null) => {
    const index = questions[current].index;
    unsaved.current.add(index);
    setAnswers((prev) => new Map(prev).set(index, value));
  };

  const answeredCount = questions.filter((q) => (answers.get(q.index) ?? null) !== null).length;
  const askSubmit = () => {
    const left = questions.length - answeredCount;
    confirmAction(
      'Submit the test?',
      left ? `${left} question${left === 1 ? ' is' : 's are'} unanswered. You can't change answers after submitting.` : "You can't change answers after submitting.",
      'Submit',
      () => void submit()
    );
  };

  const q = questions[current];
  const low = remaining <= 60;
  return (
    <View style={styles.flex}>
      <Header
        title={test.title}
        right={
          <View style={[styles.timer, { backgroundColor: low ? palette.dangerSoft : palette.secondary }]} accessibilityLabel={`Time left ${clock(remaining)}`}>
            <Icon name={{ ios: 'timer', android: 'timer' }} color={low ? palette.dangerInk : palette.foreground} size={15} />
            <Text style={[styles.timerText, { color: low ? palette.dangerInk : palette.foreground }]}>{clock(remaining)}</Text>
          </View>
        }
      />
      <View style={[styles.progressRow, { borderBottomColor: palette.border }]}>
        <Text style={[styles.progressText, { color: palette.mutedForeground }]}>
          Question {current + 1} of {questions.length} · {answeredCount} answered
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setShowPalette((v) => !v)} hitSlop={8}>
          <Text style={[styles.link, { color: palette.primary }]}>{showPalette ? 'Hide all' : 'All questions'}</Text>
        </Pressable>
      </View>
      {showPalette ? (
        <View style={[styles.palette, { borderBottomColor: palette.border }]}>
          {questions.map((x, i) => {
            const done = (answers.get(x.index) ?? null) !== null;
            return (
              <Pressable
                key={x.index}
                accessibilityRole="button"
                accessibilityLabel={`Question ${i + 1}${done ? ', answered' : ''}`}
                onPress={() => {
                  setCurrent(i);
                  setShowPalette(false);
                }}
                style={[
                  styles.cell,
                  { borderColor: i === current ? palette.primary : palette.border, backgroundColor: done ? palette.primarySoft : palette.card },
                ]}
              >
                <Text style={[styles.cellText, { color: done ? palette.primaryInk : palette.foreground }]}>{i + 1}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <QuestionView question={q} selected={answers.get(q.index) ?? null} onSelect={select} numberLabel={`Q${current + 1} · ${q.chapter || q.subject}`} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.card }]}>
        <ErrorText message={error} />
        <View style={styles.row}>
          <Button label="Back" variant="secondary" onPress={() => setCurrent((i) => Math.max(0, i - 1))} disabled={current === 0} style={styles.flex} />
          {current < questions.length - 1 ? (
            <Button label="Next" onPress={() => setCurrent((i) => i + 1)} style={styles.flex} />
          ) : (
            <Button label="Submit" onPress={askSubmit} loading={submitting} style={styles.flex} />
          )}
        </View>
        {current < questions.length - 1 ? <Button label="Submit test" variant="secondary" onPress={askSubmit} loading={submitting} /> : null}
      </View>
    </View>
  );
}

function Review({ test, attempt, questions, onClose }: { test: TestSummary; attempt: Attempt | null; questions: TestQuestion[]; onClose: () => void }) {
  const palette = usePalette();
  const result = attempt?.result;
  const selectedOf = (index: number) => attempt?.answers.find((a) => a.index === index)?.selected ?? null;
  return (
    <View style={styles.flex}>
      <Header title={test.title} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.body}>
        {result ? (
          <>
            <Card>
              <Text style={[styles.scoreBig, { color: palette.foreground }]}>
                {result.score}
                <Text style={[styles.scoreOf, { color: palette.mutedForeground }]}> / {result.maxScore}</Text>
              </Text>
              <Muted>Took {Math.max(1, Math.round(result.timeTakenSeconds / 60))} min of {test.durationMinutes}</Muted>
            </Card>
            <StatGrid>
              <StatTile label="Right" value={result.correct} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
              <StatTile label="Wrong" value={result.wrong} icon={{ ios: 'xmark.circle', android: 'cancel' }} tone="warning" />
              <StatTile label="Skipped" value={result.skipped} icon={{ ios: 'minus.circle', android: 'remove_circle_outline' }} tone="violet" />
            </StatGrid>
          </>
        ) : (
          <Card>
            <Muted>You didn&apos;t take this test. Here are its questions and answers to learn from.</Muted>
          </Card>
        )}
        <SectionTitle title="Answers and solutions" />
        {questions.map((q, i) => (
          <Card key={q.index}>
            <QuestionView question={q} selected={selectedOf(q.index)} reveal numberLabel={`Q${i + 1} · ${q.chapter || q.subject}${selectedOf(q.index) === null ? ' · skipped' : ''}`} />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  pad: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  timerText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  progressText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '700' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { width: 42, height: 42, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 14, fontWeight: '700' },
  body: { padding: 16, gap: 14 },
  footer: { padding: 16, gap: 10, borderTopWidth: 1 },
  row: { flexDirection: 'row', gap: 10 },
  scoreBig: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 20, fontWeight: '600' },
});
