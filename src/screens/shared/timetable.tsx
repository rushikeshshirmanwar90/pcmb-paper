import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Button, Card, Chips, Field, FormSheet, Muted, usePalette } from '@/components/kit';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, type SchoolSubject } from '@/constants/school';
import { bumpDataVersion } from '@/context/data-version';
import { TimeField } from '@/screens/tuition/time-field';
import { DEFAULT_END, DEFAULT_START, label12 } from '@/screens/tuition/timetable-draft';
import { schoolApi, type TimetableEntry } from '@/services/school-api';
import { formatTime } from '@/services/tuition-api';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

/** One class: time, subject, batch and teacher. */
export function ClassRow({ entry, showTeacher = true, onPress }: { entry: TimetableEntry; showTeacher?: boolean; onPress?: () => void }) {
  const palette = usePalette();
  const body = (
    <View style={styles.classRow}>
      <View style={[styles.timeCol, { borderRightColor: palette.primary }]}>
        <Text style={[styles.time, { color: palette.foreground }]}>{formatTime(entry.start)}</Text>
        <Text style={[styles.timeEnd, { color: palette.mutedForeground }]}>{formatTime(entry.end)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.subject, { color: palette.foreground }]}>{entry.subject}</Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
          {[entry.batch.name, entry.batch.venue, showTeacher ? entry.teacher.name : null, entry.note || null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${entry.subject} at ${formatTime(entry.start)}, edit`} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** The week's classes, day by day. Classes the user may change open onEdit. */
export function WeekTimetable({ entries, onEdit, showTeacher = true, emptyText }: { entries: TimetableEntry[]; onEdit?: (e: TimetableEntry) => void; showTeacher?: boolean; emptyText: string }) {
  const palette = usePalette();
  const days = DAY_ORDER.filter((d) => entries.some((e) => e.day === d));
  if (!days.length) return <Muted>{emptyText}</Muted>;
  return (
    <>
      {days.map((day) => (
        <Card key={day}>
          <Text style={[styles.dayName, { color: palette.primary }]}>{WEEKDAY_NAMES[day]}</Text>
          {entries
            .filter((e) => e.day === day)
            .map((e) => (
              <ClassRow key={e.id} entry={e} showTeacher={showTeacher} onPress={onEdit && e.mine ? () => onEdit(e) : undefined} />
            ))}
        </Card>
      ))}
    </>
  );
}

const DAY_KEYS = DAY_ORDER.map(String);
const DAY_LABELS = Object.fromEntries(DAY_KEYS.map((d) => [d, WEEKDAY_SHORT[Number(d)]]));

/** Adds or edits one of the teacher's weekly classes. */
export function ClassFormSheet({
  visible,
  onClose,
  batches,
  entry,
}: {
  visible: boolean;
  onClose: () => void;
  /** The batches the teacher teaches, with their subjects there. */
  batches: { id: string; name: string; mySubjects: SchoolSubject[] }[];
  entry?: TimetableEntry | null;
}) {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [subject, setSubject] = useState<SchoolSubject | null>(null);
  const [day, setDay] = useState<string>('1');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      const first = batches[0];
      setBatchId(entry?.batch.id ?? first?.id ?? null);
      setSubject(entry?.subject ?? first?.mySubjects[0] ?? null);
      setDay(String(entry?.day ?? 1));
      setStart(entry?.start ?? DEFAULT_START);
      setEnd(entry?.end ?? DEFAULT_END);
      setNote(entry?.note ?? '');
      setError(null);
    }
  }

  const batch = batches.find((b) => b.id === batchId);
  const pickBatch = (id: string) => {
    setBatchId(id);
    const next = batches.find((b) => b.id === id);
    if (next && (!subject || !next.mySubjects.includes(subject))) setSubject(next.mySubjects[0] ?? null);
  };

  const save = async () => {
    if (!batchId || !subject) return setError('Pick the batch and subject.');
    if (end <= start) return setError('The class must end after it starts.');
    setSaving(true);
    setError(null);
    const input = { batchId, subject, day: Number(day), start, end, note: note.trim() };
    try {
      if (entry) await schoolApi.updateClass(entry.id, input);
      else await schoolApi.addClass(input);
      bumpDataVersion();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the class.");
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    entry &&
    confirmAction('Delete this class?', `${entry.subject} on ${WEEKDAY_NAMES[entry.day]} at ${formatTime(entry.start)} leaves the timetable.`, 'Delete', async () => {
      try {
        await schoolApi.deleteClass(entry.id);
        bumpDataVersion();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete the class.");
      }
    });

  return (
    <FormSheet
      visible={visible}
      title={entry ? 'Edit class' : 'Add a class'}
      onClose={onClose}
      submitLabel={entry ? 'Save' : 'Add to timetable'}
      onSubmit={save}
      submitting={saving}
      error={error}
      extraAction={entry ? <Button label="Delete class" variant="danger" onPress={remove} /> : undefined}
    >
      {batches.length === 0 ? (
        <Muted>You don&apos;t teach any batch yet. Your tuition assigns you to batches.</Muted>
      ) : (
        <>
          <Chips label="Batch" choices={batches.map((b) => b.id)} selected={batchId} onChange={pickBatch} labels={Object.fromEntries(batches.map((b) => [b.id, b.name]))} />
          {batch ? <Chips label="Subject" choices={batch.mySubjects} selected={subject} onChange={setSubject} /> : null}
          <Chips label="Day" choices={DAY_KEYS} selected={day} onChange={setDay} labels={DAY_LABELS} />
          <View style={styles.times}>
            <TimeField label="Starts" value={start} onChange={setStart} />
            <TimeField label="Ends" value={end} onChange={setEnd} />
          </View>
          <Muted>{end > start ? `${label12(start)} – ${label12(end)}` : 'The class must end after it starts.'}</Muted>
          <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Doubt session (optional)" maxLength={200} />
          <Muted>Students of the batch see this class in their timetable and get a reminder before it.</Muted>
        </>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  classRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4 },
  timeCol: { width: 76, borderRightWidth: 2, paddingRight: 10 },
  time: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeEnd: { fontSize: 12, fontVariant: ['tabular-nums'] },
  subject: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 1 },
  dayName: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  times: { flexDirection: 'row', gap: 10 },
});
