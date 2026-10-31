import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Card,
  DetailSheet,
  EmptyView,
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
} from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import { StudentInsightSheet } from '@/screens/teacher/student-insight';
import { TestAnalysisSection } from '@/screens/teacher/test-analysis';
import { ALL, groupTests, participation, plural, TEST_STATUS_LABEL, testCounts } from '@/screens/tuition/admin-filters';
import { Avatar, FilterRow, InfoRow } from '@/screens/tuition/admin-ui';
import { dateTimeLabel, schoolApi, type TestResultRow, type TestStatus, type TestSummary } from '@/services/school-api';
import { tuitionApi } from '@/services/tuition-api';

/** The server lists at most this many tests per request, newest first. */
const SERVER_LIMIT = 200;

const STATUS_TONE: Record<TestStatus, 'success' | 'warning' | 'neutral'> = { open: 'success', scheduled: 'warning', closed: 'neutral' };

type StatusFilter = TestStatus | typeof ALL;

/** When the test opens, closes or closed, in one line. */
function whenLine(t: TestSummary) {
  if (t.status === 'scheduled') return `Opens ${dateTimeLabel(t.opensAt)}${t.closesAt ? ` · closes ${dateTimeLabel(t.closesAt)}` : ''}`;
  if (t.status === 'open') return t.closesAt ? `Closes ${dateTimeLabel(t.closesAt)}` : `Opened ${dateTimeLabel(t.opensAt)} · open until the teacher closes it`;
  return `Ended ${dateTimeLabel(t.closesAt ?? t.opensAt)}`;
}

/**
 * Every test in the tuition's batches, by state (active, upcoming, ended),
 * with how many students took each. View-only: teachers set and manage
 * tests in their Test Room.
 */
