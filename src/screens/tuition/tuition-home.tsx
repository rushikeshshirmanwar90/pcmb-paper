import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Card,
  EmptyView,
  ErrorView,
  LoadingView,
  Muted,
  ProgressBar,
  Screen,
  SectionTitle,
  StatGrid,
  StatTile,
  useLoad,
  usePalette,
} from '@/components/kit';
import { TRACK_LABELS } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { JoinRequestsSection } from '@/screens/tuition/join-requests';
import { tuitionApi, type Overview } from '@/services/tuition-api';

/**
 * The tuition's home: totals, then each batch with its students and how much
 * of each subject's syllabus it has covered, then announcements.
 */
export function TuitionHomeScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.overview(), [version]);

  return (
    <Screen title={user.tuition.name || 'Your tuition'} subtitle="Students, teachers and batches at a glance" onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          <JoinRequestsSection />
          <StatGrid>
            <StatTile label="Students" value={data.totals.students} icon={{ ios: 'person.3.fill', android: 'groups' }} />
            <StatTile label="Teachers" value={data.totals.teachers} icon={{ ios: 'person.crop.rectangle.stack', android: 'co_present' }} tone="violet" />
            <StatTile label="Batches" value={data.totals.batches} icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} tone="success" />
          </StatGrid>
          {data.totals.unassignedStudents > 0 ? (
            <Muted>
              {data.totals.unassignedStudents} student{data.totals.unassignedStudents === 1 ? ' has' : 's have'} no batch yet. Assign
              them from the Students tab.
            </Muted>
          ) : null}

          <SectionTitle title="Batches" />
          {data.batches.length === 0 ? (
            <Card>
              <EmptyView
                icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
                title="No batches yet"
                text="Create your first batch from the Batches tab, then add teachers and students to it."
              />
            </Card>
          ) : (
            data.batches.map((batch) => <BatchCoverageCard key={batch.id} batch={batch} />)
          )}

          <AnnouncementsSection batches={data.batches.map((b) => ({ id: b.id, name: b.name }))} canPost allowAllBatches />
        </>
      ) : null}
    </Screen>
  );
}

function BatchCoverageCard({ batch }: { batch: Overview['batches'][number] }) {
  const palette = usePalette();
  return (
    <Card>
      <View style={styles.batchTop}>
        <Text style={[styles.batchName, { color: palette.foreground }]} numberOfLines={1}>
          {batch.name}
        </Text>
        <Badge label={TRACK_LABELS[batch.track]} tone="primary" />
      </View>
      <Muted>
        {batch.studentCount} student{batch.studentCount === 1 ? '' : 's'}
        {batch.standard ? ` · ${batch.standard}` : ''}
        {batch.venue ? ` · ${batch.venue}` : ''}
      </Muted>
      <View style={styles.subjects}>
        {batch.subjects.map((subject) => {
          const c = batch.coverage[subject];
          return (
            <View key={subject} style={styles.subjectRow}>
              <View style={styles.subjectLabel}>
                <Text style={[styles.subjectName, { color: palette.foreground }]}>{subject}</Text>
                <Text style={[styles.subjectPct, { color: palette.mutedForeground }]}>
                  {c && c.total ? `${c.percent}% covered · ${c.covered}/${c.total} topics` : 'No syllabus found'}
                </Text>
              </View>
              <ProgressBar value={c?.percent ?? 0} />
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  batchTop: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  batchName: { fontSize: 17, fontWeight: '700', flex: 1 },
  subjects: { gap: 10, marginTop: 4 },
  subjectRow: { gap: 5 },
  subjectLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  subjectName: { fontSize: 14, fontWeight: '600' },
  subjectPct: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
