import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
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
  PasswordField,
  Screen,
  SectionTitle,
  useLoad,
} from '@/components/kit';
import { SCHOOL_SUBJECTS, type SchoolSubject } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { ResetPasswordSheet } from '@/screens/tuition/reset-password-sheet';
import { timeAgo, tuitionApi, type Teacher } from '@/services/tuition-api';

/** The tuition's teachers: add, edit, assign subjects, reset passwords, remove. */
export function TuitionTeachersScreen() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.teachers(), [version]);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data?.find((t) => t.id === openId) ?? null;
  const approved = data ?? [];

  return (
    <Screen title="Teachers" subtitle="Who teaches which subjects and batches" onRefresh={refresh} refreshing={refreshing}>
      <Button label="Add teacher" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => setAdding(true)} />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !approved.length ? (
        <Card>
          <EmptyView
            icon={{ ios: 'person.crop.rectangle.stack', android: 'co_present' }}
            title="No teachers yet"
            text="People who join with your code show up here once you accept them as a teacher. You can also add one with their email and a starting password."
          />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {approved.map((t, i) => (
            <ListRow
              key={t.id}
              icon={{ ios: 'person.fill', android: 'person' }}
              title={t.name}
              subtitle={[t.subjects.join(', ') || 'No subjects', `${t.batches.length} batch${t.batches.length === 1 ? '' : 'es'}`, !t.active ? 'Login off' : null].filter(Boolean).join(' · ')}
              onPress={() => setOpenId(t.id)}
              last={i === approved.length - 1}
            />
          ))}
        </Card>
      )}

      <TeacherForm visible={adding} onClose={() => setAdding(false)} />
      {open ? <TeacherDetail teacher={open} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

function TeacherDetail({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
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
    teacher.active
      ? confirmAction(`Turn off ${teacher.name}'s login?`, 'They are logged out and can\'t log in until you turn it back on.', 'Turn off', () =>
          run(() => tuitionApi.updateTeacher(teacher.id, { active: false }))
        )
      : run(() => tuitionApi.updateTeacher(teacher.id, { active: true }));

  const remove = () =>
    confirmAction(`Remove ${teacher.name}?`, 'Their login is deleted and they leave all their batches. This cannot be undone.', 'Remove', () =>
      run(() => tuitionApi.deleteTeacher(teacher.id), onClose)
    );

  return (
    <DetailSheet visible title={teacher.name} onClose={onClose} footer={<Button label="Edit teacher" onPress={() => setEditing(true)} />}>
      <ErrorText message={error} />
      <Card>
        <View style={styles.badges}>
          {teacher.subjects.map((s) => (
            <Badge key={s} label={s} tone="violet" />
          ))}
          {!teacher.active ? <Badge label="Login off" tone="danger" /> : null}
        </View>
        <DetailRow label="Email" value={teacher.email} />
        <DetailRow label="Phone" value={teacher.phone || 'Not set'} />
        <DetailRow label="Last login" value={teacher.lastLoginAt ? timeAgo(teacher.lastLoginAt) : 'Never'} />
      </Card>

      <SectionTitle title="Batches" />
      {teacher.batches.length ? (
        <Card style={styles.listCard}>
          {teacher.batches.map((b, i) => (
            <ListRow key={`${b.id}-${b.subject}`} title={b.name} subtitle={b.subject} last={i === teacher.batches.length - 1} />
          ))}
        </Card>
      ) : (
        <Muted>Not teaching any batch yet. Assign them from a batch&apos;s Edit page.</Muted>
      )}

      <SectionTitle title="Login" />
      <Card style={styles.listCard}>
        <ListRow icon={{ ios: 'key', android: 'key' }} title="Reset password" subtitle="Set a new password and log them out" onPress={() => setResetting(true)} />
        <ListRow
          icon={{ ios: teacher.active ? 'lock' : 'lock.open', android: teacher.active ? 'lock' : 'lock_open' }}
          title={teacher.active ? 'Turn login off' : 'Turn login on'}
          subtitle={teacher.active ? 'Stops them logging in, keeps their details' : 'Lets them log in again'}
          onPress={busy ? undefined : toggleLogin}
        />
        <ListRow icon={{ ios: 'person.badge.minus', android: 'person_remove' }} title="Remove teacher" onPress={busy ? undefined : remove} last />
      </Card>

      <TeacherForm visible={editing} onClose={() => setEditing(false)} teacher={teacher} />
      <ResetPasswordSheet
        visible={resetting}
        name={teacher.name}
        onClose={() => setResetting(false)}
        onReset={(password) => tuitionApi.resetTeacherPassword(teacher.id, password)}
      />
    </DetailSheet>
  );
}

function TeacherForm({ visible, onClose, teacher }: { visible: boolean; onClose: () => void; teacher?: Teacher }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setName(teacher?.name ?? '');
      setEmail(teacher?.email ?? '');
      setPhone(teacher?.phone ?? '');
      setSubjects(teacher?.subjects ?? []);
      setPassword('');
      setError(null);
    }
  }

  const save = async () => {
    if (!name.trim() || !email.trim()) return setError('Enter the name and email.');
    if (!teacher && password.length < 8) return setError('The starting password needs at least 8 characters.');
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), email: email.trim(), phone: phone.trim(), subjects };
      if (teacher) await tuitionApi.updateTeacher(teacher.id, input);
      else await tuitionApi.createTeacher({ ...input, password });
      bumpDataVersion();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the teacher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title={teacher ? 'Edit teacher' : 'Add teacher'} onClose={onClose} submitLabel={teacher ? 'Save' : 'Add teacher'} onSubmit={save} submitting={saving} error={error}>
      <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" hint="They log in with this email." />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      <MultiChips label="Subjects" choices={SCHOOL_SUBJECTS} selected={subjects} onChange={setSubjects} />
      {!teacher ? (
        <PasswordField label="Starting password" value={password} onChangeText={setPassword} hint="At least 8 characters. Share it with them; they can change it." autoComplete="off" />
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
