import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailSheet,
  EmptyView,
  ErrorText,
  ErrorView,
  Icon,
  LoadingView,
  Muted,
  Notice,
  ProgressBar,
  Screen,
  SectionTitle,
  StatGrid,
  StatTile,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import { Explanation } from '@/components/explanation';
import { SUBJECTS_BY_TRACK, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { accuracyOf, canResume, resumePosition, sessionStats, toneOf, type PracticeResult } from '@/screens/student/practice-session';
import { QuestionView } from '@/screens/student/question-view';
import { studentApi, type PyqQuestion } from '@/services/student-api';

const ALL = '__all__';

type ChapterRow = { chapter: string; standard: string; questions: number; practised: number; correct: number };


/** Past-year questions: pick a subject and chapter, then practise one at a time. */
export function StudentPyqScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const subjects = SUBJECTS_BY_TRACK[user.track ?? 'General'];
  const [subject, setSubject] = useState<SchoolSubject>(subjects[0]);
  const [practising, setPractising] = useState<string | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.pyqChapters(subject), [subject, version]);

  const chapters = data?.chapters ?? [];
  const practised = chapters.reduce((n, c) => n + c.practised, 0);
  const correct = chapters.reduce((n, c) => n + c.correct, 0);
  const accuracy = accuracyOf(correct, practised);
  const standards = [...new Set(chapters.map((c) => c.standard))];

  return (
    <Screen title="PYQs" subtitle="Practise past-year exam questions" onRefresh={refresh} refreshing={refreshing}>
      <Chips choices={subjects} selected={subject} onChange={setSubject} />
      {loading ? (
        <LoadingView label={`Loading ${subject} questions…`} />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !chapters.length ? (
        <Card>
          <EmptyView icon={{ ios: 'clock.arrow.circlepath', android: 'history' }} title="No past-year questions yet" text={`There are no ${subject} past-year questions for your exam in the question bank yet.`} />
        </Card>
      ) : (
        <>
          <OverviewCard subject={subject} total={data!.total} practised={practised} accuracy={accuracy} onPractise={() => setPractising(ALL)} />
          {standards.map((standard) => {
            const rows = chapters.filter((c) => c.standard === standard);
            return (
              <View key={standard} style={styles.group}>
                <SectionTitle title={`${standard} · ${rows.length} chapter${rows.length === 1 ? '' : 's'}`} />
                <Card style={styles.listCard}>
                  {rows.map((c, i) => (
                    <ChapterItem key={`${c.standard}|${c.chapter}`} row={c} last={i === rows.length - 1} onPress={() => setPractising(c.chapter)} />
                  ))}
                </Card>
              </View>
            );
          })}
          <Muted>AI-made questions based on PYQs are coming later.</Muted>
        </>
      )}
      {practising ? (
        <PracticeSheet
          subject={subject}
          chapter={practising === ALL ? null : practising}
          onClose={() => {
            setPractising(null);
            bumpDataVersion();
          }}
        />
      ) : null}
    </Screen>
  );
}

function OverviewCard({ subject, total, practised, accuracy, onPractise }: { subject: string; total: number; practised: number; accuracy: number | null; onPractise: () => void }) {
  const palette = usePalette();
  const pct = total ? Math.min(100, (practised / total) * 100) : 0;
  return (
    <Card style={styles.overview}>
      <View style={styles.overviewTop}>
        <View style={[styles.tile, { backgroundColor: palette.primarySoft }]}>
          <Icon name={{ ios: 'clock.arrow.circlepath', android: 'history' }} color={palette.primary} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.overviewTitle, { color: palette.foreground }]}>{subject}</Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>
            {practised} of {total} practised{accuracy !== null ? ` · ${accuracy}% right` : ''}
          </Text>
        </View>
        {accuracy !== null ? <Badge label={`${accuracy}%`} tone={toneOf(accuracy)} /> : null}
      </View>
      <ProgressBar value={pct} tone="success" />
      <Button label={`Practise all ${total}`} icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={onPractise} />
    </Card>
  );
}

