import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { Badge, Card, Chips, EmptyView, ErrorText, ErrorView, ListRow, LoadingView, Muted, SectionTitle, StatGrid, StatTile } from '@/components/kit';
import {
  MONITOR_FILTERS,
  MONITOR_FILTER_LABELS,
  STATE_WORDS,
  createPoller,
  followAppState,
  filterRows,
  refreshedLabel,
  rowLabel,
  rowLines,
  type MonitorFilter,
  type MonitorMode,
  type Poller,
} from '@/screens/teacher/test-monitor';
import { schoolApi, type TestMonitor } from '@/services/school-api';

/**
 * Feeds the monitor for a test. While `mode` is 'poll' it refreshes every
 * 15 seconds, one request at a time, and only while the app is in the
 * foreground; leaving the screen unmounts it, which stops everything. It stops
 * itself once the server says the test is no longer Live (and calls `onEnded`).
 * 'once' reads a finished test a single time; 'off' does nothing.
 * A failed refresh keeps the last data and sets `error`.
 */
export function useLiveMonitor(testId: string, mode: MonitorMode, onEnded: () => void) {
  const [data, setData] = useState<TestMonitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const poller = useRef<Poller | null>(null);
  const ended = useRef(onEnded);
  useEffect(() => {
    ended.current = onEnded;
  });

  useEffect(() => {
    if (mode === 'off') return;
    let cancelled = false;
    const live = mode === 'poll';
    const mine = createPoller(async () => {
      try {
        const next = await schoolApi.testMonitor(testId);
        if (cancelled) return false;
        setData(next);
        setLastOk(new Date());
        setError(null);
        if (live && next.status !== 'open') {
          ended.current();
          return false;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't refresh.");
      }
      return live;
    });
    poller.current = mine;
    const unfollow = followAppState(mine, AppState);
    return () => {
      cancelled = true;
      unfollow();
      if (poller.current === mine) poller.current = null;
    };
  }, [testId, mode]);

  const refresh = useCallback(() => poller.current?.refresh() ?? Promise.resolve(), []);
  return { data, error, lastOk, refresh };
}

/**
 * The four participation numbers and, for a Live test, who is where. Counts and
 * states come from the server; this only lays them out.
 */
export function LiveMonitorSection({ monitor, live }: { monitor: ReturnType<typeof useLiveMonitor>; live: boolean }) {
  const { data, error, lastOk, refresh } = monitor;
  const [filter, setFilter] = useState<MonitorFilter>('all');

  return (
    <>
      <SectionTitle title={live ? 'Live monitoring' : 'Participation'} />
      {!data ? (
        error ? (
          <ErrorView message={error} onRetry={refresh} />
        ) : (
          <LoadingView />
        )
      ) : (
        <>
          <StatGrid>
            <StatTile label="TOTAL STUDENTS" value={data.counts.total} icon={{ ios: 'person.2', android: 'groups' }} tone="violet" />
            <StatTile label="NOT STARTED" value={data.counts.notStarted} icon={{ ios: 'clock', android: 'schedule' }} tone="neutral" />
          </StatGrid>
          <StatGrid>
            <StatTile label="IN PROGRESS" value={data.counts.inProgress} icon={{ ios: 'pencil', android: 'edit' }} tone="primary" />
            <StatTile label="SUBMITTED" value={data.counts.submitted} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
          </StatGrid>
          {data.counts.autoSubmitted || data.counts.violations ? (
            <Muted>
              Submitted includes {data.counts.autoSubmitted} auto-submitted and {data.counts.violations} ended by a violation.
            </Muted>
          ) : null}
          {live ? (
            <>
              {lastOk ? <Muted>{`Updated ${refreshedLabel(lastOk)} · refreshes automatically`}</Muted> : null}
              {error ? <ErrorText message={`Couldn't refresh. Showing the last update. ${error}`} /> : null}
              <StudentList students={data.students} filter={filter} onFilter={setFilter} />
            </>
          ) : null}
        </>
      )}
    </>
  );
}

function StudentList({ students, filter, onFilter }: { students: TestMonitor['students']; filter: MonitorFilter; onFilter: (f: MonitorFilter) => void }) {
  const shown = filterRows(students, filter);
  return (
    <>
      <Chips
        choices={MONITOR_FILTERS}
        selected={filter}
        onChange={onFilter}
        labels={Object.fromEntries(MONITOR_FILTERS.map((f) => [f, `${MONITOR_FILTER_LABELS[f]} (${filterRows(students, f).length})`]))}
      />
      {shown.length ? (
        <Card style={styles.listCard}>
          {shown.map((row, i) => {
            const [first, second] = rowLines(row);
            return (
              <ListRow
                key={row.student.id}
                title={row.student.name}
                subtitle={second ? `${first}\n${second}` : first}
                right={<Badge label={STATE_WORDS[row.state].label} tone={STATE_WORDS[row.state].tone} />}
                accessibilityLabel={rowLabel(row)}
                last={i === shown.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <Card>
          <EmptyView
            icon={{ ios: 'person.2', android: 'groups' }}
            title={students.length ? 'No students here' : 'No students in this batch'}
            text={students.length ? 'No student matches this filter right now.' : 'Approved students of the batch appear here.'}
          />
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
});
