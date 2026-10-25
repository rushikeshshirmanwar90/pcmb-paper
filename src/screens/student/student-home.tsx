import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ErrorView, ListRow, LoadingView, Muted, ProgressBar, Screen, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { ClassRow, WeekTimetable } from '@/screens/shared/timetable';
import { TestRunner } from '@/screens/student/test-runner';
import { TestList } from '@/screens/student/student-tests';
import { dayLabel } from '@/services/school-api';
import { studentApi, type TopicStat } from '@/services/student-api';

/**
 * A student's day: today's classes, what was taught lately, tests to take,
 * their last result, strong and weak topics, the week and announcements.
 */
export function StudentHomeScreen() {
  const user = useSignedInUser();
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.overview(), [version]);
  const [openTest, setOpenTest] = useState<string | null>(null);

  return (
    <Screen title={`Hi, ${user.name.split(' ')[0]}`} subtitle={data?.batch ? `${data.batch.name} · ${user.tuition.name}` : user.tuition.name} onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {!data.batch ? (
            <Card>
              <Muted>You&apos;re not in a batch yet. Your tuition will add you to one; then your classes, tests and syllabus show here.</Muted>
            </Card>
          ) : null}

          {data.openTests.length ? (
            <>
              <SectionTitle title="Tests to take" />
              <TestList tests={data.openTests.map((t) => ({ ...t, mine: null }))} onOpen={setOpenTest} />
            </>
          ) : null}

          {data.batch ? (
            <>
              <SectionTitle title="Today's classes" />
              <Card>{data.today.length ? data.today.map((e) => <ClassRow key={e.id} entry={e} />) : <Muted>No classes today.</Muted>}</Card>

              <SectionTitle title="Covered in class lately" />
              {data.recent.length ? (
                <Card style={styles.listCard}>
                  {data.recent.map((r, i) => (
                    <ListRow key={r.id} title={r.topic || r.chapter} subtitle={`${r.subject}${r.topic ? ` · ${r.chapter}` : ''} · ${dayLabel(r.coveredOn)}`} last={i === data.recent.length - 1} />
                  ))}
                </Card>
              ) : (
                <Muted>Your teachers mark topics here as they teach them.</Muted>
              )}

              <SectionTitle title="Syllabus covered" />
              <Card>
                {data.batch.subjects.map((s) => {
                  const c = data.batch!.coverage[s];
                  return (
                    <View key={s} style={styles.coverage}>
                      <View style={styles.coverageTop}>
                        <Text style={[styles.subject, { color: palette.foreground }]}>{s}</Text>
                        <Muted>{c?.total ? `${c.percent}%` : '–'}</Muted>
                      </View>
                      <ProgressBar value={c?.percent ?? 0} />
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          <SectionTitle title="How you're doing" />
          <Card>
            {data.insight.lastResult ? (
              <Text style={[styles.result, { color: palette.foreground }]}>
                Last test: {data.insight.lastResult.title} · {data.insight.lastResult.score}/{data.insight.lastResult.maxScore}
              </Text>
            ) : (
              <Muted>Take tests and practise PYQs; your strong and weak topics show here.</Muted>
            )}
            <TopicChips title="Strong" stats={data.insight.strong} tone="success" />
            <TopicChips title="Needs work" stats={data.insight.weak} tone="danger" />
          </Card>

          {data.batch ? (
            <>
              <SectionTitle title="This week" />
              <WeekTimetable entries={data.week} emptyText="Your teachers haven't added classes yet." />
            </>
          ) : null}

          <AnnouncementsSection batches={[]} canPost={false} allowAllBatches={false} />
        </>
      ) : null}
      {openTest ? <TestRunner testId={openTest} onClose={() => setOpenTest(null)} /> : null}
    </Screen>
  );
}

function TopicChips({ title, stats, tone }: { title: string; stats: TopicStat[]; tone: 'success' | 'danger' }) {
  const palette = usePalette();
  if (!stats.length) return null;
  return (
    <View style={styles.chips}>
      <Text style={[styles.chipsTitle, { color: palette.mutedForeground }]}>{title}</Text>
      <View style={styles.chipRow}>
        {stats.map((s) => (
          <Badge key={`${s.chapter}|${s.topic}`} label={`${s.topic || s.chapter} · ${s.accuracy}%`} tone={tone} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  coverage: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subject: { fontSize: 14, fontWeight: '600' },
  result: { fontSize: 15, fontWeight: '600' },
  chips: { gap: 6 },
  chipsTitle: { fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
