import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, Chips, DetailSheet, ErrorText, ErrorView, Field, LoadingView, Muted, MultiChips, SectionTitle, useLoad, usePalette } from '@/components/kit';
import type { SchoolSubject } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { FlashNotice, OptionPicker, useFlash, type PickerOption } from '@/screens/tuition/admin-ui';
import { TimeField } from '@/screens/tuition/time-field';
import {
  classProblem,
  DAY_NAMES,
  DAY_SHORT,
  daysLabel,
  DEFAULT_END,
  DEFAULT_START,
  duration,
  label12,
  sortClasses,
  TEACHING_DAYS,
  WEEK,
  weeklyMinutes,
} from '@/screens/tuition/timetable-draft';
import { schoolApi, type TimetableEntry } from '@/services/school-api';
import { formatMinutes, tuitionApi, type Batch } from '@/services/tuition-api';

const DAY_KEYS = WEEK.map(String) as readonly string[];
const DAY_LABELS = Object.fromEntries(WEEK.map((d) => [String(d), DAY_SHORT[d]]));
const NO_TEACHER = 'none';

/**
 * A batch's subject timetable: its classes by day and time, each with a
 * subject, a teacher (or none yet) and a note such as "Revision". Add a
 * subject on one or several days at once, change or remove a class. Nothing
 * is put on any day by itself: each change is made with its own button, after
 * a preview of what it adds. Classes can't overlap in the batch, and a
 * teacher can't be in two batches at once (the server checks that).
 */
