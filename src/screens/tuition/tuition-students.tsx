import React, { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { StackScreen } from '@/components/stack-screen';
import { PersonNotice, usePersonFeedback } from '@/screens/tuition/person-notice';
import { PersonFormPage } from '@/screens/tuition/person-form-page';
import { usePersonFormGuard } from '@/screens/tuition/person-form-guard';
import { studentHref } from '@/screens/tuition/person-nav';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyView,
  ErrorView,
  Field,
  Icon,
  ListRow,
  LoadingView,
  Muted,
  Notice,
  PasswordField,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { fitProblem, PROGRAM_LABELS, programChoices, PROGRAMS, SCHOOL_STANDARDS, type Program, type SchoolStandard } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { StudentInsightSheet } from '@/screens/teacher/student-insight';
import { activeFilterCount, ALL, EMPTY_STUDENT_FILTER, filterStudents, NO_BATCH, plural, type StudentFilter } from '@/screens/tuition/admin-filters';
import {
  ActionRow,
  Avatar,
  ClearFilters,
  FilterRow,
  FlashNotice,
  InfoRow,
  LoginStatus,
  OptionPicker,
  PanelScroll,
  PersonHeader,
  SearchBox,
  programTone,
  useFlash,
  type PickerOption,
} from '@/screens/tuition/admin-ui';
import { InviteStudentsPicker } from '@/screens/tuition/invite-students';
import { PendingEnrollments } from '@/screens/tuition/pending-enrollments';
import { usePeopleNav } from '@/screens/tuition/people-nav';
import { ResetPasswordSheet } from '@/screens/tuition/reset-password-sheet';
import { timeAgo, tuitionApi, type Batch, type Student } from '@/services/tuition-api';

/** The server lists at most this many students per request. */
const SERVER_LIMIT = 500;

const PROGRAM_FILTERS = [{ value: ALL, label: 'All' }, ...PROGRAMS.map((p) => ({ value: p, label: PROGRAM_LABELS[p] }))] as { value: Program | typeof ALL; label: string }[];
const CLASS_FILTERS = [{ value: ALL, label: 'All' }, ...SCHOOL_STANDARDS.map((s) => ({ value: s, label: s }))] as { value: SchoolStandard | typeof ALL; label: string }[];

/** People › Students: search, filter, enroll, edit and move between batches. */
export function StudentsPanel() {
  const version = useDataVersion();
  const [filter, setFilter] = useState<StudentFilter>(EMPTY_STUDENT_FILTER);
  // Another tab asked to show one batch's students (e.g. Home's "no batch yet").
  const nav = usePeopleNav();
  const [seenRequest, setSeenRequest] = useState(0);
  if (nav.studentBatch && nav.studentBatch.id !== seenRequest) {
    setSeenRequest(nav.studentBatch.id);
    setFilter({ ...EMPTY_STUDENT_FILTER, batch: nav.studentBatch.batch });
  }
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const router = useRouter();
  const { flash, show, clear } = useFlash();
  const set = (patch: Partial<StudentFilter>) => setFilter((f) => ({ ...f, ...patch }));

  // The server searches once typing pauses; the list narrows as you type.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(filter.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filter.search]);

  const batches = useLoad(() => tuitionApi.batches(), [version]);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(
    () => tuitionApi.students({ q: query, batchId: filter.batch === ALL ? null : filter.batch }),
    [query, filter.batch, version]
  );
  const batchList = batches.data ?? [];
  const shown = filterStudents(data ?? [], filter);
  const filters = activeFilterCount(filter);
  // A batch filter for a batch that was deleted falls back to All.
  const batchFilterOk = filter.batch === ALL || filter.batch === NO_BATCH || !batches.data || batchList.some((b) => b.id === filter.batch);
  if (!batchFilterOk) set({ batch: ALL });

  const batchFilters = [
    { value: ALL, label: 'All' },
    ...batchList.map((b) => ({ value: b.id, label: b.name, count: b.studentCount })),
    { value: NO_BATCH, label: 'No batch' },
  ];


  return (
    <PanelScroll
      onRefresh={() => {
        refresh();
        batches.reload();
      }}
      refreshing={refreshing}
    >
      <Button label="Invite Students" icon={{ ios: 'qrcode', android: 'group_add' }} onPress={() => setInviting(true)} />
      <Button label="Add student" variant="secondary" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => router.push({ pathname: '/student/new', params: { batchId: filter.batch !== ALL && filter.batch !== NO_BATCH ? filter.batch : '' } })} />
      <FlashNotice flash={flash} onDismiss={clear} />
      <PersonNotice kind="student" />
      <PendingEnrollments onDone={(message, tone) => show(message, tone)} />
      <SearchBox value={filter.search} onChangeText={(search) => set({ search })} placeholder="Search by name or email" label="Search students" />
      <View style={styles.filters}>
        <FilterRow label="Program" options={PROGRAM_FILTERS} value={filter.program} onChange={(program) => set({ program })} />
        <FilterRow label="Class" options={CLASS_FILTERS} value={filter.standard} onChange={(standard) => set({ standard })} />
        <FilterRow label="Batch" options={batchFilters} value={filter.batch} onChange={(batch) => set({ batch })} />
      </View>

      {loading ? (
        <LoadingView label="Loading students…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the students. ${error}`} onRetry={reload} />
      ) : (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          <View style={styles.countRow}>
            <Muted>{filters ? `${plural(shown.length, 'student')} match` : plural(shown.length, 'student')}</Muted>
            {filters ? <ClearFilters onPress={() => setFilter(EMPTY_STUDENT_FILTER)} /> : null}
          </View>
          {data && data.length >= SERVER_LIMIT ? <Muted>Showing the first {SERVER_LIMIT} by name. Search to find anyone else.</Muted> : null}
          {!shown.length ? (
            <Card>
              <EmptyView
                icon={{ ios: 'person.3', android: 'groups' }}
                title={filters ? 'No students match' : 'No students yet'}
                text={filters ? 'Try another search, or clear the filters.' : 'Add a student with their email and a starting password, or accept one who asked to join with your code.'}
                action={filters ? <Button label="Clear filters" variant="secondary" onPress={() => setFilter(EMPTY_STUDENT_FILTER)} /> : undefined}
              />
            </Card>
          ) : (
            <Card style={styles.listCard}>
              {shown.map((s, i) => (
                <StudentRow key={s.id} student={s} onPress={() => router.push(studentHref(s.id))} last={i === shown.length - 1} />
              ))}
            </Card>
          )}
        </>
      )}

      {inviting ? <InviteStudentsPicker batches={batchList} onClose={() => setInviting(false)} /> : null}

    </PanelScroll>
  );
}

