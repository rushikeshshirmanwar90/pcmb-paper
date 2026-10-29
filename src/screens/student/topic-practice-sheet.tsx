import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  DetailSheet,
  EmptyView,
  ErrorText,
  ErrorView,
  Icon,
  LoadingView,
  Muted,
  Notice,
  ProgressBar,
  SectionTitle,
  StatGrid,
  StatTile,
  useLoad,
  usePalette,
} from '@/components/kit';
import { Explanation } from '@/components/explanation';
import { QuestionView } from '@/screens/student/question-view';
import {
  answerDelta,
  breadcrumb,
  mergePage,
  NO_EXPLANATION,
  nodeKey,
  positionOf,
  sessionTally,
  STATUS_OF,
  type PracticeMode,
  type PracticeNode,
} from '@/screens/student/topic-practice';
import { studentApi, type PracticeQuestion } from '@/services/student-api';

/** A checked answer, as the server marked and saved it. */
type Result = { selected: string; correct: boolean; correctAnswer: string; explanation: string; explanationDiagramUrls: string[] };

const TITLES: Record<PracticeMode, string> = { continue: 'Practice', review: 'Review answers', retry: 'Retry incorrect', again: 'Practice again' };

/**
 * Practising one chapter or topic, a question at a time. Continue goes through
 * the questions not answered yet, Review shows answered ones with the saved
 * answer and solution, Retry asks the ones answered wrongly again. Every answer
 * is marked and saved by the server before it shows as answered.
 */
