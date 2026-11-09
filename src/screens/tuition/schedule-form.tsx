import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Button, Chips, ErrorText, ErrorView, Field, LoadingView, Muted, MultiChips, useLoad, usePalette } from '@/components/kit';
import { FormPage, StackScreen, useDiscardGuard, useGoBack } from '@/components/stack-screen';
import type { SchoolSubject } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { OptionPicker, type PickerOption } from '@/screens/tuition/admin-ui';
import { BatchState, tuitionOnly, useBatch } from '@/screens/tuition/batch-screens';
import { setScheduleNotice } from '@/screens/tuition/schedule-notice';
import { verifyAdded, verifyRemoved, verifyUpdated, type ClassFields, type Verdict } from '@/screens/tuition/schedule-verify';
import { TimeField } from '@/screens/tuition/time-field';
import {
  classProblem,
  DAY_NAMES,
  DAY_SHORT,
  daysLabel,
  DEFAULT_END,
  DEFAULT_START,
  duration,
  endProblem,
  label12,
  TEACHING_DAYS,
  WEEK,
} from '@/screens/tuition/timetable-draft';
import { ApiError } from '@/services/api-client';
import { schoolApi, type TimetableEntry } from '@/services/school-api';
import { tuitionApi, type Batch, type Teacher } from '@/services/tuition-api';

const DAY_KEYS = WEEK.map(String) as readonly string[];
const DAY_LABELS = Object.fromEntries(WEEK.map((d) => [String(d), DAY_SHORT[d]]));
const NO_TEACHER = 'none';

/** One save: what to send, how to tell from the server's timetable that it went through, and what to say then. */
interface Job {
  send: () => Promise<unknown>;
  verify: (fresh: TimetableEntry[]) => Verdict;
  done: string;
}

/**
 * Add Class (no `entryId`) or Edit Class (`entryId`) for a batch's timetable.
 * Adding takes several days at once; a class being changed stays on one day.
 * The server also checks overlaps and the teacher's other batches.
 */
export const ScheduleFormScreen = tuitionOnly(function ScheduleFormScreen({ batchId, entryId }: { batchId: string; entryId?: string }) {
  const goBack = useGoBack();
  const version = useDataVersion();
  const batchLoad = useBatch(batchId);
  const timetable = useLoad(() => schoolApi.timetable(batchId), [batchId, version]);
  const title = entryId ? 'Edit Class' : 'Add Class';
  const batch = batchLoad.data?.batch;
  if (!batch) return <BatchState title={title} loading={batchLoad.loading} error={batchLoad.error} reload={batchLoad.reload} />;
  if (timetable.loading) {
    return (
      <StackScreen title={title} subtitle={batch.name} onBack={goBack}>
        <LoadingView label="Loading the timetable…" />
      </StackScreen>
    );
  }
  if (!timetable.data) {
    return (
      <StackScreen title={title} subtitle={batch.name} onBack={goBack}>
        <ErrorView message={`Couldn't load the timetable. ${timetable.error ?? ''}`} onRetry={timetable.reload} />
      </StackScreen>
    );
  }
  const classes = timetable.data.filter((e) => e.batch.id === batch.id);
  const entry = entryId ? classes.find((e) => e.id === entryId) : undefined;
  if (entryId && !entry) {
    return (
      <StackScreen title={title} subtitle={batch.name} onBack={goBack}>
        <Muted>This class is no longer in the timetable. It may have been removed.</Muted>
        <Button label="Back to the schedule" variant="secondary" onPress={goBack} />
      </StackScreen>
    );
  }
  return <ScheduleForm key={entry?.id ?? 'new'} batch={batch} classes={classes} entry={entry} />;
});