/** A student in the list: initials, name, email, then program, class and batch. */
function StudentRow({ student: s, onPress, last }: { student: Student; onPress: () => void; last: boolean }) {
  const palette = usePalette();
  const label = [s.name, s.program ? PROGRAM_LABELS[s.program] : null, s.standard, s.batch ? `Batch ${s.batch.name}` : 'No batch', !s.active ? 'Login off' : null]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the student's details"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <Avatar name={s.name} muted={!s.active} />
      <View style={styles.flex}>
        <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
          {s.name}
        </Text>
        <Text style={[styles.email, { color: palette.mutedForeground }]} numberOfLines={1}>
          {s.email}
        </Text>
        <View style={styles.badges}>
          {s.program ? <Badge label={PROGRAM_LABELS[s.program]} tone={programTone(s.program)} /> : null}
          {s.standard ? <Badge label={s.standard} /> : null}
          {s.batch ? <Badge label={s.batch.name} tone="violet" /> : <Badge label="No batch" tone="warning" />}
          {!s.active ? <Badge label="Login off" tone="danger" /> : null}
        </View>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

export function StudentDetailsContent({
  student,
  batches,
  onChanged,
  onClose, feedbackView, onRefresh, refreshing,
}: {
  student: Student;
  feedbackView?: ReactNode; onRefresh?: () => void; refreshing?: boolean;
  batches: Batch[];
  onChanged: (s: Student) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [insight, setInsight] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const feedback = usePersonFeedback('student', student.id);
  const { flash, show, clear } = useFlash();

  const run = async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true);
    clear();
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'id' in result) onChanged(result as Student);
      bumpDataVersion();
      show(success);
      after?.();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Something went wrong.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const toggleLogin = () =>
    student.active
      ? confirmAction(`Turn off ${student.name}'s login?`, "They are logged out and can't log in until you turn it back on.", 'Turn off', () =>
          run(() => tuitionApi.updateStudent(student.id, { active: false }), 'Login turned off.')
        )
      : run(() => tuitionApi.updateStudent(student.id, { active: true }), 'Login turned on. They can log in again.');

  const remove = () =>
    confirmAction(
      `Remove ${student.name}?`,
      'They leave your institute, and their test attempts and practice answers are deleted. Their own account stays, so they could ask to join again. This cannot be undone.',
      'Remove',
      () =>
      run(() => tuitionApi.deleteStudent(student.id), `${student.name} removed.`, () => {
        feedback(`${student.name} removed.`);
        onClose();
      })
    );

  const takeOut = () =>
    student.batch &&
    confirmAction(`Take ${student.name} out of ${student.batch.name}?`, 'You can add them to a batch again any time.', 'Take out', () =>
      run(() => tuitionApi.updateStudent(student.id, { batchId: null }), `Taken out of ${student.batch!.name}.`)
    );

  return (
    <StackScreen title={student.name} onBack={onClose} onRefresh={onRefresh} refreshing={refreshing} footer={<Button label="Edit details" icon={{ ios: 'pencil', android: 'edit' }} onPress={() => router.push(studentHref(student.id, 'edit'))} />}>
      <FlashNotice flash={flash} onDismiss={clear} />
      <PersonNotice kind="student" id={student.id} />
      {feedbackView}
      <Card>
        <PersonHeader
          name={student.name}
          line={student.email}
          badges={
            <>
              {student.program ? <Badge label={PROGRAM_LABELS[student.program]} tone={programTone(student.program)} /> : <Badge label="Program not set" />}
              {student.standard ? <Badge label={student.standard} /> : null}
              {!student.active ? <Badge label="Login off" tone="danger" /> : null}
            </>
          }
        />
      </Card>

      <SectionTitle title="Batch" />
      <Card>
        <InfoRow
          icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
          label="Current batch"
          value={student.batch?.name ?? 'Not in a batch yet'}
          tone={student.batch ? undefined : 'warning'}
          last
        />
        <Muted>{student.batch ? "They see this batch's classes, tests and announcements." : 'Add them to a batch so they see its classes, tests and announcements.'}</Muted>
        <View style={styles.actions}>
          <Button
            label={student.batch ? 'Change batch' : 'Add to batch'}
            variant="tonal"
            icon={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz' }}
            onPress={() => router.push(studentHref(student.id, 'batch'))}
            disabled={busy}
            style={styles.flex}
          />
          {student.batch ? <Button label="Take out" variant="secondary" onPress={takeOut} disabled={busy} accessibilityLabel={`Take out of ${student.batch.name}`} /> : null}
        </View>
      </Card>

      <SectionTitle title="Academic details" />
      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'book', android: 'school' }} label="Program" value={student.program ? PROGRAM_LABELS[student.program] : 'Not set'} />
        <InfoRow icon={{ ios: 'book', android: 'school' }} label="Class" value={student.standard ?? 'Not set'} />
        <InfoRow icon={{ ios: 'book', android: 'school' }} label="Academic year" value={batches.find((b) => b.id === student.batch?.id)?.academicYear ?? 'Not set'} last />
      </Card>

      <SectionTitle title="Contact" />
      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'envelope', android: 'mail' }} label="Email (login)" value={student.email} />
        <InfoRow icon={{ ios: 'phone', android: 'call' }} label="Phone" value={student.phone} />
        <InfoRow icon={{ ios: 'person.2', android: 'family_restroom' }} label="Parent's phone" value={student.parentPhone} last />
      </Card>

      <SectionTitle title="Performance" />
      <Card style={styles.listCard}>
        <ListRow
          icon={{ ios: 'chart.bar', android: 'bar_chart' }}
          title="Tests, strong and weak topics"
          subtitle="Scores and accuracy by subject and chapter"
          onPress={() => setInsight(true)}
          last
        />
      </Card>

      <SectionTitle title="Login and account" />
      <Card style={styles.listCard}>
        <LoginStatus active={student.active} lastLoginAt={student.lastLoginAt} ago={timeAgo} />
        <ActionRow icon={{ ios: 'key', android: 'key' }} title="Reset password" subtitle="Set a new password and log them out" onPress={() => setResetting(true)} disabled={busy} />
        <ActionRow
          icon={{ ios: student.active ? 'lock' : 'lock.open', android: student.active ? 'lock' : 'lock_open' }}
          title={student.active ? 'Turn login off' : 'Turn login on'}
          subtitle={student.active ? 'Stops them logging in, keeps their details' : 'Lets them log in again'}
          onPress={toggleLogin}
          disabled={busy}
        />
        <ActionRow
          icon={{ ios: 'person.badge.minus', android: 'person_remove' }}
          title="Remove student"
          subtitle="Takes them out of your institute; deletes their test results"
          tone="danger"
          onPress={remove}
          disabled={busy}
          last
        />
      </Card>

      {insight ? <StudentInsightSheet studentId={student.id} onClose={() => setInsight(false)} /> : null}
      <ResetPasswordSheet
        visible={resetting}
        name={student.name}
        onClose={() => setResetting(false)}
        onReset={(password) => tuitionApi.resetStudentPassword(student.id, password)}
      />
    </StackScreen>
  );
}