export function TuitionTestsScreen() {
  const version = useDataVersion();
  const [batch, setBatch] = useState<string>(ALL);
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const batches = useLoad(() => tuitionApi.batches(), [version]);
  // The server narrows by batch (it lists at most 200); the state filter is applied here.
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.tests(batch === ALL ? undefined : batch), [batch, version]);
  const tests = data ?? [];
  const counts = testCounts(tests);
  const groups = groupTests(tests, status);
  const batchList = batches.data ?? [];
  // A batch filter for a batch that was deleted falls back to All.
  if (batch !== ALL && batches.data && !batchList.some((b) => b.id === batch)) setBatch(ALL);

  const statusOptions = [
    { value: ALL, label: 'All', count: tests.length },
    { value: 'open', label: TEST_STATUS_LABEL.open, count: counts.open },
    { value: 'scheduled', label: TEST_STATUS_LABEL.scheduled, count: counts.scheduled },
    { value: 'closed', label: TEST_STATUS_LABEL.closed, count: counts.closed },
  ] as { value: StatusFilter; label: string; count: number }[];
  const batchOptions = [{ value: ALL, label: 'All' }, ...batchList.map((b) => ({ value: b.id, label: b.name }))];
  const filtered = status !== ALL || batch !== ALL;

  return (
    <Screen
      title="Tests"
      subtitle="Every test in your batches, with results"
      onRefresh={() => {
        refresh();
        batches.reload();
      }}
      refreshing={refreshing}
    >
      <View style={styles.filters}>
        <FilterRow label="Status" options={statusOptions} value={status} onChange={setStatus} />
        {batchList.length > 1 ? <FilterRow label="Batch" options={batchOptions} value={batch} onChange={setBatch} /> : null}
      </View>

      {loading ? (
        <LoadingView label="Loading tests…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the tests. ${error}`} onRetry={reload} />
      ) : (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          {tests.length >= SERVER_LIMIT ? <Muted>Showing the newest {SERVER_LIMIT} tests. Pick a batch to see older ones.</Muted> : null}
          {!groups.length ? (
            <Card>
              <EmptyView
                icon={{ ios: 'list.clipboard', android: 'assignment' }}
                title={!tests.length ? (batch === ALL ? 'No tests yet' : 'No tests for this batch') : `No ${TEST_STATUS_LABEL[status as TestStatus].toLowerCase()} tests`}
                text={
                  !tests.length
                    ? 'Teachers set tests for their batches from their Test Room. They show here with every student’s result.'
                    : 'Try another status or batch.'
                }
              />
            </Card>
          ) : (
            groups.map((g) => (
              <View key={g.status} style={styles.group}>
                <SectionTitle title={`${TEST_STATUS_LABEL[g.status]} (${g.tests.length})`} />
                <Card style={styles.listCard}>
                  {g.tests.map((t, i) => (
                    <TestRow key={t.id} test={t} onPress={() => setOpenId(t.id)} last={i === g.tests.length - 1} />
                  ))}
                </Card>
              </View>
            ))
          )}
          {tests.length > 0 && !filtered ? <Muted>View-only. Teachers set, change and close tests from their Test Room.</Muted> : null}
        </>
      )}

      {openId ? <TestDetailSheet id={openId} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

/** A test in the list: title, batch and subject, when, and how many submitted. */
function TestRow({ test: t, onPress, last }: { test: TestSummary; onPress: () => void; last: boolean }) {
  const palette = usePalette();
  const p = participation(t);
  const where = [t.batch.name || 'Batch removed', t.subject, t.standard].filter(Boolean).join(' · ');
  const taken = t.status === 'scheduled' ? `${plural(t.batchStudents, 'student')} in the batch` : `${p.submitted} of ${p.total} submitted`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${TEST_STATUS_LABEL[t.status]}. ${where}. ${whenLine(t)}. ${taken}${t.averageScore !== null ? `, average ${t.averageScore} of ${t.maxScore}` : ''}`}
      accessibilityHint="Opens the test's results"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: palette.foreground }]} numberOfLines={2}>
            {t.title}
          </Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
            {where}
          </Text>
        </View>
        <Badge label={TEST_STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
      </View>
      <View style={styles.whenRow}>
        <Icon name={{ ios: 'calendar', android: 'event' }} color={palette.mutedForeground} size={14} />
        <Text style={[styles.meta, styles.flex, { color: palette.mutedForeground }]} numberOfLines={2}>
          {whenLine(t)}
        </Text>
      </View>
      {t.status === 'scheduled' ? (
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          {taken} · {plural(t.questionCount, 'question')} · {t.durationMinutes} min
        </Text>
      ) : (
        <View style={styles.participation}>
          <View style={styles.between}>
            <Text style={[styles.taken, { color: palette.foreground }]}>{taken}</Text>
            {t.averageScore !== null ? (
              <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                Avg {t.averageScore}/{t.maxScore}
              </Text>
            ) : null}
          </View>
          <ProgressBar value={p.percent} tone={t.status === 'closed' ? 'success' : 'primary'} />
        </View>
      )}
    </Pressable>
  );
}

/** A test's details, participation, every student's result and the analysis. No editing. */
function TestDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.test(id), [id, version]);
  const [insightFor, setInsightFor] = useState<string | null>(null);
  const test = data?.test;
  const results = data?.results ?? [];
  const taking = results.filter((r) => r.state === 'in-progress').length;
  const notTaken = results.filter((r) => r.state === 'not-started').length;

  return (
    <DetailSheet visible title={test?.title ?? 'Test'} onClose={onClose} onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView label="Loading the test…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the test. ${error}`} onRetry={reload} />
      ) : test ? (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          <Card style={styles.listCard}>
            <View style={[styles.badges, { borderBottomColor: palette.border }]}>
              <Badge label={TEST_STATUS_LABEL[test.status]} tone={STATUS_TONE[test.status]} />
              {test.subject ? <Badge label={test.subject} tone="violet" /> : null}
              {test.standard ? <Badge label={test.standard} /> : null}
            </View>
            <InfoRow icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} label="Batch" value={test.batch.name || 'Batch removed'} />
            <InfoRow icon={{ ios: 'person.crop.rectangle', android: 'co_present' }} label="Set by" value={test.teacher.name} />
            <InfoRow
              icon={{ ios: 'list.number', android: 'format_list_numbered' }}
              label="Questions"
              value={`${plural(test.questionCount, 'question')} · ${test.maxScore} marks · +${test.marksPerQuestion} right, ${test.negativeMarks ? `−${test.negativeMarks} wrong` : 'no negative marks'}`}
            />
            <InfoRow icon={{ ios: 'timer', android: 'timer' }} label="Time limit" value={`${test.durationMinutes} min`} />
            <InfoRow icon={{ ios: 'calendar', android: 'event' }} label="Opens" value={dateTimeLabel(test.opensAt)} />
            <InfoRow
              icon={{ ios: 'calendar.badge.clock', android: 'event_busy' }}
              label={test.status === 'closed' ? 'Ended' : 'Closes'}
              value={test.closesAt ? dateTimeLabel(test.closesAt) : 'When the teacher closes it'}
              last
            />
          </Card>

          <SectionTitle title="Participation" />
          <StatGrid>
            <StatTile label="Submitted" value={`${test.submitted}/${test.batchStudents}`} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
            <StatTile label="Average" value={test.averageScore !== null ? `${test.averageScore}/${test.maxScore}` : '–'} icon={{ ios: 'chart.bar', android: 'bar_chart' }} />
            {test.status === 'open' ? (
              <StatTile label="Taking now" value={taking} icon={{ ios: 'pencil.and.outline', android: 'edit_note' }} tone="warning" />
            ) : (
              <StatTile label="Didn't take it" value={test.status === 'scheduled' ? '–' : notTaken} icon={{ ios: 'person.fill.xmark', android: 'person_off' }} tone="neutral" />
            )}
          </StatGrid>

          <SectionTitle title="Student results" />
          {test.status === 'scheduled' ? (
            <Card>
              <Muted>Results show once the test opens on {dateTimeLabel(test.opensAt)}.</Muted>
            </Card>
          ) : results.length ? (
            <Card style={styles.listCard}>
              {results.map((r, i) => (
                <ResultRow key={r.student.id} result={r} test={test} onPress={() => setInsightFor(r.student.id)} last={i === results.length - 1} />
              ))}
            </Card>
          ) : (
            <Card>
              <Muted>No students in this batch.</Muted>
            </Card>
          )}

          <TestAnalysisSection testId={test.id} submitted={test.submitted} />
          <Muted>View-only. The teacher who set this test can change or close it from their Test Room.</Muted>
        </>
      ) : null}
      {insightFor ? <StudentInsightSheet studentId={insightFor} onClose={() => setInsightFor(null)} /> : null}
    </DetailSheet>
  );
}