function ChapterItem({ row, last, onPress }: { row: ChapterRow; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const accuracy = accuracyOf(row.correct, row.practised);
  const done = row.questions > 0 && row.practised >= row.questions;
  const icon: IconName = done
    ? { ios: 'checkmark.circle.fill', android: 'check_circle' }
    : row.practised
    ? { ios: 'circle.lefthalf.filled', android: 'contrast' }
    : { ios: 'circle', android: 'radio_button_unchecked' };
  const status = row.practised ? `${row.practised} of ${row.questions} done, ${row.correct} right` : `${row.questions} questions, not started`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.chapter}, ${status}. Practise`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <Icon name={icon} color={done ? palette.success : row.practised ? palette.primary : palette.mutedForeground} size={20} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {row.chapter}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          {row.practised ? `${row.practised}/${row.questions} done` : `${row.questions} questions · not started`}
        </Text>
        {row.practised ? (
          <View style={styles.rowBar}>
            <ProgressBar value={(row.practised / Math.max(1, row.questions)) * 100} tone="success" />
          </View>
        ) : null}
      </View>
      {accuracy !== null ? <Badge label={`${accuracy}%`} tone={toneOf(accuracy)} /> : null}
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

// ─── Practising ────────────────────────────────────────────────────────────

/** A run through questions: the bank (loaded page by page), or a retry of this session's wrong ones. */
type Round = { kind: 'bank' } | { kind: 'retry'; questions: PyqQuestion[]; number: number };

/** Practising PYQs one at a time: the whole subject, or one chapter. Also opened from Home for a weak chapter. */
export function PracticeSheet({ subject, chapter, onClose }: { subject: SchoolSubject; chapter: string | null; onClose: () => void }) {
  const palette = usePalette();
  const [round, setRound] = useState<Round>({ kind: 'bank' });
  // The bank, page by page: the first page, then any more loaded on the way
  // (nextSkip null: no more pages).
  const first = useLoad(() => studentApi.pyq(subject, chapter, 0), [subject, chapter]);
  const [more, setMore] = useState<{ questions: PyqQuestion[]; total: number; nextSkip: number | null } | null>(null);
  const bank = [...(first.data?.questions ?? []), ...(more?.questions ?? [])];
  const bankTotal = more?.total ?? first.data?.total ?? 0;
  const nextSkip = more ? more.nextSkip : first.data ? first.data.nextSkip : null;
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pos, setPos] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string | null>>({});
  const [results, setResults] = useState<Record<string, PracticeResult>>({});
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [summary, setSummary] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  // Where the bank round got to, to carry on there after a retry.
  const [bankPos, setBankPos] = useState(0);

  /** Loads the bank's next page; resolves to how many questions came. */
  const loadMore = useCallback(async () => {
    if (nextSkip === null || loadingRef.current) return 0;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await studentApi.pyq(subject, chapter, nextSkip);
      setMore((prev) => ({ questions: [...(prev?.questions ?? []), ...page.questions], total: page.total, nextSkip: page.nextSkip }));
      return page.questions.length;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load questions.");
      return 0;
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [subject, chapter, nextSkip]);

  const list = round.kind === 'bank' ? bank : round.questions;
  const total = round.kind === 'bank' ? bankTotal : round.questions.length;
  const q: PyqQuestion | undefined = list[pos];
  const done = q ? results[q._id] : undefined;
  const selected = q ? (done ? done.selected : drafts[q._id] ?? null) : null;
  const atEnd = pos >= list.length - 1 && (round.kind === 'retry' || nextSkip === null);

  const stats = sessionStats(list, results, skipped);
  const wrongQuestions = stats.wrongQuestions;

  const check = async () => {
    if (!q || !selected) return setCheckError(q?.answerType === 'Numerical' ? 'Enter your answer.' : 'Pick an option.');
    setChecking(true);
    setCheckError(null);
    try {
      const r = await studentApi.answerPyq(q._id, selected);
      setResults((prev) => ({ ...prev, [q._id]: { correct: r.correct, selected: r.selected } }));
      setSkipped((prev) => {
        const next = new Set(prev);
        next.delete(q._id);
        return next;
      });
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Couldn't check that.");
    } finally {
      setChecking(false);
    }
  };

  const next = async () => {
    setCheckError(null);
    if (pos < list.length - 1) return setPos((p) => p + 1);
    if (round.kind === 'bank' && nextSkip !== null) {
      if ((await loadMore()) > 0) setPos((p) => p + 1);
      return;
    }
    setSummary(true);
  };

  const skip = () => {
    if (q && !done) setSkipped((prev) => new Set(prev).add(q._id));
    void next();
  };

  const startRetry = () => {
    const questions = wrongQuestions;
    if (round.kind === 'bank') setBankPos(pos);
    setRound((r) => ({ kind: 'retry', questions, number: r.kind === 'retry' ? r.number + 1 : 1 }));
    setPos(0);
    setDrafts({});
    setResults({});
    setSkipped(new Set());
    setCheckError(null);
    setSummary(false);
  };

  const keepPractising = () => {
    // Back to the bank, after the questions already seen.
    const resume = resumePosition(round.kind === 'bank' ? pos : bankPos, bank.length);
    setRound({ kind: 'bank' });
    setSummary(false);
    if (resume < bank.length) setPos(resume);
    else void loadMore().then((n) => n > 0 && setPos(resume));
  };

  const title = round.kind === 'retry' ? `Retry · ${chapter ?? subject}` : chapter ?? `${subject} PYQs`;
  const firstLoad = round.kind === 'bank' && !first.data;

  return (
    <DetailSheet
      visible
      title={summary ? 'Session summary' : title}
      onClose={onClose}
      footer={
        summary || !q ? undefined : (
          <>
            <ErrorText message={checkError ?? loadError} />
            {done ? (
              <Button label={atEnd ? 'See summary' : 'Next question'} icon={atEnd ? { ios: 'chart.bar', android: 'bar_chart' } : undefined} onPress={() => void next()} loading={loadingMore} />
            ) : (
              <View style={styles.footerRow}>
                <Button label={atEnd ? 'Skip & finish' : 'Skip'} variant="secondary" onPress={skip} disabled={loadingMore} style={styles.flex} />
                <Button label="Check answer" onPress={check} loading={checking} disabled={!selected} style={styles.flex2} />
              </View>
            )}
          </>
        )
      }
    >
      {summary ? (
        <SessionSummary
          stats={stats}
          retryNumber={round.kind === 'retry' ? round.number : 0}
          canContinue={canResume(round.kind === 'bank' ? pos : bankPos, bank.length, nextSkip !== null)}
          onRetry={startRetry}
          onContinue={keepPractising}
          onDone={onClose}
        />
      ) : firstLoad && first.error ? (
        <ErrorView message={first.error} onRetry={first.reload} />
      ) : firstLoad ? (
        <LoadingView label="Loading questions…" />
      ) : !q ? (
        <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="No questions here" text="Pick another chapter or subject." />
      ) : (
        <View style={styles.practice}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              disabled={pos === 0}
              onPress={() => {
                setCheckError(null);
                setPos((p) => Math.max(0, p - 1));
              }}
              style={({ pressed }) => [styles.navButton, { opacity: pos === 0 ? 0.35 : pressed ? 0.6 : 1 }]}
            >
              <Icon name={{ ios: 'chevron.left', android: 'chevron_left' }} color={palette.primary} size={16} />
              <Text style={[styles.navText, { color: palette.primary }]}>Previous</Text>
            </Pressable>
            <Text style={[styles.count, { color: palette.foreground }]}>
              {pos + 1} <Text style={{ color: palette.mutedForeground }}>of {total}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End session and see summary"
              onPress={() => setSummary(true)}
              style={({ pressed }) => [styles.navButton, styles.navEnd, pressed && styles.pressed]}
            >
              <Text style={[styles.navText, { color: palette.primary }]}>End</Text>
            </Pressable>
          </View>
          <ProgressBar value={((pos + 1) / Math.max(1, total)) * 100} />
          <View style={styles.badges}>
            {stats.attempted ? <Badge label={`${stats.correct}/${stats.attempted} right this session`} tone="primary" /> : null}
            {round.kind === 'retry' ? <Badge label="Retrying wrong answers" tone="warning" /> : null}
            {q.source ? <Badge label={q.source} tone="violet" /> : null}
            {q.mine && !done ? <Badge label={q.mine.correct ? 'You got this right before' : 'You got this wrong before'} tone={q.mine.correct ? 'success' : 'warning'} /> : null}
          </View>

          <Card>
            <QuestionView
              // The solution gets its own card below, open, once checked.
              question={{ ...q, explanation: '' }}
              selected={selected}
              onSelect={done ? undefined : (value) => setDrafts((d) => ({ ...d, [q._id]: value }))}
              reveal={!!done}
              numberLabel={q.topic ? `${q.chapter} · ${q.topic}` : q.chapter}
            />
          </Card>

          {done ? (
            // Right or wrong with an icon and words, not colour alone.
            <Notice tone={done.correct ? 'success' : 'danger'} title={done.correct ? 'Correct!' : 'Not quite'} text={done.correct ? undefined : `The answer is ${q.correctAnswer}.`} live />
          ) : null}
          {done && q.explanation ? (
            <View style={styles.solution}>
              <SectionTitle title="Solution" />
              <Explanation text={q.explanation} correctAnswer={q.answerType === 'Numerical' ? undefined : q.correctAnswer} diagramUrls={q.explanationDiagramUrls} defaultCollapsed={false} />
            </View>
          ) : null}
        </View>
      )}
    </DetailSheet>
  );
}

function SessionSummary({
  stats,
  retryNumber,
  canContinue,
  onRetry,
  onContinue,
  onDone,
}: {
  stats: ReturnType<typeof sessionStats<PyqQuestion>>;
  retryNumber: number;
  canContinue: boolean;
  onRetry: () => void;
  onContinue: () => void;
  onDone: () => void;
}) {
  const palette = usePalette();
  const { attempted: answered, correct: right, wrong, skipped, accuracy, wrongQuestions } = stats;
  const topics = [...new Set(wrongQuestions.map((q) => (q.topic ? `${q.chapter} · ${q.topic}` : q.chapter)))];

  return (
    <View style={styles.practice}>
      <Card style={styles.summaryCard}>
        <Text style={[styles.summaryLabel, { color: palette.mutedForeground }]}>{retryNumber ? `Retry ${retryNumber} · accuracy` : 'Accuracy this session'}</Text>
        {accuracy !== null ? (
          <View style={styles.summaryRow} accessible accessibilityLabel={`${accuracy} percent: ${right} right of ${answered} answered`}>
            <Text style={[styles.summaryBig, { color: palette.foreground }]}>{accuracy}%</Text>
            <Badge label={`${right} of ${answered} right`} tone={toneOf(accuracy)} />
          </View>
        ) : (
          <Text style={[styles.summaryEmpty, { color: palette.foreground }]}>You didn&apos;t answer any questions.</Text>
        )}
      </Card>
      <StatGrid>
        <StatTile label="Attempted" value={answered} icon={{ ios: 'pencil.and.list.clipboard', android: 'edit_note' }} />
        <StatTile label="Correct" value={right} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
        <StatTile label="Wrong" value={wrong} icon={{ ios: 'xmark.circle', android: 'cancel' }} tone="danger" />
      </StatGrid>
      {skipped ? <Muted>{skipped} skipped. Skipped questions don&apos;t count towards accuracy.</Muted> : null}

      {topics.length ? (
        <>
          <SectionTitle title="Worth revising" />
          <Card style={styles.listCard}>
            {topics.map((t, i) => (
              <View key={t} style={[styles.topic, i < topics.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
                <Icon name={{ ios: 'arrow.uturn.backward.circle', android: 'replay' }} color={palette.mutedForeground} size={16} />
                <Text style={[styles.topicText, { color: palette.foreground }]}>{t}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.actions}>
        {wrongQuestions.length ? (
          <Button label={`Retry ${wrongQuestions.length} incorrect`} icon={{ ios: 'arrow.counterclockwise', android: 'replay' }} onPress={onRetry} />
        ) : null}
        {canContinue ? <Button label="Keep practising" variant={wrongQuestions.length ? 'secondary' : 'primary'} onPress={onContinue} /> : null}
        <Button label="Done" variant="secondary" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2 },
  pressed: { opacity: 0.7 },
  group: { gap: 8 },
  listCard: { paddingVertical: 0 },
  overview: { gap: 12, padding: 16 },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overviewTitle: { fontSize: 17, fontWeight: '700' },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 60 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowBar: { marginTop: 6 },
  practice: { gap: 14 },
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
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 44 },
  topicText: { flex: 1, fontSize: 14 },
  actions: { gap: 10, marginTop: 4 },
});
