import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getRandomValues } from 'expo-crypto';
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
  Segmented,
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
import { WaitingToJoinRow } from '@/screens/tuition/requests-screen';
import { usePeopleNav } from '@/screens/tuition/people-nav';
import { ResetPasswordSheet } from '@/screens/tuition/reset-password-sheet';
import { timeAgo, tuitionApi, type Batch, type CreateStudentResult, type EnrollmentMethod, type Student } from '@/services/tuition-api';

type StudentCategory = 'active' | 'pending' | 'unassigned';

/** The server lists at most this many students per request. */
const SERVER_LIMIT = 500;

const PROGRAM_FILTERS = [{ value: ALL, label: 'All' }, ...PROGRAMS.map((p) => ({ value: p, label: PROGRAM_LABELS[p] }))] as { value: Program | typeof ALL; label: string }[];
const CLASS_FILTERS = [{ value: ALL, label: 'All' }, ...SCHOOL_STANDARDS.map((s) => ({ value: s, label: s }))] as { value: SchoolStandard | typeof ALL; label: string }[];

const CATEGORY_OPTIONS: { value: StudentCategory; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Invitations' },
  { value: 'unassigned', label: 'Unassigned' },
];

/** People › Students: search, filter, enroll, edit and move between batches. */
export function StudentsPanel() {
  const version = useDataVersion();
  const [category, setCategory] = useState<StudentCategory>('active');
  const [filter, setFilter] = useState<StudentFilter>(EMPTY_STUDENT_FILTER);
  // Another tab asked to show one batch's students (e.g. Home's "no batch yet").
  const nav = usePeopleNav();
  const [seenRequest, setSeenRequest] = useState(0);
  if (nav.studentBatch && nav.studentBatch.id !== seenRequest) {
    setSeenRequest(nav.studentBatch.id);
    setCategory('active');
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

  const batches = useLoad(() => tuitionApi.batches(), [version], { cacheKey: 'batches' });
  // Active: only active students. Pending: only invited. Unassigned: active with no batch.
  const serverFilter = category === 'pending'
    ? { q: query, accountStatus: 'invited' as const }
    : category === 'unassigned'
      ? { q: query, batchId: 'none', accountStatus: 'active' as const }
      : { q: query, batchId: filter.batch === ALL ? null : filter.batch, accountStatus: 'active' as const };
  const { data, error, loading, refreshing, refresh, reload } = useLoad(
    () => tuitionApi.students(serverFilter),
    [query, filter.batch, version, category]
  );
  // Separate count fetches for category badges.
  const pendingCount = useLoad(() => tuitionApi.students({ accountStatus: 'invited' }).then((s) => s.length), [version]);
  const unassignedCount = useLoad(() => tuitionApi.students({ batchId: 'none', accountStatus: 'active' }).then((s) => s.length), [version]);

  const batchList = batches.data ?? [];
  const shown = category === 'pending' || category === 'unassigned' ? (data ?? []) : filterStudents(data ?? [], filter);
  const filters = category === 'active' ? activeFilterCount(filter) : 0;
  // A batch filter for a batch that was deleted falls back to All.
  const batchFilterOk = filter.batch === ALL || filter.batch === NO_BATCH || !batches.data || batchList.some((b) => b.id === filter.batch);
  if (!batchFilterOk) set({ batch: ALL });

  const batchFilters = [
    { value: ALL, label: 'All' },
    ...batchList.map((b) => ({ value: b.id, label: b.name, count: b.studentCount })),
    { value: NO_BATCH, label: 'No batch' },
  ];

  const categoryOptions = CATEGORY_OPTIONS.map((o) => ({
    ...o,
    count: o.value === 'pending' ? (pendingCount.data ?? 0) : o.value === 'unassigned' ? (unassignedCount.data ?? 0) : undefined,
  }));

  return (
    <PanelScroll
      onRefresh={() => {
        refresh();
        batches.reload();
        pendingCount.reload();
        unassignedCount.reload();
      }}
      refreshing={refreshing}
    >
      <Button label="Invite Students" icon={{ ios: 'qrcode', android: 'group_add' }} onPress={() => setInviting(true)} />
      <Button label="Add student" variant="secondary" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => router.push({ pathname: '/student/new', params: { batchId: filter.batch !== ALL && filter.batch !== NO_BATCH ? filter.batch : '' } })} />
      <FlashNotice flash={flash} onDismiss={clear} />
      <PersonNotice kind="student" />
      {/* Requests to join are handled in one inbox; here, one row while anyone is waiting. */}
      <WaitingToJoinRow side="students" />

      <Segmented label="Student category" options={categoryOptions} value={category} onChange={(c) => { setCategory(c); setFilter(EMPTY_STUDENT_FILTER); }} />

      <SearchBox value={filter.search} onChangeText={(search) => set({ search })} placeholder="Search by name or email" label="Search students" />
      {category === 'active' ? (
        <View style={styles.filters}>
          <FilterRow label="Program" options={PROGRAM_FILTERS} value={filter.program} onChange={(program) => set({ program })} />
          <FilterRow label="Class" options={CLASS_FILTERS} value={filter.standard} onChange={(standard) => set({ standard })} />
          <FilterRow label="Batch" options={batchFilters} value={filter.batch} onChange={(batch) => set({ batch })} />
        </View>
      ) : null}

      {loading ? (
        <LoadingView label={category === 'pending' ? 'Loading invitations…' : 'Loading students…'} />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the students. ${error}`} onRetry={reload} />
      ) : (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          {category === 'pending' ? (
            <PendingInvitationsList students={shown} onAction={(msg, tone) => { show(msg, tone); bumpDataVersion(); }} />
          ) : (
            <>
              <View style={styles.countRow}>
                <Muted>{filters ? `${plural(shown.length, 'student')} match` : plural(shown.length, 'student')}</Muted>
                {filters ? <ClearFilters onPress={() => setFilter(EMPTY_STUDENT_FILTER)} /> : null}
              </View>
              {data && data.length >= SERVER_LIMIT ? <Muted>Showing the first {SERVER_LIMIT} by name. Search to find anyone else.</Muted> : null}
              {!shown.length ? (
                <Card>
                  <EmptyView
                    icon={{ ios: 'person.3', android: 'groups' }}
                    title={category === 'unassigned' ? 'No unassigned students' : filters ? 'No students match' : 'No students yet'}
                    text={
                      category === 'unassigned'
                        ? 'All active students are in a batch.'
                        : filters
                          ? 'Try another search, or clear the filters.'
                          : 'Add a student with their email and a starting password, or accept one who asked to join with your code.'
                    }
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
        </>
      )}

      {inviting ? <InviteStudentsPicker batches={batchList} onClose={() => setInviting(false)} /> : null}

    </PanelScroll>
  );
}

/** Students whose accounts are not yet activated. */
function PendingInvitationsList({ students, onAction }: { students: Student[]; onAction: (msg: string, tone?: 'danger') => void }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const resend = async (s: Student) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      const result = await tuitionApi.resendInvitation(s.id);
      if (result.emailSent) {
        onAction(`New invitation sent to ${s.email}.`);
      } else {
        onAction(`Could not send the email${result.emailError ? `: ${result.emailError}` : ''}. Try again later.`, 'danger');
      }
    } catch (e) {
      onAction(e instanceof Error ? e.message : "Couldn't resend the invitation.", 'danger');
    } finally {
      setBusyId(null);
    }
  };

  if (!students.length) {
    return (
      <Card>
        <EmptyView
          icon={{ ios: 'envelope', android: 'mail' }}
          title="No pending invitations"
          text="Students you add will appear here until they activate their account by changing their password."
        />
      </Card>
    );
  }

  return (
    <>
      <Muted>{plural(students.length, 'invitation')}</Muted>
      <Card style={styles.listCard}>
        {students.map((s, i) => (
          <PendingInvitationRow
            key={s.id}
            student={s}
            last={i === students.length - 1}
            busy={busyId === s.id}
            onResend={() => resend(s)}
            onView={() => router.push(studentHref(s.id))}
          />
        ))}
      </Card>
    </>
  );
}

function PendingInvitationRow({ student: s, last, busy, onResend, onView }: {
  student: Student; last: boolean; busy: boolean; onResend: () => void; onView: () => void;
}) {
  const palette = usePalette();
  const statusLabel = s.invitationStatus === 'sent' ? 'Invitation Sent' : s.invitationStatus === 'send_failed' ? 'Email Not Sent' : 'Awaiting Send';
  const statusTone = s.invitationStatus === 'sent' ? 'success' : s.invitationStatus === 'send_failed' ? 'danger' : 'warning';
  const actionLabel = s.invitationStatus === 'send_failed' ? 'Retry Invitation' : 'Resend Invitation';

  return (
    <View style={[styles.pendingRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${s.name}'s details`} onPress={onView} style={styles.row}>
        <Avatar name={s.name} muted />
        <View style={styles.flex}>
          <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>{s.name}</Text>
          <Text style={[styles.email, { color: palette.mutedForeground }]} numberOfLines={1}>{s.email}</Text>
          <View style={styles.badges}>
            <Badge label={statusLabel} tone={statusTone} />
            {s.batch ? <Badge label={s.batch.name} tone="violet" /> : null}
            {s.invitedAt ? <Text style={[styles.invitedMeta, { color: palette.mutedForeground }]}>{timeAgo(s.invitedAt)}</Text> : null}
          </View>
        </View>
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
      </Pressable>
      <View style={styles.pendingActions}>
        <Button label={actionLabel} variant="tonal" icon={{ ios: 'envelope', android: 'mail' }} onPress={onResend} loading={busy} disabled={busy} style={styles.flex} />
      </View>
    </View>
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
              {student.accountStatus === 'invited' ? <Badge label="Invited" tone="warning" /> : null}
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

      {student.accountStatus === 'invited' ? (
        <>
          <SectionTitle title="Invitation" />
          <Card style={styles.listCard}>
            <InfoRow
              icon={{ ios: 'envelope', android: 'mail' }}
              label="Invitation status"
              value={student.invitationStatus === 'sent' ? 'Invitation Sent' : student.invitationStatus === 'send_failed' ? 'Email Not Sent' : 'Awaiting Send'}
              tone={student.invitationStatus === 'send_failed' ? 'warning' : undefined}
            />
            <InfoRow icon={{ ios: 'clock', android: 'schedule' }} label="Account status" value="Awaiting Account Activation" />
            {student.invitedAt ? <InfoRow icon={{ ios: 'calendar', android: 'event' }} label="Invited" value={timeAgo(student.invitedAt)} last /> : null}
          </Card>
          <Button
            label={student.invitationStatus === 'send_failed' ? 'Retry Invitation' : 'Resend Invitation'}
            variant="tonal"
            icon={{ ios: 'envelope', android: 'mail' }}
            onPress={() => run(
              async () => {
                const r = await tuitionApi.resendInvitation(student.id);
                if (!r.emailSent) throw new Error(r.emailError ?? "Couldn't send the email.");
                return r.student;
              },
              `New invitation sent to ${student.email}.`
            )}
            disabled={busy}
          />
        </>
      ) : null}

      <SectionTitle title="Login and account" />
      <Card style={styles.listCard}>
        <LoginStatus active={student.active} lastLoginAt={student.lastLoginAt} ago={timeAgo} />
        {student.accountStatus !== 'invited' ? (
          <ActionRow icon={{ ios: 'key', android: 'key' }} title="Reset password" subtitle="Set a new password and log them out" onPress={() => setResetting(true)} disabled={busy} />
        ) : null}
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

const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generatePassword(length = 14): string {
  const bytes = new Uint8Array(length);
  getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('');
}

type PasswordMode = 'generate' | 'manual';

/**
 * Adding a student (program JEE or NEET, class 11th or 12th, a batch if there
 * is one yet, and a starting password), or editing one. `initialBatchId`
 * starts a new student in that batch, with its program and class.
 *
 * For new students: includes password generation, enrollment method selection,
 * and adaptive UI based on batch selection.
 */
export function StudentForm({ onClose, student, batches, initialBatchId, onSaved }: {
  onClose: () => void;
  student?: Student;
  batches: Batch[];
  initialBatchId?: string | null;
  onSaved?: (s: Student) => void;
}) {
  const palette = usePalette();
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
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('generate');
  const [generatedPassword, setGeneratedPassword] = useState(() => generatePassword());
  const [manualPassword, setManualPassword] = useState('');
  const [enrollmentMethod, setEnrollmentMethod] = useState<EnrollmentMethod>('require_approval');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const password = passwordMode === 'generate' ? generatedPassword : manualPassword;
  const dirty = JSON.stringify({ name, email, phone, parentPhone, program, standard, batchId, password }) !== JSON.stringify(initial);
  const feedback = usePersonFeedback('student', student?.id);
  const allowLeave = usePersonFormGuard(dirty, saving);

  // Debounced email availability check (new students only).
  const [emailStatus, setEmailStatus] = useState<{ checking: boolean; msg: string | null; accountStatus?: string | null; studentId?: string | null }>({ checking: false, msg: null });
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkEmail = useCallback((value: string) => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || student) {
      setEmailStatus({ checking: false, msg: null });
      return;
    }
    setEmailStatus({ checking: true, msg: null });
    emailTimer.current = setTimeout(async () => {
      try {
        const result = await tuitionApi.checkStudentEmail(trimmed);
        setEmailStatus({ checking: false, msg: result.available ? null : (result.reason ?? 'This email is already in use.'), accountStatus: result.accountStatus, studentId: result.studentId });
      } catch {
        setEmailStatus({ checking: false, msg: null });
      }
    }, 600);
  }, [student]);
  useEffect(() => () => { if (emailTimer.current) clearTimeout(emailTimer.current); }, []);
  const onEmailChange = useCallback((value: string) => {
    setEmail(value);
    checkEmail(value);
  }, [checkEmail]);

  const hasBatch = batchId !== NO_BATCH;
  const chosenClass = standard === 'none' ? null : standard;
  const programs = programChoices(student?.program);
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

  const submitLabel = student
    ? 'Save changes'
    : !hasBatch
      ? 'Create Student'
      : enrollmentMethod === 'require_approval'
        ? 'Create Student & Request Approval'
        : 'Create Student & Enroll';

  const save = async () => {
    if (saving) return;
    if (!name.trim() || !email.trim()) return setError("Enter the student's name and email.");
    if (!student && emailStatus.msg) return setError(emailStatus.msg);
    if (!student && !chosenClass) return setError("Choose the student's class: 11th or 12th.");
    if (!student && password.length < 8) return setError('The password needs at least 8 characters.');
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
      if (student) {
        const saved = await tuitionApi.updateStudent(student.id, input);
        bumpDataVersion();
        allowLeave();
        feedback('Student details saved.');
        onSaved?.(saved);
        onClose();
      } else {
        const result = await tuitionApi.createStudent({
          ...input,
          password,
          enrollmentMethod: hasBatch ? enrollmentMethod : undefined,
        });
        bumpDataVersion();
        allowLeave();
        const msg = createSuccessMessage(result, email.trim());
        feedback(msg);
        onSaved?.(result.student);
        onClose();
      }
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
      submitLabel={submitLabel}
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <View style={styles.group}>
        <SectionTitle title="Student" />
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
        <Field label="Email" value={email} onChangeText={onEmailChange} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" hint={emailStatus.checking ? 'Checking email…' : emailStatus.msg ? undefined : 'They log in with this email.'} />
        {emailStatus.msg ? (
          <>
            <Notice tone="warning" text={emailStatus.msg} />
            {emailStatus.accountStatus === 'invited' && emailStatus.studentId ? (
              <Muted>You can resend their invitation from the Invitations tab in the student list.</Muted>
            ) : null}
          </>
        ) : null}
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
        {student ? (
          <Field label="Parent's phone" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" maxLength={20} />
        ) : null}
      </View>

      <View style={styles.group}>
        <SectionTitle title="Studies" />
        <Chips label="Program" choices={programs} selected={program ?? null} onChange={pickProgram} labels={PROGRAM_LABELS} />
        <Chips label="Class" choices={classChoices} selected={standard === 'none' && !student ? null : standard} onChange={pickClass} labels={{ none: 'Not set' }} />
        <OptionPicker label="Batch (optional)" options={batchOptions} selected={batchId} onChange={pickBatch} chipsUpTo={0} searchPlaceholder="Search batches" />
        <Muted>Picking a batch sets the program and class to the batch&apos;s.</Muted>
      </View>

      {!student ? (
        <>
          <View style={styles.group}>
            <SectionTitle title="Initial Password" />
            <Chips
              label="Password"
              choices={['generate', 'manual'] as const}
              selected={passwordMode}
              onChange={setPasswordMode}
              labels={{ generate: 'Generate Password', manual: 'Enter Manually' }}
            />
            {passwordMode === 'generate' ? (
              <View style={styles.generatedRow}>
                <PasswordField label="Generated password" value={generatedPassword} onChangeText={() => {}} editable={false} />
                <Button
                  label="Regenerate"
                  variant="secondary"
                  icon={{ ios: 'arrow.clockwise', android: 'refresh' }}
                  onPress={() => setGeneratedPassword(generatePassword())}
                  style={styles.regenBtn}
                />
              </View>
            ) : (
              <PasswordField
                label="Password"
                value={manualPassword}
                onChangeText={setManualPassword}
                hint="At least 8 characters."
                autoComplete="off"
              />
            )}
            <Notice
              tone="success"
              text="The student will receive their login details by email and must create a new password when signing in for the first time."
            />
          </View>

          {hasBatch ? (
            <View style={styles.group}>
              <SectionTitle title="Enrollment Method" />
              <EnrollmentMethodPicker value={enrollmentMethod} onChange={setEnrollmentMethod} />
            </View>
          ) : (
            <View style={styles.group}>
              <Card style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <Icon name={{ ios: 'clock.badge.questionmark', android: 'schedule' }} color={palette.primary} size={20} />
                  <Text style={[styles.infoCardTitle, { color: palette.foreground }]}>Batch Assignment Pending</Text>
                </View>
                <Muted>
                  The student account will be created now. A request will appear in Pending Approvals, where you can select a batch and complete enrollment later.
                </Muted>
              </Card>
            </View>
          )}
        </>
      ) : null}
    </PersonFormPage>
  );
}

function EnrollmentMethodPicker({ value, onChange }: { value: EnrollmentMethod; onChange: (v: EnrollmentMethod) => void }) {
  return (
    <View style={styles.methodGroup}>
      <MethodOption
        selected={value === 'require_approval'}
        onPress={() => onChange('require_approval')}
        title="Require Approval"
        description="Send this enrollment to Pending Approvals. The student will join the selected batch after approval."
        icon={{ ios: 'checkmark.shield', android: 'verified_user' }}
      />
      <MethodOption
        selected={value === 'enroll_immediately'}
        onPress={() => onChange('enroll_immediately')}
        title="Enroll Immediately"
        description="Add the student to the selected batch without requiring additional approval."
        icon={{ ios: 'bolt', android: 'flash_on' }}
      />
    </View>
  );
}

function MethodOption({ selected, onPress, title, description, icon }: {
  selected: boolean; onPress: () => void; title: string; description: string;
  icon: { ios: string; android: string };
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}: ${description}`}
      onPress={onPress}
      style={[
        styles.methodCard,
        { borderColor: selected ? palette.primary : palette.border, backgroundColor: selected ? palette.primarySoft : palette.card },
      ]}
    >
      <View style={styles.methodCardRow}>
        <Icon
          name={selected ? { ios: 'largecircle.fill.circle', android: 'radio_button_checked' } : { ios: 'circle', android: 'radio_button_unchecked' }}
          color={selected ? palette.primary : palette.mutedForeground}
          size={20}
        />
        <View style={styles.flex}>
          <Text style={[styles.methodTitle, { color: palette.foreground }]}>{title}</Text>
          <Text style={[styles.methodDesc, { color: palette.mutedForeground }]}>{description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function createSuccessMessage(result: CreateStudentResult, email: string): string {
  const { student, enrollment, emailSent, emailError } = result;
  const batchName = student.batch?.name;
  let msg: string;
  switch (enrollment) {
    case 'enrolled':
      msg = `Student created and enrolled in ${batchName}. `;
      break;
    case 'approval_pending':
      msg = 'Student account created. Enrollment request added to Pending Approvals. ';
      break;
    case 'batch_pending':
      msg = 'Student account created. Batch assignment added to Pending Approvals. ';
      break;
  }
  if (emailSent) {
    msg += `Invitation sent to ${email}. The student will appear under Invitations Pending until they activate their account.`;
  } else {
    msg += `Student invitation was created, but the email could not be sent${emailError ? `: ${emailError}` : ''}. You can retry from Invitations Pending.`;
  }
  return msg;
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
  generatedRow: { gap: 8 },
  regenBtn: { alignSelf: 'flex-start' },
  methodGroup: { gap: 10 },
  methodCard: { borderWidth: 1.5, borderRadius: 12, padding: 14 },
  methodCardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  methodTitle: { fontSize: 15, fontWeight: '700' },
  methodDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  infoCard: { gap: 8 },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoCardTitle: { fontSize: 15, fontWeight: '700' },
  pendingRow: { paddingVertical: 12, gap: 8 },
  pendingActions: { flexDirection: 'row', gap: 8, paddingLeft: 48 },
  invitedMeta: { fontSize: 12 },
});
