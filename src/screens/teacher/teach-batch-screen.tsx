import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Badge, Button, Card, EmptyView, ErrorView, Icon, ListRow, Muted, SectionTitle, Segmented, useLoad, usePalette } from '@/components/kit';
import { SubjectChips } from '@/components/subject-chips';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { StackScreen } from '@/components/stack-screen';
import { PROGRAM_LABELS, programOf } from '@/constants/school';
import { useDataVersion } from '@/context/data-version';
import { BatchAnalysisSection } from '@/screens/shared/batch-analysis';
import { SyllabusProgressView } from '@/screens/shared/syllabus-progress';
import { dateTimeLabel, dayLabel, schoolApi, type TestSummary } from '@/services/school-api';
import { describeSchedule } from '@/services/tuition-api';

type BatchViewKey = 'syllabus' | 'students' | 'tests';
/** The view each batch was last left on (this session), so coming back lands there. */
const lastView = new Map<string, BatchViewKey>();

const VIEWS: { value: BatchViewKey; label: string }[] = [
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'students', label: 'Students' },
  { value: 'tests', label: 'Tests' },
];

/**
 * One batch a teacher teaches, as a page (it was a sheet holding further
 * sheets): who and when at the top, then three views of the batch: Syllabus
 * (tick what was covered, right here), Students (their analysis) and Tests
 * (this batch's tests, and Set a test with the batch already picked).
 * Room for a fourth view, Engagement, in Phase 5.
 */
export function TeachBatchScreen({ batchId }: { batchId: string }) {
  const palette = usePalette();
  const version = useDataVersion();
  const [view, setViewState] = useState<BatchViewKey>(() => lastView.get(batchId) ?? 'syllabus');
  const setView = (v: BatchViewKey) => {
    lastView.set(batchId, v);
    setViewState(v);
  };
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => Promise.all([schoolApi.batch(batchId), schoolApi.progress(batchId)]), [batchId, version]);
  const [batchView, progress] = data ?? [null, null];
  const batch = batchView?.batch;

  return (
    <StackScreen title={batch?.name ?? 'Batch'} subtitle={batchView ? `You teach ${batchView.mySubjects.join(', ') || 'no subject here'}` : undefined} onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <SkeletonCard rows={3} label="the batch" />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : batch && batchView && progress ? (
        <>
          {error ? <StaleNotice message={error} onRetry={reload} /> : null}
          <Card>
            <View style={styles.badges}>
              <Badge label={PROGRAM_LABELS[programOf(batch) ?? 'GENERAL']} tone="primary" />
              <Badge label={batch.standard ?? '11th & 12th'} />
              <Badge label={`${batch.studentCount} student${batch.studentCount === 1 ? '' : 's'}`} />
            </View>
            <Text style={[styles.schedule, { color: palette.foreground }]}>{describeSchedule(batch.schedule)}</Text>
            {batch.venue ? <Muted>{batch.venue}</Muted> : null}
          </Card>

          <Segmented label="Batch view" value={view} onChange={setView} options={VIEWS} />

          {view === 'syllabus' ? (
            batchView.mySubjects.length ? (
              <>
                <SyllabusProgressView batchId={batch.id} subjects={batchView.mySubjects} editable />
                <SectionTitle title="Recently covered" />
                {progress.recent.length ? (
                  <Card style={styles.listCard}>
                    {progress.recent.slice(0, 8).map((p, i, list) => (
                      <ListRow key={p.id} title={p.topic || p.chapter} subtitle={`${p.subject} · ${p.topic ? `${p.chapter} · ` : ''}${dayLabel(p.coveredOn)}${p.teacher ? ` · ${p.teacher}` : ''}`} last={i === list.length - 1} />
                    ))}
                  </Card>
                ) : (
                  <Muted>No topics marked yet.</Muted>
                )}
              </>
            ) : (
              <Muted>You don&apos;t teach a subject in this batch, so there&apos;s nothing to mark.</Muted>
            )
          ) : view === 'students' ? (
            <BatchAnalysisSection batchId={batch.id} />
          ) : (
            <BatchTests batchId={batch.id} />
          )}
        </>
      ) : null}
    </StackScreen>
  );
}

const STATUS: Record<TestSummary['status'], string> = { scheduled: 'Scheduled', open: 'Live', closed: 'Closed' };

function BatchTests({ batchId }: { batchId: string }) {
  const router = useRouter();
  const version = useDataVersion();
  const tests = useLoad(() => schoolApi.tests(batchId), [batchId, version]);
  const list = tests.data ?? [];
  const setTest = (
    <Button label="Set a test" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push(`/create-test?batchId=${encodeURIComponent(batchId)}` as Href)} />
  );
  if (tests.loading) return <SkeletonCard rows={3} label="this batch's tests" />;
  if (tests.error && !tests.data) return <ErrorView message={tests.error} onRetry={tests.reload} />;
  return (
    <>
      {tests.error ? <StaleNotice message={tests.error} onRetry={tests.reload} /> : null}
      {setTest}
      {list.length ? (
        <Card style={styles.listCard}>
          {list.map((t, i) => (
            <TestRow key={t.id} test={t} last={i === list.length - 1} onPress={() => router.push({ pathname: '/test/[testId]', params: { testId: t.id } } as Href)} />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyView icon={{ ios: 'list.clipboard', android: 'assignment' }} title="No tests yet" text="Tests you set for this batch show here." />
        </Card>
      )}
    </>
  );
}

/** One test: title, subject chips, and where it stands (students waiting first, in amber words). */
function TestRow({ test: t, last, onPress }: { test: TestSummary; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const status = `${STATUS[t.status]} · ${
    t.status === 'scheduled' ? `opens ${dateTimeLabel(t.opensAt)}` : t.status === 'open' ? `${t.submitted}/${t.batchStudents} submitted · closes ${dateTimeLabel(t.closesAt)}` : `${t.submitted} took it`
  }`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}. ${status}${t.pendingResolution ? '. Students waiting for you' : ''}. Opens the test`}
      onPress={onPress}
      style={({ pressed }) => [styles.testRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text style={[styles.testTitle, { color: palette.foreground }]} numberOfLines={2}>
          {t.title}
        </Text>
        <SubjectChips subjects={t.subject} />
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{status}</Text>
        {t.pendingResolution ? <Text style={[styles.meta, styles.waiting, { color: palette.warningInk }]}>Students waiting for you</Text> : null}
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 4 },
  pressed: { opacity: 0.7 },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 60 },
  testTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  meta: { fontSize: 13, lineHeight: 18 },
  waiting: { fontWeight: '700' },
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  schedule: { fontSize: 14, lineHeight: 22, marginTop: 4 },
});