function ScheduleForm({ batch, classes, entry }: { batch: Batch; classes: TimetableEntry[]; entry?: TimetableEntry }) {
  const goBack = useGoBack();
  const teachers = useLoad(() => tuitionApi.assignableTeachers(), []);
  const [subject, setSubject] = useState<SchoolSubject | null>(entry?.subject ?? null);
  const [days, setDays] = useState<string[]>(entry ? [String(entry.day)] : []);
  const [start, setStart] = useState(entry?.start ?? DEFAULT_START);
  const [end, setEnd] = useState(entry?.end ?? DEFAULT_END);
  const [teacher, setTeacher] = useState<string>(entry?.teacher.id || NO_TEACHER);
  const [note, setNote] = useState(entry?.note ?? '');
  const [busy, setBusy] = useState(false);
  /** About the times or days, shown beside them. */
  const [fieldError, setFieldError] = useState<string | null>(null);
  /** From saving, e.g. the teacher is busy in another batch; shown by the button. */
  const [saveError, setSaveError] = useState<string | null>(null);

  const picked = days.map(Number);
  const problem = subject ? classProblem(classes, picked, start, end, entry?.id) : 'Pick the subject.';
  const dirty = entry
    ? subject !== entry.subject || days.join() !== String(entry.day) || start !== entry.start || end !== entry.end || teacher !== (entry.teacher.id || NO_TEACHER) || note !== entry.note
    : subject !== null || days.length > 0 || start !== DEFAULT_START || end !== DEFAULT_END || note !== '';
  const allowLeave = useDiscardGuard(dirty && !busy, 'Discard class changes?', 'Your unsaved class changes will be lost.');

  const batchTeachers = (s: SchoolSubject) => batch.teachers.filter((t) => t.subject === s).map((t) => t.teacherId);
  const pickSubject = (next: SchoolSubject) => {
    setSubject(next);
    setTeacher(batchTeachers(next)[0] ?? NO_TEACHER);
    setFieldError(null);
  };

  /** Taps while a save is in flight are ignored (state alone updates too late for a quick double tap). */
  const inFlight = useRef(false);
  /** A try whose answer never arrived and isn't confirmed yet: look at the server before sending anything again. */
  const unconfirmed = useRef<Job | null>(null);

  const finish = (message: string) => {
    setScheduleNotice(message);
    bumpDataVersion();
    allowLeave();
    goBack();
  };

  /** The batch's timetable as the server has it now; null when that can't be read either. */
  const check = async (job: Job): Promise<Verdict | null> => {
    try {
      const fresh = (await schoolApi.timetable(batch.id)).filter((e) => e.batch.id === batch.id);
      return job.verify(fresh);
    } catch {
      return null;
    }
  };

  /** Acts on what the server confirmed about an unanswered try. */
  const settle = (verdict: Verdict, job: Job) => {
    if (verdict.state === 'done') return finish(job.done);
    if (verdict.state === 'none') return setSaveError("That change wasn't saved. You can try again.");
    // Some days saved: keep only the missing ones in the form.
    bumpDataVersion();
    setDays(verdict.missing.map(String));
    setSaveError(`Added ${daysLabel(verdict.saved)}, but not ${daysLabel(verdict.missing)}. Check the times and add the rest.`);
  };

  const attempt = async (job: Job) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      if (unconfirmed.current) {
        const earlier = unconfirmed.current;
        const verdict = await check(earlier);
        if (!verdict) return setSaveError("Still can't reach the server, so we can't tell if the last change was saved. Check your connection and tap again.");
        unconfirmed.current = null;
        if (verdict.state !== 'none') return settle(verdict, earlier);
      }
      try {
        await job.send();
        finish(job.done);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 0) return setSaveError(e instanceof Error ? e.message : "Couldn't change the timetable.");
        // No answer: it may still have been saved. Never send it again before looking.
        unconfirmed.current = job;
        const verdict = await check(job);
        if (!verdict) return setSaveError("The server didn't answer, so we can't tell if it was saved. Check your connection and tap again to check.");
        unconfirmed.current = null;
        settle(verdict, job);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const save = () => {
    if (problem || !subject) return setFieldError(problem);
    const teacherId = teacher === NO_TEACHER ? null : teacher;
    const fields: ClassFields = { batchId: batch.id, subject, start, end, teacherId, note: note.trim() };
    if (entry) {
      void attempt({
        send: () => schoolApi.updateClass(entry.id, { subject, day: picked[0], start, end, note: fields.note, teacherId }),
        verify: (fresh) => verifyUpdated(fresh, entry.id, fields, picked[0]),
        done: 'Class updated successfully',
      });
      return;
    }
    const before = new Set(classes.map((c) => c.id));
    void attempt({
      send: () => schoolApi.addClasses({ batchId: batch.id, subject, days: picked, start, end, note: fields.note, teacherId }),
      verify: (fresh) => verifyAdded(fresh, before, fields, picked),
      done: picked.length > 1 ? `${picked.length} classes added successfully` : 'Class added successfully',
    });
  };

  const remove = (target: TimetableEntry) =>
    confirmAction(
      `Remove this ${target.subject} class?`,
      `${DAY_NAMES[target.day]}, ${label12(target.start)} – ${label12(target.end)} leaves ${batch.name}'s timetable. Its students and teacher stop seeing it.`,
      'Remove',
      () =>
        void attempt({
          send: () => schoolApi.deleteClass(target.id),
          verify: (fresh) => verifyRemoved(fresh, target.id),
          done: 'Class removed successfully',
        })
    );

  return (
    <FormPage
      title={entry ? 'Edit Class' : 'Add Class'}
      onBack={goBack}
      submitLabel={busy ? (entry ? 'Saving…' : picked.length > 1 ? 'Adding classes…' : 'Adding class…') : entry ? 'Save Changes' : picked.length > 1 ? `Add ${picked.length} Classes` : 'Add Class'}
      onSubmit={save}
      submitting={busy}
      error={saveError}
      extraAction={entry ? <Button label="Remove this class" variant="danger" icon={{ ios: 'trash', android: 'delete' }} onPress={() => remove(entry)} disabled={busy} /> : undefined}
    >
      <Muted>{batch.name}</Muted>
      <ScheduleFormFields
        batch={batch}
        editing={!!entry}
        subject={subject}
        onSubject={pickSubject}
        days={days}
        onDays={(next) => {
          // A class is on one day; to add more days, add them as new classes.
          setDays(entry ? next.filter((d) => !days.includes(d)).slice(-1) : next);
          setFieldError(null);
        }}
        start={start}
        end={end}
        onStart={(t) => {
          setStart(t);
          // The end picked before may no longer fit; say so and let them choose again.
          setFieldError(endProblem(t, end) && 'Start changed: pick a new end time (1 to 6 hours later).');
        }}
        onEnd={(t) => {
          const bad = endProblem(start, t);
          if (bad) return setFieldError(bad);
          setEnd(t);
          setFieldError(null);
        }}
        fieldError={fieldError}
        teacher={teacher}
        onTeacher={setTeacher}
        teachers={teachers}
        batchTeachers={batchTeachers}
        note={note}
        onNote={setNote}
        summary={
          problem ??
          `${subject} · ${daysLabel(picked)} · ${label12(start)} – ${label12(end)} (${duration(start, end)})${teacherLabel(teachers.data, teacher)}${note.trim() ? ` · ${note.trim()}` : ''}`
        }
        summaryIsProblem={!!problem}
      />
    </FormPage>
  );
}

