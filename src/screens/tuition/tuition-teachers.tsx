import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  DetailSheet,
  EmptyView,
  ErrorView,
  Field,
  FormSheet,
  Icon,
  LoadingView,
  Muted,
  Notice,
  PasswordField,
  SectionTitle,
  useLoad,
  usePalette,
} from '@/components/kit';
import { SCHOOL_SUBJECTS, type SchoolSubject } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { ALL, batchesLost, filterTeachers, groupTeacherBatches, NO_SUBJECTS, plural, type TeacherFilter } from '@/screens/tuition/admin-filters';
import { ActionRow, Avatar, ClearFilters, FilterRow, FlashNotice, InfoRow, LoginStatus, PanelScroll, PersonHeader, SearchBox, useFlash } from '@/screens/tuition/admin-ui';
import { ResetPasswordSheet } from '@/screens/tuition/reset-password-sheet';
import { timeAgo, tuitionApi, type Teacher } from '@/services/tuition-api';

const EMPTY_FILTER: TeacherFilter = { search: '', subject: ALL };

/** "Maths" fits a chip better than "Mathematics". */
const SHORT_SUBJECT: Record<SchoolSubject, string> = { Physics: 'Physics', Chemistry: 'Chemistry', Mathematics: 'Maths', Biology: 'Biology' };

