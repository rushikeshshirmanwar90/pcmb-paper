import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
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
  MultiChips,
  ProgressBar,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { SCHOOL_STANDARDS, SUBJECTS_BY_TRACK, TRACK_LABELS, TRACKS, type SchoolSubject, type Track } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { BatchAnalysisSection } from '@/screens/shared/batch-analysis';
import { ScheduleEditor } from '@/screens/tuition/schedule-editor';
import { describeSchedule, formatMinutes, tuitionApi, type Batch, type BatchSlot } from '@/services/tuition-api';

/** The tuition's batches: list, details, create, edit and delete. */
export function TuitionBatchesScreen() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.batches(), [version]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Screen title="Batches" subtitle="Timings, venues, teachers and students" onRefresh={refresh} refreshing={refreshing}>
      <Button label="New batch" icon={{ ios: 'plus', android: 'add' }} onPress={() => setCreating(true)} />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Card>
          <EmptyView icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} title="No batches yet" text="A batch is a group of students taught together at set times." />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {data.map((batch, i) => (
            <ListRow
              key={batch.id}
              icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
              title={batch.name}
              subtitle={`${TRACK_LABELS[batch.track]}${batch.standard ? ` · ${batch.standard}` : ''} · ${batch.studentCount} student${batch.studentCount === 1 ? '' : 's'}${batch.schedule.length ? ` · ${formatMinutes(batch.weeklyMinutes)} a week` : ''}`}
              onPress={() => setOpenId(batch.id)}
              last={i === data.length - 1}
            />
          ))}
        </Card>
      )}

      <BatchForm visible={creating} onClose={() => setCreating(false)} onSaved={(b) => setOpenId(b.id)} />
      {openId ? <BatchDetail id={openId} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

function BatchDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.batch(id), [id, version]);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = () => {
    if (!data) return;
    confirmAction(
      `Delete ${data.batch.name}?`,
      'Its students stay enrolled without a batch, and its syllabus progress is removed. This cannot be undone.',
      'Delete',
      async () => {
        try {
          await tuitionApi.deleteBatch(id);
          bumpDataVersion();
          onClose();
        } catch (e) {
          setDeleteError(e instanceof Error ? e.message : "Couldn't delete the batch.");
        }
      }
    );
  };

  const batch = data?.batch;
  return (
    <DetailSheet
      visible
      title={batch?.name ?? 'Batch'}
      onClose={onClose}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        batch ? (
          <View style={styles.footerRow}>
            <Button label="Delete" variant="danger" onPress={remove} style={styles.flex} />
            <Button label="Edit batch" onPress={() => setEditing(true)} style={styles.flex2} />
          </View>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : batch && data ? (
        <>
          <ErrorText message={deleteError} />
          <Card>
            <View style={styles.badges}>
              <Badge label={TRACK_LABELS[batch.track]} tone="primary" />
              {batch.standard ? <Badge label={batch.standard} /> : <Badge label="11th & 12th" />}
            </View>
            <DetailRow label="Subjects" value={batch.subjects.join(', ')} />
            <DetailRow label="Venue" value={batch.venue || 'Not set'} />
            <DetailRow label="Students" value={String(batch.studentCount)} />
            <DetailRow label="Class time a week" value={batch.weeklyMinutes ? formatMinutes(batch.weeklyMinutes) : 'Not set'} />
          </Card>

          <SectionTitle title="Timings" />
          <Card>
            <Text style={[styles.schedule, { color: palette.foreground }]}>{describeSchedule(batch.schedule)}</Text>
          </Card>

          <SectionTitle title="Teachers" />
          <Card>
            {batch.subjects.map((subject) => {
              const teacher = batch.teachers.find((t) => t.subject === subject);
              return <DetailRow key={subject} label={subject} value={teacher?.name ?? 'No teacher yet'} />;
            })}
          </Card>

          <SectionTitle title="Syllabus covered" />
          <Card>
            {batch.subjects.map((subject) => {
              const c = batch.coverage?.[subject];
              return (
                <View key={subject} style={styles.coverage}>
                  <View style={styles.coverageTop}>
                    <Text style={[styles.subject, { color: palette.foreground }]}>{subject}</Text>
                    <Text style={[styles.small, { color: palette.mutedForeground }]}>{c?.total ? `${c.percent}% · ${c.covered}/${c.total} topics` : 'No syllabus found'}</Text>
                  </View>
                  <ProgressBar value={c?.percent ?? 0} />
                </View>
              );
            })}
            <Muted>Teachers mark topics as they cover them.</Muted>
          </Card>

          <BatchAnalysisSection batchId={batch.id} />

          <BatchForm visible={editing} onClose={() => setEditing(false)} batch={batch} />
        </>
      ) : null}
    </DetailSheet>
  );
}