export function TimetableSheet({ visible, batch, onClose }: { visible: boolean; batch: Batch; onClose: () => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const timetable = useLoad(() => schoolApi.timetable(batch.id), [batch.id, version, visible], { enabled: visible });
  const teachers = useLoad(() => tuitionApi.teachers(), [visible], { enabled: visible });
  const [subject, setSubject] = useState<SchoolSubject | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [teacher, setTeacher] = useState<string>(NO_TEACHER);
  const [note, setNote] = useState('');
  /** The class being changed, or null when adding. */
  const [editing, setEditing] = useState<TimetableEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { flash, show, clear } = useFlash();

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setSubject(null);
      setDays([]);
      setStart(DEFAULT_START);
      setEnd(DEFAULT_END);
      setTeacher(NO_TEACHER);
      setNote('');
      setEditing(null);
      setFormError(null);
      clear();
    }
  }

  const classes = sortClasses((timetable.data ?? []).filter((e) => e.batch.id === batch.id));
  const picked = days.map(Number);
  const problem = subject ? classProblem(classes, picked, start, end, editing?.id) : 'Pick the subject.';
  const batchTeacher = (s: SchoolSubject) => batch.teachers.find((t) => t.subject === s)?.teacherId ?? null;
  const teacherName = teacher === NO_TEACHER ? null : teachers.data?.find((t) => t.id === teacher)?.name ?? null;

  const pickSubject = (next: SchoolSubject) => {
    setSubject(next);
    setTeacher(batchTeacher(next) ?? NO_TEACHER);
    setFormError(null);
  };
  const reset = () => {
    setEditing(null);
    setSubject(null);
    setDays([]);
    setTeacher(NO_TEACHER);
    setNote('');
    setFormError(null);
  };
  const edit = (entry: TimetableEntry) => {
    setEditing(entry);
    setSubject(entry.subject);
    setDays([String(entry.day)]);
    setStart(entry.start);
    setEnd(entry.end);
    setTeacher(entry.teacher.id || NO_TEACHER);
    setNote(entry.note);
    setFormError(null);
  };

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setFormError(null);
    clear();
    try {
      await action();
      bumpDataVersion();
      show(done);
      reset();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't change the timetable.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (problem || !subject) return setFormError(problem);
    const teacherId = teacher === NO_TEACHER ? null : teacher;
    if (editing) {
      return void run(
        () => schoolApi.updateClass(editing.id, { subject, day: picked[0], start, end, note: note.trim(), teacherId }),
        `${subject} class on ${DAY_NAMES[picked[0]]} changed.`
      );
    }
    void run(
      () => schoolApi.addClasses({ batchId: batch.id, subject, days: picked, start, end, note: note.trim(), teacherId }),
      `${picked.length === 1 ? `${subject} class` : `${picked.length} ${subject} classes`} added.`
    );
  };

  const remove = (entry: TimetableEntry) =>
    confirmAction(
      `Remove this ${entry.subject} class?`,
      `${DAY_NAMES[entry.day]}, ${label12(entry.start)} – ${label12(entry.end)} leaves ${batch.name}'s timetable. Its students and teacher stop seeing it.`,
      'Remove',
      () => void run(() => schoolApi.deleteClass(entry.id), `${entry.subject} class removed.`)
    );

  const clearOlder = () =>
    confirmAction(
      'Clear the older class times?',
      "They have no subject, and students and teachers don't see them. Add the classes with their subjects first if you still need them.",
      'Clear',
      () => void run(() => tuitionApi.updateBatch(batch.id, { schedule: [] }), 'Older class times cleared.')
    );

  const teacherOptions: PickerOption[] = [
    { value: NO_TEACHER, label: 'No teacher yet', pinned: true },
    ...(teachers.data ?? [])
      .filter((t) => subject && t.subjects.includes(subject))
      .sort((a, b) => Number(b.id === (subject && batchTeacher(subject))) - Number(a.id === (subject && batchTeacher(subject))) || a.name.localeCompare(b.name))
      .map((t) => ({ value: t.id, label: t.name, hint: subject && t.id === batchTeacher(subject) ? `Teaches ${subject} to this batch` : t.active ? t.email : `${t.email} · login off` })),
  ];
  const byDay = WEEK.map((day) => ({ day, list: classes.filter((c) => c.day === day) })).filter((d) => d.list.length);
  const noTeacher = classes.filter((c) => !c.teacher.id).length;

  return (
    <DetailSheet visible={visible} title={`Timetable · ${batch.name}`} onClose={onClose} footer={<Button label="Done" variant="secondary" onPress={onClose} />}>
      <FlashNotice flash={flash} onDismiss={clear} />

      <Card style={styles.form}>
        <SectionTitle title={editing ? `Change ${editing.subject}, ${DAY_NAMES[editing.day]} ${label12(editing.start)}` : 'Add a class'} />
        <Chips label="Subject" choices={batch.subjects} selected={subject} onChange={pickSubject} />
        <MultiChips
          label={editing ? 'Day' : 'Days'}
          choices={DAY_KEYS}
          selected={days}
          onChange={(next) => {
            // A class is on one day; to add more days, add them as new classes.
            setDays(editing ? next.filter((d) => !days.includes(d)).slice(-1) : next);
            setFormError(null);
          }}
          labels={DAY_LABELS}
        />
        {!editing ? (
          <View style={styles.quick}>
            <QuickLink label="Mon–Sat" onPress={() => setDays(TEACHING_DAYS.map(String))} />
            <QuickLink label="Mon, Wed, Fri" onPress={() => setDays(['1', '3', '5'])} />
            <QuickLink label="Tue, Thu, Sat" onPress={() => setDays(['2', '4', '6'])} />
            <QuickLink label="Clear" onPress={() => setDays([])} />
          </View>
        ) : null}
        <View style={styles.times}>
          <TimeField label="Starts" value={start} onChange={(t) => (setStart(t), setFormError(null))} />
          <TimeField label="Ends" value={end} onChange={(t) => (setEnd(t), setFormError(null))} />
        </View>
        {subject ? (
          teachers.error && !teachers.data ? (
            <Muted>Couldn&apos;t load the teachers. The class can be added without one.</Muted>
          ) : (
            <OptionPicker label="Teacher (optional)" options={teacherOptions} selected={teacher} onChange={setTeacher} searchPlaceholder={`Search ${subject} teachers`} />
          )
        ) : null}
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Revision, Weekly test" maxLength={200} />
        <Text style={[styles.preview, { color: problem ? palette.mutedForeground : palette.foreground }]}>
          {problem ??
            `${subject} · ${daysLabel(picked)} · ${label12(start)} – ${label12(end)} (${duration(start, end)})${teacherName ? ` · ${teacherName}` : ' · no teacher yet'}${note.trim() ? ` · ${note.trim()}` : ''}`}
        </Text>
        <ErrorText message={formError} />
        <View style={styles.row}>
          <Button
            label={editing ? 'Save class' : picked.length > 1 && subject ? `Add ${picked.length} ${subject} classes` : 'Add class'}
            icon={editing ? { ios: 'checkmark', android: 'check' } : { ios: 'plus', android: 'add' }}
            onPress={confirm}
            loading={busy}
            disabled={!!problem}
            style={styles.flex}
          />
          {editing ? <Button label="Cancel" variant="secondary" onPress={reset} disabled={busy} /> : null}
        </View>
        {editing ? <Button label="Remove this class" variant="danger" icon={{ ios: 'trash', android: 'delete' }} onPress={() => remove(editing)} disabled={busy} /> : null}
      </Card>

      <SectionTitle title={classes.length ? `The week · ${classes.length} classes · ${formatMinutes(weeklyMinutes(classes))}` : 'The week'} />
      {timetable.loading ? (
        <LoadingView label="Loading the timetable…" />
      ) : timetable.error && !timetable.data ? (
        <ErrorView message={`Couldn't load the timetable. ${timetable.error}`} onRetry={timetable.reload} />
      ) : byDay.length ? (
        <>
          {noTeacher ? <Muted>{noTeacher === 1 ? '1 class has' : `${noTeacher} classes have`} no teacher yet. Tap a class to assign one.</Muted> : null}
          {byDay.map(({ day, list }) => (
            <Card key={day} style={styles.listCard}>
              <Text style={[styles.dayName, { color: palette.primary }]}>{DAY_NAMES[day]}</Text>
              {list.map((c, i) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.subject}, ${label12(c.start)} to ${label12(c.end)}, ${c.teacher.name || 'no teacher'}${c.note ? `, ${c.note}` : ''}. Change`}
                  onPress={() => edit(c)}
                  style={({ pressed }) => [
                    styles.classRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
                    editing?.id === c.id && { backgroundColor: palette.primarySoft },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.timeCol, { borderRightColor: palette.primary }]}>
                    <Text style={[styles.time, { color: palette.foreground }]}>{label12(c.start)}</Text>
                    <Text style={[styles.timeEnd, { color: palette.mutedForeground }]}>{label12(c.end)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.subject, { color: palette.foreground }]}>{c.subject}</Text>
                    <Text style={[styles.meta, { color: c.teacher.id ? palette.mutedForeground : palette.warningInk }]} numberOfLines={1}>
                      {c.teacher.name || 'No teacher yet'}
                    </Text>
                  </View>
                  {c.note ? <Badge label={c.note} tone="violet" /> : null}
                </Pressable>
              ))}
            </Card>
          ))}
        </>
      ) : (
        <Card>
          <Muted>No classes yet. Pick a subject, its days and times above, then add it. Monday to Saturday are the usual days; Sunday only if you pick it.</Muted>
        </Card>
      )}

      {batch.schedule.length ? (
        <>
          <SectionTitle title="Older class times (no subject)" />
          <Card style={styles.listCard}>
            {batch.schedule.map((s, i) => (
              <View key={`${s.day}-${s.start}`} style={[styles.olderRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
                <Text style={[styles.olderDay, { color: palette.foreground }]}>{DAY_SHORT[s.day]}</Text>
                <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                  {label12(s.start)} – {label12(s.end)}
                </Text>
              </View>
            ))}
          </Card>
          <Muted>
            Saved before timetables had subjects, so students and teachers don&apos;t see them. They&apos;re kept as they are. Add the classes with their subjects above, then clear these.
          </Muted>
          <Button label="Clear older class times" variant="secondary" onPress={clearOlder} disabled={busy} />
        </>
      ) : null}
    </DetailSheet>
  );
}

function QuickLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Pick ${label}`} onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.quickText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  form: { gap: 12 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  quickText: { fontSize: 13, fontWeight: '700' },
  times: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  preview: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10 },
  listCard: { paddingVertical: 4 },
  dayName: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, paddingTop: 8, paddingBottom: 4 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 8 },
  timeCol: { width: 82, borderRightWidth: 2, paddingRight: 10 },
  time: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeEnd: { fontSize: 12, fontVariant: ['tabular-nums'] },
  subject: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 1 },
  olderRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  olderDay: { width: 40, fontSize: 14, fontWeight: '700' },
});
