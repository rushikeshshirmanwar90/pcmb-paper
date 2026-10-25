import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Badge, Card, EmptyView, ErrorView, ListRow, LoadingView, Muted, Screen, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import { TestRunner } from '@/screens/student/test-runner';
import { dateTimeLabel } from '@/services/school-api';
import { studentApi, type StudentTest } from '@/services/student-api';

/** The student's tests: open ones to take, then past ones with results. */
export function StudentTestsScreen() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.tests(), [version]);
  const [openId, setOpenId] = useState<string | null>(null);

  const toDo = (data ?? []).filter((t) => t.status === 'open' && t.mine?.state !== 'submitted');
  const past = (data ?? []).filter((t) => !(t.status === 'open' && t.mine?.state !== 'submitted'));

  return (
    <Screen title="Tests" subtitle="Take your batch's tests and see your results" onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Card>
          <EmptyView icon={{ ios: 'list.clipboard', android: 'assignment' }} title="No tests yet" text="Tests your teachers set for your batch show here." />
        </Card>
      ) : (
        <>
          <SectionTitle title={`To do (${toDo.length})`} />
          {toDo.length ? <TestList tests={toDo} onOpen={setOpenId} /> : <Muted>No tests to take right now.</Muted>}
          <SectionTitle title="Past tests" />
          {past.length ? <TestList tests={past} onOpen={setOpenId} /> : null}
        </>
      )}
      {openId ? <TestRunner testId={openId} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

export function TestList({ tests, onOpen }: { tests: StudentTest[]; onOpen: (id: string) => void }) {
  const palette = usePalette();
  return (
    <Card style={styles.listCard}>
      {tests.map((t, i) => {
        const done = t.mine?.state === 'submitted';
        const going = t.mine?.state === 'in-progress';
        return (
          <ListRow
            key={t.id}
            icon={{ ios: 'list.clipboard', android: 'assignment' }}
            title={t.title}
            subtitle={`${t.subject || 'Mixed'} · ${t.questionCount} Q · ${t.durationMinutes} min${t.closesAt && t.status === 'open' ? ` · closes ${dateTimeLabel(t.closesAt)}` : ''}`}
            right={
              done ? (
                <Text style={[styles.score, { color: palette.foreground }]}>
                  {t.mine!.score}/{t.maxScore}
                </Text>
              ) : going ? (
                <Badge label="Continue" tone="warning" />
              ) : t.status === 'open' ? (
                <Badge label="Start" tone="success" />
              ) : (
                <Badge label="Missed" />
              )
            }
            onPress={() => onOpen(t.id)}
            last={i === tests.length - 1}
          />
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  score: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
