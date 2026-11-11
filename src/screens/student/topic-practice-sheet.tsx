import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, type ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { useReducedMotion } from 'react-native-reanimated';
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
  Segmented,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import { Explanation } from '@/components/explanation';
import { countsLine, sessionRows, sessionStats, sessionVerdict, toneOf, type Outcome } from '@/screens/student/practice-session';
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
import { face } from '@/design/type';
import { Neo } from '@/design/tokens';

/** A checked answer, as the server marked and saved it. */
type Result = { selected: string; correct: boolean; correctAnswer: string; explanation: string; explanationDiagramUrls: string[] };

/** After checking an answer, how much of the question stays in view above the verdict. */
const FEEDBACK_PEEK = 140;

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
  /** The summary was opened with End, before the last question: offer the way back. */
  const [endedEarly, setEndedEarly] = useState(false);
  /** A question opened from the summary's list: the way back is one tap. */
  const [fromSummary, setFromSummary] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const reduceMotion = useReducedMotion();
  /** Where the question view starts in the scroll content, and the question just checked. */
  const practiceY = useRef(0);
  const justChecked = useRef<string | null>(null);
  /** Questions skipped this session; answering one later takes it off. */
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());

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
      justChecked.current = q._id;
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
    setEndedEarly(false);
    setSummary(true);
  };

  const skip = () => {
    if (q && !results[q._id]) setSkipped((prev) => new Set(prev).add(q._id));
    void goNext();
  };
  /** From the summary, back to one of this session's questions. */
  const openQuestion = (index: number) => {
    setError(null);
    setPos(index);
    setSummary(false);
    setFromSummary(true);
  };
  const backToSummary = () => {
    setError(null);
    setFromSummary(false);
    setSummary(true);
  };

  // Each question, and the summary, starts at the top, not where the last one was scrolled to.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pos, summary]);

  const close = () => onClose(tally.answered > 0);
  const showNext = summary && complete && nextStep !== null;
  const firstLoad = !first.data;
  const title = summary ? 'Session summary' : TITLES[mode];

  return (
    <DetailSheet
      visible
      scrollRef={scrollRef}
      title={title}
      onClose={close}
      footer={
        summary ? (
          // The way on is at the bottom, where Submit and Next were.
          <View style={styles.footerStack}>
            {showNext ? (
              <Button
                label={nextStep.label}
                icon={{ ios: 'arrow.right', android: 'arrow_forward' }}
                onPress={() => {
                  close();
                  nextStep.onGo();
                }}
              />
            ) : null}
            <Button label="Done" variant={showNext ? 'secondary' : 'primary'} onPress={close} />
            {endedEarly && !showNext && q ? (
              <Button
                label={mode === 'review' ? 'Back to answers' : 'Continue practice'}
                variant="secondary"
                icon={{ ios: 'arrow.uturn.backward', android: 'undo' }}
                onPress={() => setSummary(false)}
              />
            ) : null}
          </View>
        ) : !q ? undefined : (
          <>
            <ErrorText message={error} />
            {done && fromSummary ? (
              // Came from the summary's list: going back is the main way on.
              <View style={styles.footerRow}>
                {!atEnd ? <Button label="Next" variant="secondary" onPress={() => void goNext()} loading={loadingMore} style={styles.flex} /> : null}
                <Button label="Back to summary" icon={{ ios: 'list.bullet', android: 'list' }} onPress={backToSummary} style={styles.flex2} />
              </View>
            ) : done ? (
              <Button
                label={atEnd ? 'Finish' : mode === 'review' ? 'Next answer' : 'Next question'}
                icon={atEnd ? { ios: 'flag.checkered', android: 'flag' } : undefined}
                onPress={() => void goNext()}
                loading={loadingMore}
              />
            ) : (
              <View style={styles.footerRow}>
                {fromSummary ? (
                  <Button label="Summary" variant="secondary" onPress={backToSummary} disabled={saving} style={styles.flex} />
                ) : (
                  <Button label={atEnd ? 'Skip & finish' : 'Skip'} variant="secondary" onPress={skip} disabled={loadingMore || saving} style={styles.flex} />
                )}
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
          stats={sessionStats(list, results, skipped)}
          rows={sessionRows(list, results, skipped)}
          showTopic={node.topic === null}
          numberOf={(index) => positionOf(mode, index, first.data?.total ?? 0, before).current}
          remaining={Math.max(0, before.questions - before.answered - (mode === 'continue' ? tally.answered : 0))}
          onOpen={openQuestion}
        />
      ) : firstLoad && first.error ? (
        <ErrorView message={first.error} onRetry={first.reload} />
      ) : firstLoad ? (
        <LoadingView label="Loading questions…" />
      ) : !q ? (
        <Empty mode={mode} total={before.questions} />
      ) : (
        <View style={styles.practice} onLayout={(e) => (practiceY.current = e.nativeEvent.layout.y)}>
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
              <Text style={[styles.navText, { color: palette.foreground }]}>Previous</Text>
            </Pressable>
            <Text style={[styles.count, { color: palette.foreground }]} accessibilityLabel={`Question ${where.current} of ${where.of}`}>
              Question {where.current} <Text style={{ color: palette.mutedForeground }}>of {where.of}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End and see summary"
              onPress={() => {
                setEndedEarly(true);
                setSummary(true);
              }}
              style={({ pressed }) => [styles.navButton, styles.navEnd, pressed && styles.pressed]}
            >
              <Text style={[styles.navText, { color: palette.foreground }]}>End</Text>
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
            <View
              style={styles.feedback}
              onLayout={(e) => {
                // Just checked: bring the verdict and the solution into view (they land below the
                // fold on most questions), keeping the end of the marked options in sight above.
                if (justChecked.current !== q._id) return;
                justChecked.current = null;
                const y = practiceY.current + e.nativeEvent.layout.y - FEEDBACK_PEEK;
                scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
              }}
            >
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
            </View>
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

const OUTCOME: Record<Outcome, { label: string; icon: IconName }> = {
  correct: { label: 'Correct', icon: { ios: 'checkmark.circle.fill', android: 'check_circle' } },
  wrong: { label: 'Wrong', icon: { ios: 'xmark.circle.fill', android: 'cancel' } },
  skipped: { label: 'Skipped', icon: { ios: 'minus.circle', android: 'remove_circle_outline' } },
};

/**
 * The round's result: what it means in words first, then the counts as one
 * bar with a key (each count has an icon, not only a colour), then every
 * question met, in order. A question opens again from the list, so a
 * mistake is one tap from its solution.
 */
function Summary({
  mode,
  stats,
  rows,
  showTopic,
  numberOf,
  remaining,
  onOpen,
}: {
  mode: PracticeMode;
  stats: ReturnType<typeof sessionStats>;
  rows: ReturnType<typeof sessionRows<PracticeQuestion>>;
  /** A whole chapter: say which topic each question was from. */
  showTopic: boolean;
  /** A question's number as the session showed it ("Question 21 of 40"). */
  numberOf: (index: number) => number;
  remaining: number;
  onOpen: (index: number) => void;
}) {
  const palette = usePalette();
  const ink = { correct: palette.successInk, wrong: palette.dangerInk, skipped: palette.mutedForeground };
  const [show, setShow] = useState<'all' | 'wrong' | 'skipped'>('all');
  const verdict = sessionVerdict(stats.accuracy, stats.wrong, stats.skipped);

  // The screen changes under VoiceOver's focus (the tapped button is gone), so say what it shows.
  const announcement = mode === 'review' ? 'Review finished' : `${verdict.title}. ${countsLine(stats)}`;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  if (mode === 'review') {
    return (
      <EmptyView
        icon={{ ios: 'checkmark.seal', android: 'verified' }}
        title="Review finished"
        text={rows.length ? 'Your saved answers are unchanged.' : 'Your saved answers are unchanged. Open Review again any time.'}
      />
    );
  }

  const tone = stats.accuracy === null ? null : toneOf(stats.accuracy);
  const verdictInk = tone ? { success: palette.successInk, warning: palette.warningInk, danger: palette.dangerInk }[tone] : palette.foreground;
  const met = stats.attempted + stats.skipped;
  // A long round can be narrowed to its mistakes, the same control as the self-assessment result.
  const filterable = rows.length > 5 && stats.wrong + stats.skipped > 0;
  const shown = filterable && show !== 'all' ? rows.filter((r) => r.outcome === show) : rows;

  return (
    <View style={styles.practice}>
      <Card style={styles.verdictCard}>
        <View accessible accessibilityRole="header" accessibilityLabel={`${verdict.title}. ${verdict.text}`}>
          <Text style={[styles.verdictTitle, { color: verdictInk }]}>{verdict.title}</Text>
          <Text style={[styles.verdictText, { color: palette.inkSoft }]}>{verdict.text}</Text>
        </View>

        {stats.accuracy !== null ? (
          <View
            style={styles.scoreRow}
            accessible
            accessibilityLabel={`${stats.correct} of ${stats.attempted} answered right, ${stats.accuracy} percent`}
          >
            <Text style={[styles.scoreBig, { color: palette.foreground }]}>
              {stats.correct}
              <Text style={[styles.scoreOf, { color: palette.mutedForeground }]}> / {stats.attempted}</Text>
            </Text>
            <View style={styles.scoreSide}>
              <Text style={[styles.scorePercent, { color: verdictInk }]}>{stats.accuracy}%</Text>
              <Text style={[styles.scoreCaption, { color: palette.mutedForeground }]}>of answered</Text>
            </View>
          </View>
        ) : null}

        {met ? (
          <>
            {/* Separate pills in the key's order, skipped drawn as an outline (not answered):
                told apart by place and shape, not only by colour. The key carries the numbers. */}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.strip}>
              {stats.correct ? <View style={[styles.pill, { flex: stats.correct, backgroundColor: palette.success }]} /> : null}
              {stats.wrong ? <View style={[styles.pill, { flex: stats.wrong, backgroundColor: palette.danger }]} /> : null}
              {stats.skipped ? <View style={[styles.pill, styles.pillOutline, { flex: stats.skipped, borderColor: palette.mutedForeground }]} /> : null}
            </View>
            <View style={styles.key}>
              {/* Right and wrong always count; "0 skipped" is only noise. */}
              {(stats.skipped ? (['correct', 'wrong', 'skipped'] as const) : (['correct', 'wrong'] as const)).map((o) => (
                <View key={o} style={styles.keyItem}>
                  <Icon name={OUTCOME[o].icon} color={ink[o]} size={15} />
                  <Text style={[styles.keyText, { color: palette.inkSoft }]}>
                    {o === 'correct' ? stats.correct : o === 'wrong' ? stats.wrong : stats.skipped} {OUTCOME[o].label.toLowerCase()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Card>

      {rows.length ? (
        <View style={styles.solution}>
          <SectionTitle title="Question by question" />
          {filterable ? (
            <Segmented
              label="Show questions"
              value={show}
              onChange={setShow}
              options={[
                { value: 'all', label: 'All', count: rows.length },
                { value: 'wrong', label: 'Wrong', count: stats.wrong },
                { value: 'skipped', label: 'Skipped', count: stats.skipped },
              ]}
            />
          ) : null}
          {shown.length ? (
            <Card style={styles.listCard}>
              {shown.map(({ index, question, outcome, selected }, i) => (
                <Pressable
                  key={question._id}
                  accessibilityRole="button"
                  accessibilityLabel={`Question ${numberOf(index)}${showTopic && question.topic ? `, ${question.topic}` : ''}: ${OUTCOME[outcome].label}. Open it again`}
                  onPress={() => onOpen(index)}
                  style={({ pressed }) => [
                    styles.qRow,
                    i < shown.length - 1 && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name={OUTCOME[outcome].icon} color={ink[outcome]} size={22} />
                  <View style={styles.flex}>
                    <Text style={[styles.qTitle, { color: palette.foreground }]} numberOfLines={2}>
                      Question {numberOf(index)}
                      {showTopic && question.topic ? <Text style={{ color: palette.mutedForeground, fontFamily: face.regular }}> · {question.topic}</Text> : null}
                    </Text>
                    <Text style={[styles.qMeta, { color: ink[outcome] }]}>
                      {outcome === 'wrong' && selected ? `Wrong · you chose ${selected}` : OUTCOME[outcome].label}
                    </Text>
                  </View>
                  <Text style={[styles.qAction, { color: palette.primaryInk }]}>{outcome === 'skipped' ? 'Answer' : 'Solution'}</Text>
                  <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={14} />
                </Pressable>
              ))}
            </Card>
          ) : (
            <Muted>{show === 'wrong' ? 'No wrong answers this round.' : 'Nothing skipped this round.'}</Muted>
          )}
        </View>
      ) : null}

      {mode === 'continue' ? (
        <Muted>{remaining ? `${remaining} question${remaining === 1 ? '' : 's'} left here. Your progress is saved, so you can carry on any time.` : 'You have attempted every question here.'}</Muted>
      ) : null}
      {mode === 'again' ? <Muted>Your latest answer to each question is the one saved.</Muted> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2 },
  pressed: { opacity: 0.7 },
  practice: { gap: 14 },
  path: { fontSize: 13, fontFamily: face.semibold },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, minWidth: 64 },
  navEnd: { justifyContent: 'flex-end' },
  navText: { fontSize: 15, fontFamily: face.bold, textDecorationLine: 'underline' },
  // Takes the space between Previous and End and wraps at large text sizes instead of colliding.
  count: { flex: 1, textAlign: 'center', fontSize: 15, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footerRow: { flexDirection: 'row', gap: 10 },
  solution: { gap: 8 },
  feedback: { gap: 14 },
  footerStack: { gap: 10 },
  listCard: { paddingVertical: 0 },
  verdictCard: { gap: 14, padding: 18 },
  verdictTitle: { fontSize: 24, lineHeight: 30, fontFamily: face.heavy },
  verdictText: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  scoreBig: { fontSize: 40, lineHeight: 46, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 20, fontFamily: face.semibold },
  scoreSide: { alignItems: 'flex-end', paddingBottom: 4 },
  scorePercent: { fontSize: 20, lineHeight: 24, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  scoreCaption: { fontSize: 13, lineHeight: 18 },
  strip: { flexDirection: 'row', height: 10, gap: 3 },
  pill: { borderRadius: Neo.radius.full, minWidth: 10 },
  pillOutline: { borderWidth: Neo.border.width },
  key: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyText: { fontSize: 13, lineHeight: 18, fontFamily: face.semibold, fontVariant: ['tabular-nums'] },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  qTitle: { fontSize: 15, lineHeight: 20, fontFamily: face.semibold },
  qMeta: { fontSize: 13, lineHeight: 18, fontFamily: face.semibold, marginTop: 1 },
  qAction: { fontSize: 15, fontFamily: face.semibold },
});
