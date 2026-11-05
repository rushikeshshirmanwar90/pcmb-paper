import React, { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, EmptyView, ErrorText, ErrorView, LoadingView, Muted, MultiChips, Notice, ProgressBar, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { FormPage, StackScreen, useDiscardGuard, useGoBack } from '@/components/stack-screen';
import { PROGRAM_INFO, PROGRAM_LABELS, type SchoolSubject } from '@/constants/school';
import { useAuth } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { BatchAnalysisSection } from '@/screens/shared/batch-analysis';
import { missingTeachers, plural, setupOf } from '@/screens/tuition/admin-filters';
import { ActionRow, Avatar, InfoRow, OptionPicker, programTone, type PickerOption } from '@/screens/tuition/admin-ui';
import { batchHref } from '@/screens/tuition/batch-nav';
import { BatchSchedule } from '@/screens/tuition/batch-schedule';
import { PersonNotice } from '@/screens/tuition/person-notice';
import { studentHref, teacherHref } from '@/screens/tuition/person-nav';
import { BatchForm, bankNote, classLabel, yearLabel } from '@/screens/tuition/tuition-batches';
import { schoolApi } from '@/services/school-api';
import { formatMinutes, tuitionApi, type Batch } from '@/services/tuition-api';

// The batch's management screens, each its own route under /batch/[batchId]:
// overview, students, teachers, assign teacher, schedule and settings. Only a
// tuition admin gets them; the server checks that too, for this tuition's batches.

/** Shows the screen only to a tuition admin. */
export function tuitionOnly<P extends object>(Screen: ComponentType<P>, scope: 'Batches' | 'People' = 'Batches'): ComponentType<P> {
  return function TuitionOnly(props: P) {
    const { user } = useAuth();
    if (user?.role !== 'tuition') {
      return (
        <StackScreen title={scope === 'Batches' ? 'Batch' : 'People'}>
          <Notice tone="danger" text={`${scope} are managed by the tuition admin.`} />
        </StackScreen>
      );
    }
    return <Screen {...props} />;
  };
}

/** The batch with its students, without the slow syllabus coverage; Batch Details asks for that on its own. */
export function useBatch(batchId: string, { cached = true }: { cached?: boolean } = {}) {
  const version = useDataVersion();
  // `cached: false` for a form that starts from the batch's values: it must not start from an older copy.
  return useLoad(() => tuitionApi.batch(batchId, false), [batchId, version], { cacheKey: cached ? `batch:${batchId}` : undefined });
}

const subtitleOf = (batch: Batch) => [PROGRAM_LABELS[batch.program], classLabel(batch), yearLabel(batch)].filter(Boolean).join(' · ');

/** What a batch screen shows while its batch loads, or when it can't. */
export function BatchState({ title, loading, error, reload }: { title: string; loading: boolean; error: string | null; reload: () => void }) {
  return (
    <StackScreen title={title}>
      {loading ? <LoadingView label="Loading the batch…" /> : <ErrorView message={`Couldn't load the batch. ${error ?? ''}`} onRetry={reload} />}
    </StackScreen>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────

export const BatchDetailsScreen = tuitionOnly(function BatchDetailsScreen({ batchId }: { batchId: string }) {
  const palette = usePalette();
  const router = useRouter();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useBatch(batchId);
  const timetable = useLoad(() => schoolApi.timetable(batchId), [batchId, version], { cacheKey: `timetable:${batchId}` });
  // The syllabus scan is the slow call, so it waits for the batch instead of competing with it.
  const coverage = useLoad(() => tuitionApi.batchCoverage(batchId), [batchId, version], { enabled: !!data, cacheKey: `coverage:${batchId}` });
  const batch = data?.batch;
  if (!batch || !data) return <BatchState title="Batch" loading={loading} error={error} reload={reload} />;

  const missing = missingTeachers(batch);
  const setup = setupOf(batch);
  const assigned = new Set(batch.teachers.map((t) => t.teacherId)).size;
  return (
    <StackScreen title={batch.name} subtitle={subtitleOf(batch)} onRefresh={refresh} refreshing={refreshing}>
      {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
      <Card style={styles.listCard}>
        <View style={[styles.badges, { borderBottomColor: palette.border }]}>
          <Badge label={PROGRAM_LABELS[batch.program]} tone={programTone(batch.program)} />
          <Badge label={classLabel(batch)} />
          {yearLabel(batch) ? <Badge label={yearLabel(batch)!} /> : null}
          <Badge label={setup.ready ? 'Ready' : `Setup ${setup.done}/${setup.total}`} tone={setup.ready ? 'success' : missing.length ? 'warning' : 'neutral'} />
        </View>
        <InfoRow icon={{ ios: 'book', android: 'menu_book' }} label="Subjects" value={batch.subjects.join(', ')} />
        <InfoRow icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }} label="Classroom" value={batch.venue} />
        <InfoRow
          icon={{ ios: 'clock', android: 'schedule' }}
          label="Class time a week"
          value={batch.classes.weeklyMinutes ? formatMinutes(batch.classes.weeklyMinutes) : ''}
          last
        />
      </Card>
      <Muted>{bankNote(batch.program)}</Muted>

      <SectionTitle title="Manage" />
      <Card style={styles.listCard}>
        <ActionRow
          icon={{ ios: 'person.3', android: 'groups' }}
          title="Students"
          subtitle={batch.studentCount ? plural(batch.studentCount, 'student') : 'No students yet'}
          onPress={() => router.push(batchHref(batchId, 'students'))}
        />
        <ActionRow
          icon={{ ios: 'qrcode', android: 'group_add' }}
          title="Invite Students"
          subtitle="Joining code to copy or share"
          onPress={() => router.push(batchHref(batchId, 'invitations'))}
        />
        <ActionRow
          icon={{ ios: 'person.crop.rectangle', android: 'co_present' }}
          title="Teachers"
          subtitle={missing.length ? `No teacher yet for ${missing.join(', ')}` : plural(assigned, 'teacher')}
          onPress={() => router.push(batchHref(batchId, 'teachers'))}
        />
        <ActionRow
          icon={{ ios: 'calendar', android: 'event' }}
          title="Schedule"
          subtitle={
            batch.classes.classes ? `${plural(batch.classes.classes, 'class', 'classes')} · ${formatMinutes(batch.classes.weeklyMinutes)} a week` : 'Each subject’s days and times'
          }
          onPress={() => router.push(batchHref(batchId, 'schedule'))}
        />
        <ActionRow
          icon={{ ios: 'gearshape', android: 'settings' }}
          title="Batch Settings"
          subtitle="Name, program, class, subjects, classroom"
          onPress={() => router.push(batchHref(batchId, 'settings'))}
          last
        />
      </Card>

      <SectionTitle title="Weekly Schedule" />
      {timetable.data ? (
        <BatchSchedule entries={timetable.data.filter((entry) => entry.batch.id === batch.id)} />
      ) : timetable.error ? (
        <Muted>Couldn&apos;t load the schedule. {timetable.error}</Muted>
      ) : (
        <Muted>Loading the schedule…</Muted>
      )}
      {batch.schedule.length ? (
        <Muted>
          {plural(batch.schedule.length, 'older class time', 'older class times')} without a subject {batch.schedule.length === 1 ? 'is' : 'are'} kept from before. Open the
          schedule to see {batch.schedule.length === 1 ? 'it' : 'them'}.
        </Muted>
      ) : null}

      <SectionTitle title="Syllabus covered" />
      <Card>
        {batch.subjects.map((subject) => {
          const c = coverage.data?.[subject];
          return (
            <View key={subject} style={styles.coverage}>
              <View style={styles.coverageTop}>
                <Text style={[styles.subject, { color: palette.foreground }]}>{subject}</Text>
                <Text style={[styles.small, { color: palette.mutedForeground }]}>{c?.total ? `${c.percent}% · ${c.covered}/${c.total} topics` : coverage.loading ? 'Loading…' : 'No syllabus found'}</Text>
              </View>
              <ProgressBar value={c?.percent ?? 0} />
            </View>
          );
        })}
        <Muted>Teachers mark topics as they cover them.</Muted>
      </Card>

      <BatchAnalysisSection batchId={batch.id} />
    </StackScreen>
  );
});

// ─── Students ──────────────────────────────────────────────────────────────

export const BatchStudentsScreen = tuitionOnly(function BatchStudentsScreen({ batchId }: { batchId: string }) {
  const palette = usePalette();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload } = useBatch(batchId);
  const batch = data?.batch;
  if (!batch || !data) return <BatchState title="Students" loading={loading} error={error} reload={reload} />;

  const students = data.students;
  return (
    <StackScreen title="Students" subtitle={batch.name} onRefresh={refresh} refreshing={refreshing}>
      {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
      <PersonNotice kind="student" />
      <View style={styles.buttons}>
        <Button label="Invite Students" variant="tonal" icon={{ ios: 'qrcode', android: 'group_add' }} onPress={() => router.push(batchHref(batchId, 'invitations'))} style={styles.flex} />
        <Button label="Add student" variant="secondary" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => router.push({ pathname: '/student/new', params: { batchId } })} style={styles.flex} />
      </View>
      {students.length ? (
        <Card style={styles.listCard}>
          {students.map((s, i) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${s.name}, student details`} onPress={() => router.push(studentHref(s.id))} key={s.id} style={[styles.row, i < students.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
              <Avatar name={s.name} size={32} muted={!s.active} />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={[styles.small, { color: palette.mutedForeground }]} numberOfLines={1}>
                  {[s.standard, s.program && s.program !== batch.program ? `${PROGRAM_LABELS[s.program]} student` : null, !s.active ? 'Login off' : null, s.email].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyView
            icon={{ ios: 'person.3', android: 'groups' }}
            title="No students in this batch yet"
            text="Invite students with the batch's joining code, or move students in from People."
          />
        </Card>
      )}
      <Muted>
        {plural(students.length, 'student')} in {batch.name}.
      </Muted>
    </StackScreen>
  );
});

// ─── Teachers ──────────────────────────────────────────────────────────────

/** The batch's teachers, each once with all the subjects they take in it. */
function teachersOf(batch: Batch) {
  const byTeacher = new Map<string, { teacherId: string; name: string; subjects: SchoolSubject[] }>();
  for (const t of batch.teachers) {
    const entry = byTeacher.get(t.teacherId) ?? { teacherId: t.teacherId, name: t.name, subjects: [] };
    entry.subjects.push(t.subject);
    byTeacher.set(t.teacherId, entry);
  }
  return [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const BatchTeachersScreen = tuitionOnly(function BatchTeachersScreen({ batchId }: { batchId: string }) {
  const palette = usePalette();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload } = useBatch(batchId);
  const batch = data?.batch;
  if (!batch || !data) return <BatchState title="Teachers" loading={loading} error={error} reload={reload} />;

  const teachers = teachersOf(batch);
  const missing = missingTeachers(batch);
  return (
    <StackScreen title="Teachers" subtitle={batch.name} onRefresh={refresh} refreshing={refreshing}>
      {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
      <Button label="Assign Teacher" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push(batchHref(batchId, 'assign-teacher'))} />
      {missing.length ? <Notice tone="warning" title="Subjects without a teacher" text={missing.join(', ')} /> : null}
      {teachers.length ? (
        <Card style={styles.listCard}>
          {teachers.map((t, i) => (
            <ActionRow
              key={t.teacherId}
              icon={{ ios: 'person.crop.rectangle', android: 'co_present' }}
              title={t.name}
              subtitle={`${t.subjects.join(', ')} · Edit assignment`}
              onPress={() => router.push(teacherHref(t.teacherId))}
              last={i === teachers.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyView
            icon={{ ios: 'person.crop.rectangle', android: 'co_present' }}
            title="No teachers assigned"
            text="Assign teachers of your institute to this batch and pick the subjects each takes. Add new teachers in People › Teachers."
          />
        </Card>
      )}
      <Text style={[styles.small, { color: palette.mutedForeground }]}>A teacher can take several subjects and several batches, and a subject can have more than one teacher.</Text>
    </StackScreen>
  );
});

// ─── Assign a teacher ──────────────────────────────────────────────────────

const PICK = 'none';

/** Assign a teacher to the batch, or (with `teacherId`) change their subjects there or remove them. */
export const AssignTeacherScreen = tuitionOnly(function AssignTeacherScreen({ batchId, teacherId }: { batchId: string; teacherId?: string }) {
  const goBack = useGoBack();
  const { data, error: loadError, loading, reload } = useBatch(batchId);
  const teachers = useLoad(() => tuitionApi.teachers(), [], { cacheKey: 'teachers' });
  const [picked, setPicked] = useState<string>(teacherId ?? PICK);
  const [subjects, setSubjects] = useState<SchoolSubject[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hooks first: a teacher or subject picked and not yet saved is a change to keep or discard.
  const touched = subjects !== null || picked !== (teacherId ?? PICK);
  const allowLeave = useDiscardGuard(touched && !saving, 'Discard assignment?', 'Your unsaved changes will be lost.');
  const batch = data?.batch;
  if (!batch || !data) return <BatchState title="Assign Teacher" loading={loading} error={loadError} reload={reload} />;

  const editing = !!teacherId;
  const already = new Set(batch.teachers.map((t) => t.teacherId));
  const mine = batch.teachers.filter((t) => t.teacherId === picked).map((t) => t.subject);
  const chosen = subjects ?? mine;
  const teacher = teachers.data?.find((t) => t.id === picked);
  const outside = teacher ? chosen.filter((s) => !teacher.subjects.includes(s)) : [];
  const options: PickerOption[] = [
    { value: PICK, label: 'Choose a teacher', pinned: true },
    ...(teachers.data ?? [])
      .filter((t) => t.id === teacherId || (t.active && !already.has(t.id)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ value: t.id, label: t.name, hint: t.subjects.length ? t.subjects.join(', ') : t.email })),
  ];

  const pick = (id: string) => {
    setPicked(id);
    const next = teachers.data?.find((t) => t.id === id);
    // Start from the batch subjects this teacher already teaches.
    setSubjects(next ? batch.subjects.filter((s) => next.subjects.includes(s)) : []);
    setError(null);
  };
  const save = async () => {
    if (picked === PICK) return setError('Choose a teacher.');
    if (!chosen.length) return setError('Pick at least one subject.');
    setSaving(true);
    setError(null);
    try {
      await tuitionApi.assignTeacher(batchId, picked, chosen);
      bumpDataVersion();
      allowLeave();
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't assign the teacher.");
    } finally {
      setSaving(false);
    }
  };
  const remove = () =>
    confirmAction(
      `Remove ${teacher?.name ?? 'this teacher'} from ${batch.name}?`,
      'They stay in your institute and keep their other batches. Their classes in this batch must be changed or removed first.',
      'Remove',
      async () => {
        setSaving(true);
        setError(null);
        try {
          await tuitionApi.removeTeacher(batchId, picked);
          bumpDataVersion();
          allowLeave();
          goBack();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Couldn't remove the teacher.");
        } finally {
          setSaving(false);
        }
      }
    );

  return (
    <FormPage
      title={editing ? 'Edit Assignment' : 'Assign Teacher'}
      onBack={goBack}
      submitLabel={editing ? 'Save Assignment' : 'Assign Teacher'}
      onSubmit={() => void save()}
      submitting={saving}
      error={error}
      extraAction={editing ? <Button label="Remove from batch" variant="danger" onPress={remove} disabled={saving} /> : undefined}
    >
      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} label="Batch" value={batch.name} last />
      </Card>
      {teachers.loading ? (
        <LoadingView label="Loading teachers…" />
      ) : teachers.error && !teachers.data ? (
        <ErrorView message={`Couldn't load the teachers. ${teachers.error}`} onRetry={teachers.reload} />
      ) : editing ? (
        <Card style={styles.listCard}>
          <InfoRow icon={{ ios: 'person.crop.rectangle', android: 'co_present' }} label="Teacher" value={teacher?.name ?? ''} last />
        </Card>
      ) : options.length > 1 ? (
        <OptionPicker label="Teacher" options={options} selected={picked} onChange={pick} searchPlaceholder="Search teachers" />
      ) : (
        <Notice tone="warning" title="No teacher to assign" text="Every active teacher of your institute is already in this batch. Add or invite teachers in People › Teachers." />
      )}
      <MultiChips label="Subjects" choices={batch.subjects} selected={chosen} onChange={setSubjects} />
      {outside.length ? (
        <Muted>
          {outside.join(', ')} {outside.length === 1 ? 'is' : 'are'} not in {teacher?.name}&apos;s own subjects.
        </Muted>
      ) : null}
      <Muted>The subjects come from this batch&apos;s configuration ({PROGRAM_INFO[batch.program].label}).</Muted>
    </FormPage>
  );
});

// ─── Settings ──────────────────────────────────────────────────────────────

export const BatchSettingsScreen = tuitionOnly(function BatchSettingsScreen({ batchId }: { batchId: string }) {
  const router = useRouter();
  const { data, error, loading, reload } = useBatch(batchId, { cached: false });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const batch = data?.batch;
  if (!batch) return <BatchState title="Batch Settings" loading={loading} error={error} reload={reload} />;

  const remove = (allowLeave: () => void) =>
    confirmAction(
      `Delete ${batch.name}?`,
      'Its students stay enrolled without a batch. Its tests, results and syllabus progress are removed. This cannot be undone.',
      'Delete',
      async () => {
        setDeleting(true);
        setDeleteError(null);
        try {
          await tuitionApi.deleteBatch(batchId);
          bumpDataVersion();
          allowLeave();
          router.dismissAll();
        } catch (e) {
          setDeleteError(e instanceof Error ? e.message : "Couldn't delete the batch.");
          setDeleting(false);
        }
      }
    );
  return (
    <BatchForm
      batch={batch}
      dangerZone={(allowLeave) => (
        <>
          <Muted>Deleting this batch can&apos;t be undone. Its students stay enrolled without a batch; its tests, results and syllabus progress are removed.</Muted>
          <ErrorText message={deleteError} />
          <Button label="Delete batch" variant="danger" icon={{ ios: 'trash', android: 'delete' }} onPress={() => remove(allowLeave)} loading={deleting} accessibilityLabel={`Delete ${batch.name}`} />
        </>
      )}
    />
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  listCard: { paddingVertical: 0 },
  buttons: { flexDirection: 'row', gap: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17 },
  subject: { fontSize: 14, fontWeight: '600' },
  coverage: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