const STANDARD_CHOICES = ['both', ...SCHOOL_STANDARDS] as const;
type StandardChoice = (typeof STANDARD_CHOICES)[number];

function BatchForm({ visible, onClose, batch, onSaved }: { visible: boolean; onClose: () => void; batch?: Batch; onSaved?: (b: Batch) => void }) {
  const palette = usePalette();
  const { data: teachers } = useLoad(() => tuitionApi.teachers(), [visible], { enabled: visible });
  const [name, setName] = useState('');
  const [track, setTrack] = useState<Track>('NEET');
  const [standard, setStandard] = useState<StandardChoice>('both');
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [venue, setVenue] = useState('');
  const [schedule, setSchedule] = useState<BatchSlot[]>([]);
  const [assigned, setAssigned] = useState<Partial<Record<SchoolSubject, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setName(batch?.name ?? '');
      setTrack(batch?.track ?? 'NEET');
      setStandard(batch?.standard ?? 'both');
      setSubjects(batch?.subjects ?? SUBJECTS_BY_TRACK.NEET);
      setVenue(batch?.venue ?? '');
      setSchedule(batch?.schedule ?? []);
      setAssigned(Object.fromEntries((batch?.teachers ?? []).map((t) => [t.subject, t.teacherId])));
      setError(null);
    }
  }

  const changeTrack = (next: Track) => {
    setTrack(next);
    setSubjects(SUBJECTS_BY_TRACK[next]);
  };

  const save = async () => {
    if (!name.trim()) return setError('Enter a batch name.');
    if (!subjects.length) return setError('Pick at least one subject.');
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      track,
      standard: standard === 'both' ? null : standard,
      subjects,
      venue: venue.trim(),
      schedule,
      teachers: subjects.flatMap((subject) => (assigned[subject] ? [{ subject, teacherId: assigned[subject]! }] : [])),
    };
    try {
      const saved = batch ? await tuitionApi.updateBatch(batch.id, input) : await tuitionApi.createBatch(input);
      bumpDataVersion();
      onClose();
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the batch.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title={batch ? 'Edit batch' : 'New batch'} onClose={onClose} submitLabel={batch ? 'Save' : 'Create batch'} onSubmit={save} submitting={saving} error={error}>
      <Field label="Batch name" value={name} onChangeText={setName} placeholder="e.g. NEET Morning 2027" maxLength={80} />
      <Chips label="Track" choices={TRACKS} selected={track} onChange={changeTrack} labels={TRACK_LABELS} />
      <Chips label="Class" choices={STANDARD_CHOICES} selected={standard} onChange={setStandard} labels={{ both: '11th & 12th' }} />
      <MultiChips label="Subjects" choices={SUBJECTS_BY_TRACK[track]} selected={subjects} onChange={setSubjects} />
      <Field label="Venue" value={venue} onChangeText={setVenue} placeholder="e.g. Room 2, Main branch" maxLength={200} />
      <ScheduleEditor value={schedule} onChange={setSchedule} />

      <Text style={[styles.groupLabel, { color: palette.foreground }]}>Teachers</Text>
      {subjects.map((subject) => {
        const able = (teachers ?? []).filter((t) => t.subjects.includes(subject));
        const choices = ['none', ...able.map((t) => t.id)];
        const labels = Object.fromEntries([['none', 'No teacher'], ...able.map((t) => [t.id, t.name])]);
        return (
          <View key={subject}>
            <Chips
              label={subject}
              choices={choices}
              selected={assigned[subject] ?? 'none'}
              onChange={(id) => setAssigned((prev) => ({ ...prev, [subject]: id === 'none' ? undefined : id }))}
              labels={labels}
            />
            {teachers && able.length === 0 ? <Muted>No teacher teaches {subject} yet. Add one on the Teachers tab.</Muted> : null}
          </View>
        );
      })}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  listCard: { paddingVertical: 0 },
  footerRow: { flexDirection: 'row', gap: 10 },
  badges: { flexDirection: 'row', gap: 6 },
  schedule: { fontSize: 15, lineHeight: 24 },
  coverage: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  subject: { fontSize: 14, fontWeight: '600' },
  small: { fontSize: 12 },
  groupLabel: { fontSize: 15, fontWeight: '700', marginTop: 4 },
});