/** "NEET · 12th · 18 students", for picking a batch. */
const batchHint = (b: Batch) => [PROGRAM_LABELS[b.program], b.standard ?? '11th & 12th', plural(b.studentCount, 'student')].join(' · ');

/** The batches a student fits: their program, and their class when both have one. */
const fitting = (batches: Batch[], student: { program: Program | null; standard: SchoolStandard | null }) =>
  batches.filter((b) => !fitProblem(student, b)).sort((a, b) => a.name.localeCompare(b.name));

/** Puts the student in one of the tuition's batches of their program and class. */
export function StudentBatchForm({ student, batches, onClose, onSaved }: { student: Student; batches: Batch[]; onClose: () => void; onSaved: (s: Student) => void }) {
  const [batchId, setBatchId] = useState<string>(student.batch?.id ?? NO_BATCH);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedback = usePersonFeedback('student', student.id);
  const allowLeave = usePersonFormGuard(batchId !== (student.batch?.id ?? NO_BATCH), saving);

  const fits = fitting(batches, student);
  const others = batches.length - fits.length;
  const options: PickerOption[] = [{ value: NO_BATCH, label: 'No batch', pinned: true }, ...fits.map((b) => ({ value: b.id, label: b.name, hint: batchHint(b) }))];

  const save = async () => {
    if (saving) return;
    if (batchId === (student.batch?.id ?? NO_BATCH)) { allowLeave(); onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = await tuitionApi.updateStudent(student.id, { batchId: batchId === NO_BATCH ? null : batchId });
      bumpDataVersion();
      allowLeave();
      feedback(saved.batch ? `Moved to ${saved.batch.name}.` : 'Student taken out of their batch.');
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add them to the batch.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PersonFormPage
      title={student.batch ? `Move ${student.name}` : `Add ${student.name} to a batch`}
      onBack={onClose}
      submitLabel="Save batch"
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      {student.batch ? <Muted>Now in {student.batch.name}.</Muted> : null}
      <OptionPicker label="Batch" options={options} selected={batchId} onChange={setBatchId} chipsUpTo={0} searchPlaceholder="Search batches" />
      <Muted>A student is in one batch at a time. They see its classes, tests and announcements.</Muted>
      {!fits.length ? <Notice tone="warning" text="No matching batches available. Create a batch with this student's program and class first." /> : null}
      {others ? (
        <Muted>
          {plural(others, 'other batch', 'other batches')} {others === 1 ? 'is' : 'are'} for another program or class. To move {student.name} there, change their program or
          class in Edit details first.
        </Muted>
      ) : null}
    </PersonFormPage>
  );
}

const STANDARD_CHOICES = ['none', ...SCHOOL_STANDARDS] as const;
type StandardChoice = (typeof STANDARD_CHOICES)[number];

/**
 * Adding a student (program JEE or NEET, class 11th or 12th, a batch if there
 * is one yet, and a starting password), or editing one. `initialBatchId`
 * starts a new student in that batch, with its program and class.
 */
export function StudentForm({ onClose, student, batches, initialBatchId, onSaved }: {
  onClose: () => void;
  student?: Student;
  batches: Batch[];
  initialBatchId?: string | null;
  onSaved?: (s: Student) => void;
}) {
  const start = !student && initialBatchId ? batches.find((b) => b.id === initialBatchId && programChoices().includes(b.program)) : undefined;
  const [initial] = useState(() => ({
    name: student?.name ?? '', email: student?.email ?? '', phone: student?.phone ?? '', parentPhone: student?.parentPhone ?? '',
    program: student ? student.program ?? undefined : start?.program ?? 'NEET', standard: (student?.standard ?? start?.standard ?? 'none') as StandardChoice,
    batchId: student?.batch?.id ?? start?.id ?? NO_BATCH, password: '',
  }));
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [parentPhone, setParentPhone] = useState(initial.parentPhone);
  const [program, setProgram] = useState<Program | undefined>(initial.program);
  const [standard, setStandard] = useState<StandardChoice>(initial.standard);
  const [batchId, setBatchId] = useState(initial.batchId);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify({ name, email, phone, parentPhone, program, standard, batchId, password }) !== JSON.stringify(initial);
  const feedback = usePersonFeedback('student', student?.id);
  const allowLeave = usePersonFormGuard(dirty, saving);

  // Picking a batch sets the program and class to the batch's; changing
  // them to ones the batch isn't for takes the batch off again.
  const chosenClass = standard === 'none' ? null : standard;
  // New students: JEE or NEET only. A student keeps a program that isn't offered any more.
  const programs = programChoices(student?.program);
  // Only an existing student without a class may stay without one.
  const classChoices = student && !student.standard ? STANDARD_CHOICES : SCHOOL_STANDARDS;
  const fitsChoice = (b: Batch) => !fitProblem({ program: program ?? null, standard: chosenClass }, b);
  const batchOptions: PickerOption[] = [
    { value: NO_BATCH, label: 'No batch', pinned: true },
    ...batches
      .filter((b) => programs.includes(b.program) || b.id === student?.batch?.id)
      .sort((a, b) => Number(fitsChoice(b)) - Number(fitsChoice(a)) || a.name.localeCompare(b.name))
      .map((b) => ({ value: b.id, label: b.name, hint: batchHint(b) })),
  ];
  const pickBatch = (id: string) => {
    setBatchId(id);
    const b = batches.find((x) => x.id === id);
    if (!b) return;
    setProgram(b.program);
    if (b.standard) setStandard(b.standard);
  };
  const keepsBatch = (next: { program: Program | undefined; standard: SchoolStandard | null }) => {
    const b = batches.find((x) => x.id === batchId);
    if (b && fitProblem({ ...next, program: next.program ?? null }, b)) setBatchId(NO_BATCH);
  };
  const pickProgram = (next: Program) => {
    setProgram(next);
    keepsBatch({ program: next, standard: chosenClass });
  };
  const pickClass = (next: StandardChoice) => {
    setStandard(next);
    keepsBatch({ program, standard: next === 'none' ? null : next });
  };

  const save = async () => {
    if (saving) return;
    if (!name.trim() || !email.trim()) return setError("Enter the student's name and email.");
    if (!student && !chosenClass) return setError("Choose the student's class: 11th or 12th.");
    if (!student && password.length < 8) return setError('The starting password needs at least 8 characters.');
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      parentPhone: parentPhone.trim(),
      program,
      standard: chosenClass,
      batchId: batchId === NO_BATCH ? null : batchId,
    };
    try {
      const saved = student ? await tuitionApi.updateStudent(student.id, input) : await tuitionApi.createStudent({ ...input, password });
      bumpDataVersion();
      allowLeave();
      feedback(student ? 'Student details saved.' : `${saved.name} added. Share their email and starting password with them.`);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the student.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PersonFormPage
      title={student ? `Edit ${student.name}` : 'Add student'}
      onBack={onClose}
      submitLabel={student ? 'Save changes' : 'Add student'}
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <View style={styles.group}>
        <SectionTitle title="Student" />
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" hint="They log in with this email." />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
        <Field label="Parent's phone" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" maxLength={20} />
      </View>
      <View style={styles.group}>
        <SectionTitle title="Studies" />
        <Chips label="Program" choices={programs} selected={program ?? null} onChange={pickProgram} labels={PROGRAM_LABELS} />
        <Chips label="Class" choices={classChoices} selected={standard === 'none' && !student ? null : standard} onChange={pickClass} labels={{ none: 'Not set' }} />
        <OptionPicker label="Batch" options={batchOptions} selected={batchId} onChange={pickBatch} chipsUpTo={0} searchPlaceholder="Search batches" />
        <Muted>Picking a batch sets the program and class to the batch&apos;s.</Muted>
      </View>
      {!student ? (
        <View style={styles.group}>
          <SectionTitle title="Login" />
          <PasswordField label="Starting password" value={password} onChangeText={setPassword} hint="At least 8 characters. Share it with them; they can change it." autoComplete="off" />
        </View>
      ) : null}
    </PersonFormPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  listCard: { paddingVertical: 0 },
  filters: { gap: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  name: { fontSize: 15, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  group: { gap: 12 },
});
