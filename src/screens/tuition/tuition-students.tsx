import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
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
  Icon,
  ListRow,
  LoadingView,
  PasswordField,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { SCHOOL_STANDARDS, TRACK_LABELS, TRACKS, type Track } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { ResetPasswordSheet } from '@/screens/tuition/reset-password-sheet';
import { timeAgo, tuitionApi, type Batch, type Student } from '@/services/tuition-api';

const ALL = 'all';
const NONE = 'none';

/** The tuition's students: search, filter by batch, enroll, edit and move between batches. */
export function TuitionStudentsScreen() {
  const palette = usePalette();
  const version = useDataVersion();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [enrolling, setEnrolling] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Search once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const batches = useLoad(() => tuitionApi.batches(), [version]);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(
    () => tuitionApi.students({ q: query, batchId: batchFilter === ALL ? null : batchFilter }),
    [query, batchFilter, version]
  );
  const open = data?.find((s) => s.id === openId) ?? null;
  const batchList = batches.data ?? [];
  const filterChoices = [ALL, ...batchList.map((b) => b.id), NONE];
  const filterLabels = Object.fromEntries([[ALL, 'All'], [NONE, 'No batch'], ...batchList.map((b) => [b.id, b.name])]);

  return (
    <Screen title="Students" subtitle="Enroll students and assign their batch" onRefresh={refresh} refreshing={refreshing}>
      <Button label="Enroll student" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => setEnrolling(true)} />
      <View style={[styles.search, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search' }} color={palette.mutedForeground} size={18} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email"
          placeholderTextColor={palette.mutedForeground}
          accessibilityLabel="Search students"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: palette.foreground }]}
        />
      </View>
      <Chips choices={filterChoices} selected={batchFilter} onChange={setBatchFilter} labels={filterLabels} />

      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Card>
          <EmptyView
            icon={{ ios: 'person.3', android: 'groups' }}
            title={query || batchFilter !== ALL ? 'No students match' : 'No students yet'}
            text={query || batchFilter !== ALL ? 'Try another search or batch.' : 'Enroll a student with their email and a starting password.'}
          />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {data.map((s, i) => (
            <ListRow
              key={s.id}
              icon={{ ios: 'person.fill', android: 'person' }}
              title={s.name}
              subtitle={[s.track ? TRACK_LABELS[s.track] : null, s.standard, s.batch?.name ?? 'No batch', !s.active ? 'Login off' : null].filter(Boolean).join(' · ')}
              onPress={() => setOpenId(s.id)}
              last={i === data.length - 1}
            />
          ))}
        </Card>
      )}

      <StudentForm visible={enrolling} onClose={() => setEnrolling(false)} batches={batchList} />
      {open ? <StudentDetail student={open} batches={batchList} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

function StudentDetail({ student, batches, onClose }: { student: Student; batches: Batch[]; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      bumpDataVersion();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const toggleLogin = () =>
    student.active
      ? confirmAction(`Turn off ${student.name}'s login?`, "They are logged out and can't log in until you turn it back on.", 'Turn off', () =>
          run(() => tuitionApi.updateStudent(student.id, { active: false }))
        )
      : run(() => tuitionApi.updateStudent(student.id, { active: true }));

  const remove = () =>
    confirmAction(`Remove ${student.name}?`, 'Their login and details are deleted. This cannot be undone.', 'Remove', () =>
      run(() => tuitionApi.deleteStudent(student.id), onClose)
    );

  return (
    <DetailSheet visible title={student.name} onClose={onClose} footer={<Button label="Edit student" onPress={() => setEditing(true)} />}>
      <ErrorText message={error} />
      <Card>
        <View style={styles.badges}>
          {student.track ? <Badge label={TRACK_LABELS[student.track]} tone="primary" /> : null}
          {student.standard ? <Badge label={student.standard} /> : null}
          {!student.active ? <Badge label="Login off" tone="danger" /> : null}
        </View>
        <DetailRow label="Batch" value={student.batch?.name ?? 'No batch'} />
        <DetailRow label="Email" value={student.email} />
        <DetailRow label="Phone" value={student.phone || 'Not set'} />
        <DetailRow label="Parent's phone" value={student.parentPhone || 'Not set'} />
        <DetailRow label="Last login" value={student.lastLoginAt ? timeAgo(student.lastLoginAt) : 'Never'} />
      </Card>

      <SectionTitle title="Login" />
      <Card style={styles.listCard}>
        <ListRow icon={{ ios: 'key', android: 'key' }} title="Reset password" subtitle="Set a new password and log them out" onPress={() => setResetting(true)} />
        <ListRow
          icon={{ ios: student.active ? 'lock' : 'lock.open', android: student.active ? 'lock' : 'lock_open' }}
          title={student.active ? 'Turn login off' : 'Turn login on'}
          subtitle={student.active ? 'Stops them logging in, keeps their details' : 'Lets them log in again'}
          onPress={busy ? undefined : toggleLogin}
        />
        <ListRow icon={{ ios: 'person.badge.minus', android: 'person_remove' }} title="Remove student" onPress={busy ? undefined : remove} last />
      </Card>

      <StudentForm visible={editing} onClose={() => setEditing(false)} student={student} batches={batches} />
      <ResetPasswordSheet
        visible={resetting}
        name={student.name}
        onClose={() => setResetting(false)}
        onReset={(password) => tuitionApi.resetStudentPassword(student.id, password)}
      />
    </DetailSheet>
  );
}

const STANDARD_CHOICES = ['none', ...SCHOOL_STANDARDS] as const;
type StandardChoice = (typeof STANDARD_CHOICES)[number];

function StudentForm({ visible, onClose, student, batches }: { visible: boolean; onClose: () => void; student?: Student; batches: Batch[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [track, setTrack] = useState<Track>('NEET');
  const [standard, setStandard] = useState<StandardChoice>('none');
  const [batchId, setBatchId] = useState<string>(NONE);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setName(student?.name ?? '');
      setEmail(student?.email ?? '');
      setPhone(student?.phone ?? '');
      setParentPhone(student?.parentPhone ?? '');
      setTrack(student?.track ?? 'NEET');
      setStandard(student?.standard ?? 'none');
      setBatchId(student?.batch?.id ?? NONE);
      setPassword('');
      setError(null);
    }
  }

  // Batches of the student's track first; the others still allowed.
  const sorted = [...batches].sort((a, b) => Number(b.track === track) - Number(a.track === track) || a.name.localeCompare(b.name));
  const batchChoices = [NONE, ...sorted.map((b) => b.id)];
  const batchLabels = Object.fromEntries([[NONE, 'No batch'], ...sorted.map((b) => [b.id, b.track === track ? b.name : `${b.name} (${b.track})`])]);

  const save = async () => {
    if (!name.trim() || !email.trim()) return setError("Enter the student's name and email.");
    if (!student && password.length < 8) return setError('The starting password needs at least 8 characters.');
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      parentPhone: parentPhone.trim(),
      track,
      standard: standard === 'none' ? null : standard,
      batchId: batchId === NONE ? null : batchId,
    };
    try {
      if (student) await tuitionApi.updateStudent(student.id, input);
      else await tuitionApi.createStudent({ ...input, password });
      bumpDataVersion();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the student.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title={student ? 'Edit student' : 'Enroll student'} onClose={onClose} submitLabel={student ? 'Save' : 'Enroll'} onSubmit={save} submitting={saving} error={error}>
      <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" hint="They log in with this email." />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      <Field label="Parent's phone" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" maxLength={20} />
      <Chips label="Preparing for" choices={TRACKS} selected={track} onChange={setTrack} labels={TRACK_LABELS} />
      <Chips label="Class" choices={STANDARD_CHOICES} selected={standard} onChange={setStandard} labels={{ none: 'Not set' }} />
      <Chips label="Batch" choices={batchChoices} selected={batchId} onChange={setBatchId} labels={batchLabels} />
      {!student ? (
        <PasswordField label="Starting password" value={password} onChangeText={setPassword} hint="At least 8 characters. Share it with them; they can change it." autoComplete="off" />
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
});