/** One student's result: score, right/wrong/skipped and time, or where they are. Opens their performance. */
function ResultRow({ result: r, test, onPress, last }: { result: TestResultRow; test: TestSummary; onPress: () => void; last: boolean }) {
  const palette = usePalette();
  const submitted = r.state === 'submitted';
  const detail = submitted
    ? `${r.correct} right · ${r.wrong} wrong · ${r.skipped} skipped · ${Math.round(r.timeTakenSeconds / 60)} min`
    : r.state === 'in-progress'
      ? 'Taking it now'
      : test.status === 'closed'
        ? "Didn't take it"
        : 'Not taken yet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.student.name}: ${submitted ? `${r.score} of ${test.maxScore}. ` : ''}${detail}`}
      accessibilityHint="Opens the student's performance"
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <Avatar name={r.student.name} size={34} muted={!submitted} />
      <View style={styles.flex}>
        <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
          {r.student.name}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {r.score !== null ? (
        <Text style={[styles.score, { color: palette.foreground }]}>
          {r.score}/{test.maxScore}
        </Text>
      ) : (
        <Badge label={r.state === 'in-progress' ? 'In progress' : 'Not taken'} tone={r.state === 'in-progress' ? 'warning' : 'neutral'} />
      )}
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  filters: { gap: 8 },
  group: { gap: 8 },
  listCard: { paddingVertical: 0 },
  row: { paddingVertical: 12, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { fontSize: 13, lineHeight: 18 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participation: { gap: 6 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  taken: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56 },
  name: { fontSize: 15, fontWeight: '600' },
  score: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