export function TopicPracticeSheet({
  node,
  mode,
  complete = false,
  next: nextStep = null,
  onAnswered,
  onClose,
}: {
  node: PracticeNode;
  mode: PracticeMode;
  /** Every question here attempted now (counts as saved so far). */
  complete?: boolean;
  /** Where to go once this is complete, e.g. "Next topic: Uniform Circular Motion". */
  next?: { label: string; onGo: () => void } | null;
  /** Each answer the server saved, with what it changes in the counts. */
  onAnswered?: (at: { standard: string; chapter: string; topic: string }, delta: { answered: number; correct: number }) => void;
  onClose: (changed: boolean) => void;
}) {
  const palette = usePalette();
  const status = STATUS_OF[mode];
  const first = useLoad(() => studentApi.practiceQuestions(node, status, null), [nodeKey(node), status]);
  const [more, setMore] = useState<{ questions: PracticeQuestion[]; next: string | null } | null>(null);
  const list = mergePage(first.data?.questions ?? [], more?.questions ?? []);
  const next = more ? more.next : first.data?.next ?? null;
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);

  const [pos, setPos] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string | null>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(false);

  const q: PracticeQuestion | undefined = list[pos];
  // Reviewing shows the saved answer; otherwise only what was checked in this session.
  const done: Result | undefined = q
    ? results[q._id] ??
      (mode === 'review' && q.mine
        ? { selected: q.mine.selected, correct: q.mine.correct, correctAnswer: q.correctAnswer ?? '', explanation: q.explanation ?? '', explanationDiagramUrls: q.explanationDiagramUrls ?? [] }
        : undefined)
    : undefined;
  const selected = q ? (done ? done.selected : drafts[q._id] ?? null) : null;
  const atEnd = pos >= list.length - 1 && next === null;
  const before = first.data?.summary ?? { answered: 0, questions: 0 };
  const where = positionOf(mode, pos, first.data?.total ?? 0, before);
  const tally = sessionTally(results);

  /** Loads the next page; resolves to how many new questions came. */
  const loadMore = useCallback(async () => {
    if (next === null || loadingRef.current) return 0;
    loadingRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await studentApi.practiceQuestions(node, status, next);
      setMore((prev) => ({ questions: mergePage(prev?.questions ?? [], page.questions), next: page.next }));
      return page.questions.length;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more questions.");
      return 0;
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [node, status, next]);

  const submit = async () => {
    if (!q) return;
    if (!selected) return setError(q.answerType === 'Numerical' ? 'Enter your answer.' : 'Pick an option.');
    setSaving(true);
    setError(null);
    try {
      const r = await studentApi.answerPyq(q._id, selected);
      if (r.saved === false) throw new Error("The server didn't keep this answer.");
      // Compared with what was saved before: earlier this session, else when the questions loaded.
      onAnswered?.({ standard: q.standard, chapter: q.chapter, topic: q.topic }, answerDelta(results[q._id] ?? q.mine, r));
      setResults((prev) => ({
        ...prev,
        [q._id]: { selected: r.selected, correct: r.correct, correctAnswer: r.correctAnswer, explanation: r.explanation, explanationDiagramUrls: r.explanationDiagramUrls ?? [] },
      }));
    } catch (e) {
      // Nothing is marked as answered unless the server saved it.
      setError(`Your answer wasn't saved. ${e instanceof Error ? e.message : 'Try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    setError(null);
    if (pos < list.length - 1) return setPos((p) => p + 1);
    if (next !== null) {
      if ((await loadMore()) > 0) setPos((p) => p + 1);
      return;
    }
    setSummary(true);
  };

  const close = () => onClose(tally.answered > 0);
  const firstLoad = !first.data;
  const title = summary ? 'Session summary' : TITLES[mode];

  return (
    <DetailSheet
      visible
      title={title}
      onClose={close}
      footer={
        summary || !q ? undefined : (
          <>
            <ErrorText message={error} />
            {done ? (
              <Button
                label={atEnd ? 'Finish' : mode === 'review' ? 'Next answer' : 'Next question'}
                icon={atEnd ? { ios: 'flag.checkered', android: 'flag' } : undefined}
                onPress={() => void goNext()}
                loading={loadingMore}
              />
            ) : (
              <View style={styles.footerRow}>
                <Button label={atEnd ? 'Skip & finish' : 'Skip'} variant="secondary" onPress={() => void goNext()} disabled={loadingMore || saving} style={styles.flex} />
                <Button label="Submit answer" onPress={() => void submit()} loading={saving} disabled={!selected} style={styles.flex2} />
              </View>
            )}
          </>
        )
      }
    >
      {summary ? (
        <Summary
          mode={mode}
          tally={tally}
          remaining={Math.max(0, before.questions - before.answered - (mode === 'continue' ? tally.answered : 0))}
          next={complete ? nextStep : null}
          onNext={() => {
            close();
            nextStep?.onGo();
          }}
          onDone={close}
        />
      ) : firstLoad && first.error ? (
        <ErrorView message={first.error} onRetry={first.reload} />
      ) : firstLoad ? (
        <LoadingView label="Loading questions…" />
      ) : !q ? (
        <Empty mode={mode} total={before.questions} />
      ) : (
        <View style={styles.practice}>
          <Text style={[styles.path, { color: palette.mutedForeground }]} numberOfLines={2}>
            {breadcrumb(node)}
          </Text>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              disabled={pos === 0}
              onPress={() => {
                setError(null);
                setPos((p) => Math.max(0, p - 1));
              }}
              style={({ pressed }) => [styles.navButton, { opacity: pos === 0 ? 0.35 : pressed ? 0.6 : 1 }]}
            >
              <Icon name={{ ios: 'chevron.left', android: 'chevron_left' }} color={palette.primary} size={16} />
              <Text style={[styles.navText, { color: palette.primary }]}>Previous</Text>
            </Pressable>
            <Text style={[styles.count, { color: palette.foreground }]} accessibilityLabel={`Question ${where.current} of ${where.of}`}>
              Question {where.current} <Text style={{ color: palette.mutedForeground }}>of {where.of}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End and see summary"
              onPress={() => setSummary(true)}
              style={({ pressed }) => [styles.navButton, styles.navEnd, pressed && styles.pressed]}
            >
              <Text style={[styles.navText, { color: palette.primary }]}>End</Text>
            </Pressable>
          </View>
          <ProgressBar value={(where.current / where.of) * 100} />
          <View style={styles.badges}>
            {q.source ? <Badge label={q.source} tone="violet" /> : null}
            {node.topic === null && q.topic ? <Badge label={q.topic} tone="neutral" /> : null}
            {tally.answered ? <Badge label={`${tally.correct}/${tally.answered} right this session`} tone="primary" /> : null}
            {mode === 'retry' && q.mine && !results[q._id] ? <Badge label={`You answered ${q.mine.selected} before`} tone="warning" /> : null}
          </View>

          <Card>
            <QuestionView
              // The solution gets its own section below, once answered.
              question={{ ...q, correctAnswer: done?.correctAnswer ?? '', explanation: '' }}
              selected={selected}
              onSelect={done || saving ? undefined : (value) => setDrafts((d) => ({ ...d, [q._id]: value }))}
              reveal={!!done}
              answerCorrect={done?.correct}
            />
          </Card>

          {done ? (
            <>
              <Notice
                tone={done.correct ? 'success' : 'danger'}
                title={done.correct ? 'Correct!' : 'Incorrect'}
                text={done.correct ? undefined : done.correctAnswer ? `The correct answer is ${done.correctAnswer}.` : undefined}
                live
              />
              <View style={styles.solution}>
                <SectionTitle title="Explanation" />
                {done.explanation ? (
                  <Explanation
                    text={done.explanation}
                    correctAnswer={q.answerType === 'Numerical' ? undefined : done.correctAnswer}
                    diagramUrls={done.explanationDiagramUrls}
                    defaultCollapsed={false}
                  />
                ) : (
                  <Muted>{NO_EXPLANATION}</Muted>
                )}
              </View>
            </>
          ) : null}
        </View>
      )}
    </DetailSheet>
  );
}

function Empty({ mode, total }: { mode: PracticeMode; total: number }) {
  if (mode === 'continue') {
    return total ? (
      <EmptyView
        icon={{ ios: 'checkmark.seal', android: 'verified' }}
        title="All questions attempted"
        text={`You've answered all ${total} questions here. Review your answers or retry the incorrect ones.`}
      />
    ) : (
      <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="No questions here yet" text="There are no past-year questions for this part of the syllabus yet." />
    );
  }
  return mode === 'review' ? (
    <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="No answers yet" text="Answer some questions first, then review them here." />
  ) : mode === 'again' ? (
    <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="No questions here yet" text="There are no past-year questions for this part of the syllabus yet." />
  ) : (
    <EmptyView icon={{ ios: 'checkmark.circle', android: 'check_circle' }} title="No incorrect answers" text="Nothing to retry here right now." />
  );
}

function Summary({
  mode,
  tally,
  remaining,
  next,
  onNext,
  onDone,
}: {
  mode: PracticeMode;
  tally: ReturnType<typeof sessionTally>;
  remaining: number;
  next: { label: string } | null;
  onNext: () => void;
  onDone: () => void;
}) {
  const palette = usePalette();
  const accuracy = tally.answered ? Math.round((tally.correct / tally.answered) * 100) : null;
  return (
    <View style={styles.practice}>
      <Card style={styles.summaryCard}>
        <Text style={[styles.summaryLabel, { color: palette.mutedForeground }]}>{mode === 'review' ? 'Review finished' : 'This session'}</Text>
        {mode === 'review' ? (
          <Text style={[styles.summaryEmpty, { color: palette.foreground }]}>Your saved answers are unchanged.</Text>
        ) : accuracy !== null ? (
          <View style={styles.summaryRow} accessible accessibilityLabel={`${accuracy} percent: ${tally.correct} right of ${tally.answered} answered`}>
            <Text style={[styles.summaryBig, { color: palette.foreground }]}>{accuracy}%</Text>
            <Badge label={`${tally.correct} of ${tally.answered} right`} tone={accuracy >= 70 ? 'success' : accuracy < 40 ? 'danger' : 'warning'} />
          </View>
        ) : (
          <Text style={[styles.summaryEmpty, { color: palette.foreground }]}>You didn&apos;t answer any questions.</Text>
        )}
      </Card>
      {mode !== 'review' ? (
        <StatGrid>
          <StatTile label="Answered" value={tally.answered} icon={{ ios: 'pencil.and.list.clipboard', android: 'edit_note' }} />
          <StatTile label="Correct" value={tally.correct} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
          <StatTile label="Incorrect" value={tally.wrong} icon={{ ios: 'xmark.circle', android: 'cancel' }} tone="danger" />
        </StatGrid>
      ) : null}
      {mode === 'continue' ? <Muted>{remaining ? `${remaining} question${remaining === 1 ? '' : 's'} left here. Your progress is saved, so you can carry on any time.` : 'You have attempted every question here.'}</Muted> : null}
      {mode === 'again' ? <Muted>Your latest answer to each question is the one saved.</Muted> : null}
      {next ? (
        <>
          <Button label={`${next.label} →`} onPress={onNext} accessibilityLabel={next.label} />
          <Button label="Done" variant="secondary" onPress={onDone} />
        </>
      ) : (
        <Button label="Done" onPress={onDone} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2 },
  pressed: { opacity: 0.7 },
  practice: { gap: 14 },
  path: { fontSize: 13, fontWeight: '600' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, minWidth: 64 },
  navEnd: { justifyContent: 'flex-end' },
  navText: { fontSize: 15, fontWeight: '700' },
  count: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footerRow: { flexDirection: 'row', gap: 10 },
  solution: { gap: 8 },
  summaryCard: { gap: 6, padding: 16 },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryBig: { fontSize: 44, lineHeight: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryEmpty: { fontSize: 16, fontWeight: '600' },
});
