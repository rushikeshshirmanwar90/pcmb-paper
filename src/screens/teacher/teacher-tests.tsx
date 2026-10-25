import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { QuestionSetFlow } from '@/components/create-exam-modal';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailRow,
  DetailSheet,
  EmptyView,
  ErrorText,
  ErrorView,
  Field,
  FormSheet,
  ListRow,
  LoadingView,
  Muted,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { TestAnalysisSection } from '@/screens/teacher/test-analysis';
import { dateTimeLabel, schoolApi, type TestStatus, type TestSummary } from '@/services/school-api';

export const STATUS_BADGE: Record<TestStatus, { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  scheduled: { label: 'Scheduled', tone: 'warning' },
  open: { label: 'Open', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const ALL = 'all';

/** The teacher's Test Room: set a test for a batch, and see past tests and results. */
export function TeacherTestsScreen() {
  const version = useDataVersion();
  const [batchFilter, setBatchFilter] = useState(ALL);
  const overview = useLoad(() => schoolApi.teacherOverview(), [version]);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.tests(batchFilter === ALL ? undefined : batchFilter), [batchFilter, version]);
  const [setting, setSetting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const batches = overview.data?.batches ?? [];

  return (
    <Screen title="Test Room" subtitle="Set tests for your batches and see results" onRefresh={refresh} refreshing={refreshing}>
      <Button label="New test" icon={{ ios: 'plus', android: 'add' }} onPress={() => setSetting(true)} disabled={!batches.length} />
      {overview.data && !batches.length ? <Muted>You can set tests once your tuition assigns you to a batch.</Muted> : null}
      {batches.length > 1 ? (
        <Chips
          choices={[ALL, ...batches.map((b) => b.id)]}
          selected={batchFilter}
          onChange={setBatchFilter}
          labels={Object.fromEntries([[ALL, 'All batches'], ...batches.map((b) => [b.id, b.name])])}
        />
      ) : null}

      <SectionTitle title="Tests" />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Card>
          <EmptyView icon={{ ios: 'list.clipboard', android: 'assignment' }} title="No tests yet" text="Set a test for a batch; its students take it in the app and you see their results here." />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {data.map((t, i) => (
            <ListRow
              key={t.id}
              icon={{ ios: 'list.clipboard', android: 'assignment' }}
              title={t.title}
              subtitle={`${t.batch.name} · ${t.questionCount} Q · ${t.durationMinutes} min · ${t.status === 'scheduled' ? `opens ${dateTimeLabel(t.opensAt)}` : `${t.submitted}/${t.batchStudents} submitted`}`}
              right={<Badge label={STATUS_BADGE[t.status].label} tone={STATUS_BADGE[t.status].tone} />}
              onPress={() => setOpenId(t.id)}
              last={i === data.length - 1}
            />
          ))}
        </Card>
      )}

      <NewTestFlow visible={setting} onClose={() => setSetting(false)} batches={batches.map((b) => ({ id: b.id, name: b.name }))} onCreated={(id) => setOpenId(id)} />
      {openId ? <TestDetail id={openId} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

// ─── Setting a test: details, then the question picker ─────────────────────

const OPENS = ['now', 'later'] as const;
const CLOSES = ['manual', '1', '3', '7'] as const;
const CLOSE_LABELS = { manual: 'When I close it', '1': 'After 1 day', '3': 'After 3 days', '7': 'After 7 days' };
const NEGATIVE = ['0', '1'] as const;

/** "2026-10-27" and "09:30" → a Date in the phone's time zone; null if not valid. */
function parseLocal(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const value = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(value.getTime()) ? null : value;
}

function NewTestFlow({ visible, onClose, batches, onCreated }: { visible: boolean; onClose: () => void; batches: { id: string; name: string }[]; onCreated: (id: string) => void }) {
  const palette = usePalette();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('60');
  const [negative, setNegative] = useState<(typeof NEGATIVE)[number]>('0');
  const [opens, setOpens] = useState<(typeof OPENS)[number]>('now');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [closes, setCloses] = useState<(typeof CLOSES)[number]>('manual');
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setBatchId(batches[0]?.id ?? null);
      setMinutes('60');
      setNegative('0');
      setOpens('now');
      setDate('');
      setTime('');
      setCloses('manual');
      setError(null);
      setPicking(false);
    }
  }

  const settings = () => {
    const duration = Number(minutes);
    if (!batchId) return null;
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) return null;
    const opensAt = opens === 'now' ? new Date() : parseLocal(date, time);
    if (!opensAt) return null;
    const closesAt = closes === 'manual' ? null : new Date(opensAt.getTime() + Number(closes) * 86400000);
    return { batchId, durationMinutes: duration, negativeMarks: Number(negative), opensAt, closesAt };
  };

  const next = () => {
    if (!batchId) return setError('Pick a batch.');
    const duration = Number(minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) return setError('The time limit must be 1 to 600 minutes.');
    if (opens === 'later' && !parseLocal(date, time)) return setError('Enter the date as 2026-10-27 and the time as 09:30.');
    setError(null);
    setPicking(true);
  };

  return (
    <>
      <FormSheet visible={visible && !picking} title="New test" onClose={onClose} submitLabel="Next: pick questions" onSubmit={next} error={error}>
        <Chips label="Batch" choices={batches.map((b) => b.id)} selected={batchId} onChange={setBatchId} labels={Object.fromEntries(batches.map((b) => [b.id, b.name]))} />
        <Field label="Time limit (minutes)" value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
        <Chips label="Wrong answers" choices={NEGATIVE} selected={negative} onChange={setNegative} labels={{ '0': 'No negative marks', '1': '−1 mark (NEET/JEE style)' }} />
        <Chips label="Opens" choices={OPENS} selected={opens} onChange={setOpens} labels={{ now: 'Now', later: 'At a set time' }} />
        {opens === 'later' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-10-27" keyboardType="numbers-and-punctuation" maxLength={10} />
            </View>
            <View style={styles.flex}>
              <Field label="Time" value={time} onChangeText={setTime} placeholder="09:30" keyboardType="numbers-and-punctuation" maxLength={5} />
            </View>
          </View>
        ) : null}
        <Chips label="Closes" choices={CLOSES} selected={closes} onChange={setCloses} labels={CLOSE_LABELS} />
        <Muted>Each question carries 4 marks. Next you pick the class, chapters and questions.</Muted>
      </FormSheet>

      <Modal visible={visible && picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: palette.background }]}>
          <View style={styles.flex}>
            <QuestionSetFlow
              purpose="room"
              onClose={() => setPicking(false)}
              onSubmitTest={async ({ title, standard, subject, questions }) => {
                const s = settings();
                if (!s) throw new Error('Go back and check the test settings.');
                const test = await schoolApi.createTest({
                  ...s,
                  opensAt: s.opensAt.toISOString(),
                  closesAt: s.closesAt ? s.closesAt.toISOString() : null,
                  title,
                  standard,
                  subject,
                  marksPerQuestion: 4,
                  questions,
                });
                bumpDataVersion();
                onClose();
                onCreated(test.id);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── A test's details and results ──────────────────────────────────────────

function TestDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.test(id), [id, version]);
  const [actionError, setActionError] = useState<string | null>(null);
  const test: TestSummary | undefined = data?.test;

  const act = async (action: () => Promise<unknown>, after?: () => void) => {
    setActionError(null);
    try {
      await action();
      bumpDataVersion();
      after?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const closeNow = () =>
    test && confirmAction('Close this test now?', 'Students who haven\'t submitted can\'t start or finish it any more.', 'Close test', () => act(() => schoolApi.updateTest(test.id, { closeNow: true })));
  const remove = () =>
    test && confirmAction(`Delete "${test.title}"?`, 'The test and every student\'s result are deleted. This cannot be undone.', 'Delete', () => act(() => schoolApi.deleteTest(test.id), onClose));

  return (
    <DetailSheet
      visible
      title={test?.title ?? 'Test'}
      onClose={onClose}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        data?.canEdit && test ? (
          <View style={styles.row}>
            <Button label="Delete" variant="danger" onPress={remove} style={styles.flex} />
            {test.status !== 'closed' ? <Button label="Close now" onPress={closeNow} style={styles.flex2} /> : null}
          </View>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data && test ? (
        <>
          <ErrorText message={actionError} />
          <Card>
            <View style={styles.badges}>
              <Badge label={STATUS_BADGE[test.status].label} tone={STATUS_BADGE[test.status].tone} />
              {test.subject ? <Badge label={test.subject} tone="violet" /> : null}
            </View>
            <DetailRow label="Batch" value={test.batch.name} />
            <DetailRow label="Questions" value={`${test.questionCount} · ${test.maxScore} marks`} />
            <DetailRow label="Wrong answers" value={test.negativeMarks ? `−${test.negativeMarks}` : 'No negative marks'} />
            <DetailRow label="Time limit" value={`${test.durationMinutes} min`} />
            <DetailRow label="Opens" value={dateTimeLabel(test.opensAt)} />
            <DetailRow label="Closes" value={test.closesAt ? dateTimeLabel(test.closesAt) : 'When the teacher closes it'} />
            <DetailRow label="Set by" value={test.teacher.name} />
          </Card>

          <SectionTitle title={`Results · ${test.submitted}/${test.batchStudents} submitted`} />
          {test.averageScore !== null ? (
            <Muted>
              Average {test.averageScore} of {test.maxScore}
            </Muted>
          ) : null}
          {data.results.length ? (
            <Card style={styles.listCard}>
              {data.results.map((r, i) => (
                <ListRow
                  key={r.student.id}
                  title={r.student.name}
                  subtitle={
                    r.state === 'submitted'
                      ? `${r.correct} right · ${r.wrong} wrong · ${r.skipped} skipped · ${Math.round(r.timeTakenSeconds / 60)} min`
                      : r.state === 'in-progress'
                      ? 'Taking it now'
                      : 'Not taken yet'
                  }
                  right={
                    r.score !== null ? (
                      <Text style={[styles.score, { color: palette.foreground }]}>
                        {r.score}/{test.maxScore}
                      </Text>
                    ) : undefined
                  }
                  last={i === data.results.length - 1}
                />
              ))}
            </Card>
          ) : (
            <Muted>No students in this batch.</Muted>
          )}

          <TestAnalysisSection testId={test.id} submitted={test.submitted} />
        </>
      ) : null}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  row: { flexDirection: 'row', gap: 10 },
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
