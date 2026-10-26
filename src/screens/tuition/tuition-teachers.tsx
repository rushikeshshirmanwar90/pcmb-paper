import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
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
  usePalette,
  Icon,
} from '@/components/kit';
import { SCHOOL_SUBJECTS, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
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
  const pending = (data ?? []).filter((t) => t.pending);
  const approved = (data ?? []).filter((t) => !t.pending);

  return (
    <Screen title="Teachers" subtitle="Who teaches which subjects and batches" onRefresh={refresh} refreshing={refreshing}>
      <JoinCodeCard />
      {pending.length ? (
        <>
          <SectionTitle title={`Waiting for approval (${pending.length})`} />
          {pending.map((t) => (
            <PendingTeacher key={t.id} teacher={t} />
          ))}
        </>
      ) : null}

      <SectionTitle title="Your teachers" />
      <Button label="Add teacher" variant="secondary" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => setAdding(true)} />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !approved.length ? (
        <Card>
          <EmptyView
            icon={{ ios: 'person.crop.rectangle.stack', android: 'co_present' }}
            title="No teachers yet"
            text="Share your join code so teachers can sign up, or add one yourself with their email and a starting password."
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

/** The code teachers sign up with: share it, or make a new one. */
function JoinCodeCard() {
  const palette = usePalette();
  const user = useSignedInUser();
  const { data: code, error, setData } = useLoad(() => tuitionApi.joinCode(), []);
  const [busy, setBusy] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const share = () =>
    code &&
    Share.share({
      message: `Join ${user.tuition.name} on the PCMB app as a teacher: open the app, tap "Join your tuition" and enter the code ${code}.`,
    }).catch(() => {});

  const renew = () =>
    confirmAction('Make a new join code?', 'The current code stops working. Teachers who already signed up are not affected.', 'Make new code', async () => {
      setBusy(true);
      setRenewError(null);
      try {
        const next = await tuitionApi.renewJoinCode();
        setData(() => next);
      } catch (e) {
        setRenewError(e instanceof Error ? e.message : "Couldn't make a new code.");
      } finally {
        setBusy(false);
      }
    });

  return (
    <Card>
      <Text style={[styles.codeTitle, { color: palette.foreground }]}>Teacher join code</Text>
      <Text style={[styles.codeHelp, { color: palette.mutedForeground }]}>
        Teachers sign up in the app with this code. You approve each one before they can log in.
      </Text>
      <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <Text selectable accessibilityLabel={`Join code ${code ?? ''}`} style={[styles.code, { color: palette.foreground }]}>
          {code ?? '····-····'}
        </Text>
      </View>
      <ErrorText message={error ?? renewError} />
      <View style={styles.codeActions}>
        <Button label="Share code" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={share} disabled={!code} style={styles.flex2} />
        <Button label="New code" variant="secondary" onPress={renew} loading={busy} disabled={!code} style={styles.flex} />
      </View>
    </Card>
  );
}

/** A teacher who signed up with the join code: approve or reject. */
function PendingTeacher({ teacher }: { teacher: Teacher }) {
  const palette = usePalette();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (kind: 'approve' | 'reject') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'approve') await tuitionApi.approveTeacher(teacher.id);
      else await tuitionApi.deleteTeacher(teacher.id);
      bumpDataVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(null);
    }
  };

  return (
    <Card>
      <View style={styles.pendingTop}>
        <View style={[styles.pendingIcon, { backgroundColor: palette.warningSoft }]}>
          <Icon name={{ ios: 'person.crop.circle.badge.clock', android: 'pending' }} color={palette.warning} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.pendingName, { color: palette.foreground }]}>{teacher.name}</Text>
          <Text style={[styles.pendingMeta, { color: palette.mutedForeground }]}>{teacher.email}</Text>
          {teacher.phone ? <Text style={[styles.pendingMeta, { color: palette.mutedForeground }]}>{teacher.phone}</Text> : null}
        </View>
        <Text style={[styles.pendingMeta, { color: palette.mutedForeground }]}>{timeAgo(teacher.createdAt)}</Text>
      </View>
      <View style={styles.badges}>
        {teacher.subjects.map((s) => (
          <Badge key={s} label={s} tone="violet" />
        ))}
      </View>
      <ErrorText message={error} />
      <View style={styles.codeActions}>
        <Button
          label="Reject"
          variant="danger"
          onPress={() => confirmAction(`Reject ${teacher.name}?`, 'Their sign-up is deleted. They can ask again with the join code.', 'Reject', () => act('reject'))}
          loading={busy === 'reject'}
          disabled={busy !== null}
          style={styles.flex}
        />
        <Button label="Approve" onPress={() => act('approve')} loading={busy === 'approve'} disabled={busy !== null} style={styles.flex2} />
      </View>
    </Card>
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
  flex: { flex: 1 },
  flex2: { flex: 2 },
  codeTitle: { fontSize: 16, fontWeight: '700' },
  codeHelp: { fontSize: 13, lineHeight: 19 },
  codeBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  codeActions: { flexDirection: 'row', gap: 10 },
  pendingTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pendingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pendingName: { fontSize: 16, fontWeight: '700' },
  pendingMeta: { fontSize: 13 },
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