/** People › Teachers: add, edit, assign subjects, reset passwords, remove. */
export function TeachersPanel() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.teachers(), [version]);
  const [filter, setFilter] = useState<TeacherFilter>(EMPTY_FILTER);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, show, clear } = useFlash();
  const all = data ?? [];
  const shown = filterTeachers(all, filter);
  const open = all.find((t) => t.id === openId) ?? null;
  const filtering = filter.search.trim() !== '' || filter.subject !== ALL;
  const withoutSubjects = all.filter((t) => !t.subjects.length).length;

  const subjectFilters = [
    { value: ALL, label: 'All', count: all.length },
    ...SCHOOL_SUBJECTS.map((s) => ({ value: s, label: SHORT_SUBJECT[s], count: all.filter((t) => t.subjects.includes(s)).length })),
    ...(withoutSubjects ? [{ value: NO_SUBJECTS, label: 'No subjects', count: withoutSubjects }] : []),
  ] as { value: TeacherFilter['subject']; label: string; count: number }[];

  return (
    <PanelScroll onRefresh={refresh} refreshing={refreshing}>
      <Button label="Add teacher" icon={{ ios: 'person.badge.plus', android: 'person_add' }} onPress={() => setAdding(true)} />
      <FlashNotice flash={flash} onDismiss={clear} />
      {loading ? (
        <LoadingView label="Loading teachers…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the teachers. ${error}`} onRetry={reload} />
      ) : !all.length ? (
        <Card>
          <EmptyView
            icon={{ ios: 'person.crop.rectangle.stack', android: 'co_present' }}
            title="No teachers yet"
            text="People who join with your code show up here once you accept them as a teacher. You can also add one with their email and a starting password."
          />
        </Card>
      ) : (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          <SearchBox value={filter.search} onChangeText={(search) => setFilter((f) => ({ ...f, search }))} placeholder="Search by name or email" label="Search teachers" />
          <FilterRow label="Subject" options={subjectFilters} value={filter.subject} onChange={(subject) => setFilter((f) => ({ ...f, subject }))} />
          <View style={styles.countRow}>
            <Muted>{filtering ? `${plural(shown.length, 'teacher')} match` : plural(shown.length, 'teacher')}</Muted>
            {filtering ? <ClearFilters onPress={() => setFilter(EMPTY_FILTER)} /> : null}
          </View>
          {shown.length ? (
            <Card style={styles.listCard}>
              {shown.map((t, i) => (
                <TeacherRow key={t.id} teacher={t} onPress={() => setOpenId(t.id)} last={i === shown.length - 1} />
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyView
                icon={{ ios: 'magnifyingglass', android: 'search' }}
                title="No teachers match"
                text="Try another name, or another subject."
                action={<Button label="Clear filters" variant="secondary" onPress={() => setFilter(EMPTY_FILTER)} />}
              />
            </Card>
          )}
        </>
      )}

      <TeacherForm visible={adding} onClose={() => setAdding(false)} onSaved={(t) => show(`${t.name} added. Share their email and starting password with them.`)} />
      {open ? <TeacherDetail teacher={open} onClose={() => setOpenId(null)} onRemoved={(name) => show(`${name} removed.`)} /> : null}
    </PanelScroll>
  );
}

/** A teacher in the list: initials, name, email, subjects and how many batches. */
function TeacherRow({ teacher: t, onPress, last }: { teacher: Teacher; onPress: () => void; last: boolean }) {
  const palette = usePalette();
  const batchCount = groupTeacherBatches(t.batches).length;
  const label = [t.name, t.subjects.length ? t.subjects.join(', ') : 'No subjects', plural(batchCount, 'batch', 'batches'), !t.active ? 'Login off' : null]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the teacher's details"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <Avatar name={t.name} muted={!t.active} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
            {t.name}
          </Text>
          <Text style={[styles.batchCount, { color: batchCount ? palette.mutedForeground : palette.warningInk }]}>{plural(batchCount, 'batch', 'batches')}</Text>
        </View>
        <Text style={[styles.email, { color: palette.mutedForeground }]} numberOfLines={1}>
          {t.email}
        </Text>
        <View style={styles.badges}>
          {t.subjects.length ? t.subjects.map((s) => <Badge key={s} label={SHORT_SUBJECT[s]} tone="violet" />) : <Badge label="No subjects" tone="warning" />}
          {!t.active ? <Badge label="Login off" tone="danger" /> : null}
        </View>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

function TeacherDetail({ teacher, onClose, onRemoved }: { teacher: Teacher; onClose: () => void; onRemoved: (name: string) => void }) {
  const palette = usePalette();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const { flash, show, clear } = useFlash();
  const batches = groupTeacherBatches(teacher.batches);

  const run = async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true);
    clear();
    try {
      await action();
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
    teacher.active
      ? confirmAction(`Turn off ${teacher.name}'s login?`, "They are logged out and can't log in until you turn it back on.", 'Turn off', () =>
          run(() => tuitionApi.updateTeacher(teacher.id, { active: false }), 'Login turned off.')
        )
      : run(() => tuitionApi.updateTeacher(teacher.id, { active: true }), 'Login turned on. They can log in again.');

  const remove = () =>
    confirmAction(
      `Remove ${teacher.name}?`,
      'They leave your institute and all their batches, and their weekly classes are removed. Tests they set stay. Their own account stays, so they could ask to join again. This cannot be undone.',
      'Remove',
      () =>
      run(() => tuitionApi.deleteTeacher(teacher.id), `${teacher.name} removed.`, () => {
        onRemoved(teacher.name);
        onClose();
      })
    );

  return (
    <DetailSheet visible title={teacher.name} onClose={onClose} footer={<Button label="Edit teacher" icon={{ ios: 'pencil', android: 'edit' }} onPress={() => setEditing(true)} />}>
      <FlashNotice flash={flash} onDismiss={clear} />
      <Card>
        <PersonHeader name={teacher.name} line={teacher.email} badges={!teacher.active ? <Badge label="Login off" tone="danger" /> : <Badge label="Teacher" tone="primary" />} />
      </Card>

      <SectionTitle title="Subjects" />
      <Card>
        {teacher.subjects.length ? (
          <View style={styles.badgeWrap}>
            {teacher.subjects.map((s) => (
              <Badge key={s} label={s} tone="violet" />
            ))}
          </View>
        ) : (
          <Muted>No subjects yet. Tap Edit teacher to pick the subjects they teach; then you can assign them to batches.</Muted>
        )}
      </Card>

      <SectionTitle title={`Batches (${batches.length})`} />
      {batches.length ? (
        <Card style={styles.listCard}>
          {batches.map((b, i) => (
            <View
              key={b.id}
              accessible
              accessibilityLabel={`${b.name}: teaches ${b.subjects.join(', ')}`}
              style={[styles.batchRow, i < batches.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
            >
              <View style={[styles.batchIcon, { backgroundColor: palette.primarySoft }]}>
                <Icon name={{ ios: 'square.grid.2x2', android: 'grid_view' }} color={palette.primary} size={16} />
              </View>
              <Text style={[styles.batchName, { color: palette.foreground }]} numberOfLines={1}>
                {b.name}
              </Text>
              <View style={styles.badgeWrapEnd}>
                {b.subjects.map((s) => (
                  <Badge key={s} label={SHORT_SUBJECT[s]} tone="violet" />
                ))}
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Muted>Not teaching any batch yet. Assign them from the Batches tab: open a batch and tap Edit batch.</Muted>
        </Card>
      )}

      <SectionTitle title="Contact" />
      <Card style={styles.listCard}>
        <InfoRow icon={{ ios: 'envelope', android: 'mail' }} label="Email (login)" value={teacher.email} />
        <InfoRow icon={{ ios: 'phone', android: 'call' }} label="Phone" value={teacher.phone} last />
      </Card>

      <SectionTitle title="Login and account" />
      <Card style={styles.listCard}>
        <LoginStatus active={teacher.active} lastLoginAt={teacher.lastLoginAt} ago={timeAgo} />
        <ActionRow icon={{ ios: 'key', android: 'key' }} title="Reset password" subtitle="Set a new password and log them out" onPress={() => setResetting(true)} disabled={busy} />
        <ActionRow
          icon={{ ios: teacher.active ? 'lock' : 'lock.open', android: teacher.active ? 'lock' : 'lock_open' }}
          title={teacher.active ? 'Turn login off' : 'Turn login on'}
          subtitle={teacher.active ? 'Stops them logging in, keeps their details' : 'Lets them log in again'}
          onPress={toggleLogin}
          disabled={busy}
        />
        <ActionRow
          icon={{ ios: 'person.badge.minus', android: 'person_remove' }}
          title="Remove teacher"
          subtitle="Takes them out of your institute and its batches"
          tone="danger"
          onPress={remove}
          disabled={busy}
          last
        />
      </Card>

      <TeacherForm visible={editing} onClose={() => setEditing(false)} teacher={teacher} onSaved={() => show('Details saved.')} />
      <ResetPasswordSheet
        visible={resetting}
        name={teacher.name}
        onClose={() => setResetting(false)}
        onReset={(password) => tuitionApi.resetTeacherPassword(teacher.id, password)}
      />
    </DetailSheet>
  );
}

/** The four subjects as a 2 × 2 grid of toggles, clearer than a row of chips. */
function SubjectPicker({ selected, onChange }: { selected: SchoolSubject[]; onChange: (next: SchoolSubject[]) => void }) {
  const palette = usePalette();
  const toggle = (s: SchoolSubject) => {
    const next = selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s];
    onChange(SCHOOL_SUBJECTS.filter((x) => next.includes(x)));
  };
  return (
    <View style={styles.subjectWrap}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>Subjects they teach</Text>
      <View style={styles.subjectGrid}>
        {SCHOOL_SUBJECTS.map((s) => {
          const on = selected.includes(s);
          return (
            <Pressable
              key={s}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={s}
              onPress={() => toggle(s)}
              style={({ pressed }) => [
                styles.subjectToggle,
                { backgroundColor: on ? palette.primarySoft : palette.card, borderColor: on ? palette.primary : palette.border },
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={on ? { ios: 'checkmark.square.fill', android: 'check_box' } : { ios: 'square', android: 'check_box_outline_blank' }}
                color={on ? palette.primary : palette.mutedForeground}
                size={20}
              />
              <Text style={[styles.subjectText, { color: on ? palette.primaryInk : palette.foreground, fontWeight: on ? '700' : '500' }]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TeacherForm({ visible, onClose, teacher, onSaved }: { visible: boolean; onClose: () => void; teacher?: Teacher; onSaved?: (t: Teacher) => void }) {
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

  // Dropping a subject takes them off the batches they teach it to.
  const lost = teacher ? batchesLost(teacher, subjects) : [];

  const save = async () => {
    if (!name.trim() || !email.trim()) return setError('Enter the name and email.');
    if (!teacher && password.length < 8) return setError('The starting password needs at least 8 characters.');
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), email: email.trim(), phone: phone.trim(), subjects };
      const saved = teacher ? await tuitionApi.updateTeacher(teacher.id, input) : await tuitionApi.createTeacher({ ...input, password });
      bumpDataVersion();
      onClose();
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the teacher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={teacher ? `Edit ${teacher.name}` : 'Add teacher'}
      onClose={onClose}
      submitLabel={teacher ? 'Save changes' : 'Add teacher'}
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <View style={styles.group}>
        <SectionTitle title="Teacher" />
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" hint="They log in with this email." />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      </View>
      <View style={styles.group}>
        <SectionTitle title="Teaching" />
        <SubjectPicker selected={subjects} onChange={setSubjects} />
        {lost.length ? (
          <Notice
            tone="warning"
            title="Saving takes them off some batches"
            text={lost.map((b) => `${b.name} (${b.subject})`).join(', ')}
          />
        ) : (
          <Muted>A batch can only give them the subjects ticked here.</Muted>
        )}
      </View>
      {!teacher ? (
        <View style={styles.group}>
          <SectionTitle title="Login" />
          <PasswordField label="Starting password" value={password} onChangeText={setPassword} hint="At least 8 characters. Share it with them; they can change it." autoComplete="off" />
        </View>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  listCard: { paddingVertical: 0 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  batchCount: { fontSize: 12, fontWeight: '600', marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  email: { fontSize: 13, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgeWrapEnd: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: '50%' },
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 52 },
  batchIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  batchName: { flex: 1, fontSize: 15, fontWeight: '600' },
  group: { gap: 12 },
  subjectWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectToggle: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.2, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  subjectText: { fontSize: 15 },
});