const teacherLabel = (list: { id: string; name: string }[] | null, id: string) => {
  const name = id === NO_TEACHER ? null : list?.find((t) => t.id === id)?.name;
  return name ? ` · ${name}` : ' · no teacher yet';
};

interface FieldsProps {
  batch: Batch;
  editing: boolean;
  subject: SchoolSubject | null;
  onSubject: (s: SchoolSubject) => void;
  days: string[];
  onDays: (days: string[]) => void;
  start: string;
  end: string;
  onStart: (t: string) => void;
  onEnd: (t: string) => void;
  fieldError: string | null;
  teacher: string;
  onTeacher: (id: string) => void;
  teachers: { data: Teacher[] | null; error: string | null };
  batchTeachers: (s: SchoolSubject) => string[];
  note: string;
  onNote: (note: string) => void;
  summary: string;
  summaryIsProblem: boolean;
}

/** The fields of a class: subject, days, times, teacher and note, with what they add up to. */
function ScheduleFormFields(p: FieldsProps) {
  const palette = usePalette();
  const timeProblem = endProblem(p.start, p.end);
  const assigned = p.subject ? p.batchTeachers(p.subject) : [];
  const teacherOptions: PickerOption[] = [
    { value: NO_TEACHER, label: 'No teacher yet', pinned: true },
    ...(p.teachers.data ?? [])
      .filter((t) => p.subject && (t.subjects.includes(p.subject) || assigned.includes(t.id)))
      .sort((a, b) => Number(assigned.includes(b.id)) - Number(assigned.includes(a.id)) || a.name.localeCompare(b.name))
      .map((t) => ({ value: t.id, label: t.name, hint: assigned.includes(t.id) ? `Teaches ${p.subject} to this batch` : t.active ? t.email : `${t.email} · login off` })),
  ];

  return (
    <>
      <Chips label="Subject" choices={p.batch.subjects} selected={p.subject} onChange={p.onSubject} />
      <MultiChips label={p.editing ? 'Day' : 'Days'} choices={DAY_KEYS} selected={p.days} onChange={p.onDays} labels={DAY_LABELS} />
      {!p.editing ? (
        <View style={styles.quick}>
          <QuickLink label="Mon–Sat" onPress={() => p.onDays(TEACHING_DAYS.map(String))} />
          <QuickLink label="Mon, Wed, Fri" onPress={() => p.onDays(['1', '3', '5'])} />
          <QuickLink label="Tue, Thu, Sat" onPress={() => p.onDays(['2', '4', '6'])} />
          <QuickLink label="Clear" onPress={() => p.onDays([])} />
        </View>
      ) : null}
      <View style={styles.times}>
        <TimeField label="Start Time" value={p.start} onChange={p.onStart} />
        <TimeField label="End Time" value={p.end} onChange={p.onEnd} />
      </View>
      <Text style={[styles.preview, { color: timeProblem ? palette.dangerInk : palette.foreground }]}>
        {timeProblem ?? `${label12(p.start)} – ${label12(p.end)} · ${duration(p.start, p.end)}`}
      </Text>
      <ErrorText message={p.fieldError} />
      <Muted>Classes must last 1–6 hours.{p.editing ? '' : ' Select multiple days to repeat a class.'}</Muted>
      {p.subject ? (
        p.teachers.error && !p.teachers.data ? (
          <Muted>Couldn&apos;t load the teachers. The class can be saved without one.</Muted>
        ) : (
          <OptionPicker label="Teacher (optional)" options={teacherOptions} selected={p.teacher} onChange={p.onTeacher} searchPlaceholder={`Search ${p.subject} teachers`} />
        )
      ) : null}
      <Field label="Note (optional)" value={p.note} onChangeText={p.onNote} placeholder="e.g. Revision, Weekly test" maxLength={200} />
      <Text style={[styles.preview, { color: p.summaryIsProblem ? palette.mutedForeground : palette.foreground }]}>{p.summary}</Text>
    </>
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
  pressed: { opacity: 0.7 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  quickText: { fontSize: 13, fontWeight: '700' },
  times: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  preview: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
