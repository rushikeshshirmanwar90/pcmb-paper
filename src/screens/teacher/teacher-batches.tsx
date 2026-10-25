import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  DetailSheet,
  EmptyView,
  ErrorView,
  ListRow,
  LoadingView,
  Muted,
  ProgressBar,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { TRACK_LABELS } from '@/constants/school';
import { useDataVersion } from '@/context/data-version';
import { SyllabusProgressView } from '@/screens/shared/syllabus-progress';
import { StudentInsightSheet } from '@/screens/teacher/student-insight';
import { dayLabel, schoolApi } from '@/services/school-api';
import { describeSchedule } from '@/services/tuition-api';

/** The batches a teacher teaches: timings, students, and marking topics covered. */
export function TeacherBatchesScreen() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.teacherOverview(), [version]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Screen title="Your batches" subtitle="Students, timings and syllabus progress" onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.batches.length ? (
        <Card>
          <EmptyView icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} title="No batches yet" text="Your tuition assigns you to batches and subjects. They show here once it does." />
        </Card>
      ) : (
        data.batches.map((b) => (
          <Card key={b.id}>
            <ListRow
              title={b.name}
              subtitle={`${b.studentCount} student${b.studentCount === 1 ? '' : 's'} · You teach ${b.mySubjects.join(', ')}`}
              onPress={() => setOpenId(b.id)}
              last
            />
            {b.mySubjects.map((s) => (
              <View key={s} style={styles.coverage}>
                <View style={styles.coverageTop}>
                  <Muted>{s}</Muted>
                  <Muted>{b.coverage[s]?.total ? `${b.coverage[s].percent}% covered` : 'No syllabus'}</Muted>
                </View>
                <ProgressBar value={b.coverage[s]?.percent ?? 0} />
              </View>
            ))}
          </Card>
        ))
      )}
      {openId ? <TeacherBatchDetail id={openId} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

function TeacherBatchDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading, reload } = useLoad(() => Promise.all([schoolApi.batch(id), schoolApi.progress(id)]), [id, version]);
  const [marking, setMarking] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [view, recentProgress] = data ?? [null, null];
  const batch = view?.batch;

  return (
    <DetailSheet visible title={batch?.name ?? 'Batch'} onClose={onClose}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : batch && view && recentProgress ? (
        <>
          <Card>
            <View style={styles.badges}>
              <Badge label={TRACK_LABELS[batch.track]} tone="primary" />
              <Badge label={batch.standard ?? '11th & 12th'} />
              {view.mySubjects.map((s) => (
                <Badge key={s} label={`You: ${s}`} tone="violet" />
              ))}
            </View>
            <DetailRow label="Venue" value={batch.venue || 'Not set'} />
            <DetailRow label="Students" value={String(batch.studentCount)} />
            <Text style={[styles.schedule, { color: palette.foreground }]}>{describeSchedule(batch.schedule)}</Text>
          </Card>

          <Button label="Mark topics covered" icon={{ ios: 'checklist', android: 'checklist' }} onPress={() => setMarking(true)} disabled={!view.mySubjects.length} />

          <SectionTitle title="Recently covered" />
          {recentProgress.recent.length ? (
            <Card style={styles.listCard}>
              {recentProgress.recent.slice(0, 8).map((p, i, list) => (
                <ListRow key={p.id} title={p.topic || p.chapter} subtitle={`${p.subject} · ${p.topic ? `${p.chapter} · ` : ''}${dayLabel(p.coveredOn)}${p.teacher ? ` · ${p.teacher}` : ''}`} last={i === list.length - 1} />
              ))}
            </Card>
          ) : (
            <Muted>No topics marked yet.</Muted>
          )}

          <SectionTitle title={`Students (${view.students.length})`} />
          {view.students.length ? (
            <Card style={styles.listCard}>
              {view.students.map((s, i) => (
                <ListRow
                  key={s.id}
                  icon={{ ios: 'person.fill', android: 'person' }}
                  title={s.name}
                  subtitle="Strong and weak topics"
                  onPress={() => setStudentId(s.id)}
                  last={i === view.students.length - 1}
                />
              ))}
            </Card>
          ) : (
            <Muted>No students in this batch yet.</Muted>
          )}

          <DetailSheet visible={marking} title={`${batch.name} · syllabus`} onClose={() => setMarking(false)}>
            <SyllabusProgressView batchId={batch.id} subjects={view.mySubjects} editable />
          </DetailSheet>
          {studentId ? <StudentInsightSheet studentId={studentId} onClose={() => setStudentId(null)} /> : null}
        </>
      ) : null}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  schedule: { fontSize: 14, lineHeight: 22, marginTop: 4 },
  coverage: { gap: 4 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between' },
});
