import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailSheet,
  EmptyView,
  ErrorView,
  Field,
  FormSheet,
  Icon,
  LoadingView,
  Muted,
  MultiChips,
  Notice,
  ProgressBar,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import {
  academicYearChoices,
  academicYearOf,
  formatAcademicYear,
  OFFERED_PROGRAMS,
  PROGRAM_INFO,
  PROGRAM_LABELS,
  programChoices,
  PROGRAMS,
  SCHOOL_STANDARDS,
  subjectProblem,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  type Program,
  type SchoolStandard,
  type SchoolSubject,
} from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { BatchAnalysisSection } from '@/screens/shared/batch-analysis';
import {
  ALL,
  countBy,
  EMPTY_BATCH_FILTER,
  filterBatches,
  missingTeachers,
  NO_CLASS,
  plural,
  setupOf,
  suggestBatchName,
  type BatchFilter,
  type SetupStep,
} from '@/screens/tuition/admin-filters';
import { ActionRow, Avatar, ClearFilters, FilterRow, FlashNotice, InfoRow, OptionPicker, programTone, useFlash, type FilterOption, type PickerOption } from '@/screens/tuition/admin-ui';
import { showStudents } from '@/screens/tuition/people-nav';
import { WeekTimetable } from '@/screens/shared/timetable';
import { TimetableSheet } from '@/screens/tuition/timetable-sheet';
import { schoolApi } from '@/services/school-api';
import { formatMinutes, tuitionApi, type Batch, type BatchInput } from '@/services/tuition-api';

const STUDENTS_SHOWN = 8;

/** Older batches may be for both classes. */
const classLabel = (b: Pick<Batch, 'standard'>) => b.standard ?? '11th & 12th';
const yearLabel = (b: Pick<Batch, 'academicYear'>) => (b.academicYear ? formatAcademicYear(b.academicYear) : null);
const yearLabels = (years: string[]) => Object.fromEntries(years.map((y) => [y, formatAcademicYear(y)]));

/** "No teacher for Biology · No students yet · No class timings" */
function stillToDo(batch: Batch) {
  const missing = missingTeachers(batch);
  return [
    missing.length ? `No teacher for ${missing.join(', ')}` : null,
    batch.studentCount ? null : 'No students yet',
    batch.classes.classes ? null : 'No timetable yet',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Which question bank the program's students practise from, in plain words. */
function bankNote(program: Program) {
  const bank = PROGRAM_INFO[program].questionBank;
  return bank
    ? `Students practise ${bank} past-year questions.`
    : `There's no ${PROGRAM_INFO[program].label} question bank yet, so students won't get practice questions. Tests, timings and announcements work as usual.`;
}

/** The tuition's batches: filter by program and class, create, open, edit and delete. */
export function TuitionBatchesScreen() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.batches(), [version]);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<{ id: string; notice?: string } | null>(null);
  const [filter, setFilter] = useState<BatchFilter>(EMPTY_BATCH_FILTER);
  const { flash, show, clear } = useFlash();
  const list = data ?? [];
  const shown = filterBatches(list, filter);
  const filtered = filter.program !== ALL || filter.standard !== ALL;
  const needTeachers = list.filter((b) => missingTeachers(b).length > 0);
  const students = list.reduce((sum, b) => sum + b.studentCount, 0);

  const byProgram = countBy(list, (b) => b.program);
  const byClass = countBy(list, (b) => b.standard ?? NO_CLASS);
  // A filter for a program or class that no longer has batches falls back to All.
  if (data && filter.program !== ALL && !byProgram.has(filter.program)) setFilter((f) => ({ ...f, program: ALL }));
  if (data && filter.standard !== ALL && !byClass.has(filter.standard)) setFilter((f) => ({ ...f, standard: ALL }));
  const programOptions: FilterOption<BatchFilter['program']>[] = [
    { value: ALL, label: 'All', count: list.length },
    ...PROGRAMS.filter((p) => byProgram.has(p)).map((p) => ({ value: p, label: PROGRAM_LABELS[p], count: byProgram.get(p) })),
  ];
  const classOptions: FilterOption<BatchFilter['standard']>[] = [
    { value: ALL, label: 'All', count: list.length },
    ...SCHOOL_STANDARDS.filter((s) => byClass.has(s)).map((s): FilterOption<BatchFilter['standard']> => ({ value: s, label: s, count: byClass.get(s) })),
    ...(byClass.has(NO_CLASS) ? [{ value: NO_CLASS, label: '11th & 12th', count: byClass.get(NO_CLASS) } as FilterOption<BatchFilter['standard']>] : []),
  ];

  return (
    <Screen title="Batches" subtitle="Programs, classes, teachers and students" onRefresh={refresh} refreshing={refreshing}>
      <Button label="New batch" icon={{ ios: 'plus', android: 'add' }} onPress={() => setCreating(true)} />
      <FlashNotice flash={flash} onDismiss={clear} />
      {loading ? (
        <LoadingView label="Loading batches…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the batches. ${error}`} onRetry={reload} />
      ) : !list.length ? (
        <Card>
          <EmptyView
            icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
            title="No batches yet"
            text="Create one for each program and class you teach, e.g. NEET 11th A. Teachers, timings and students can be added afterwards."
          />
        </Card>
      ) : (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          {list.length > 1 ? (
            <View style={styles.filters}>
              {programOptions.length > 2 ? (
                <FilterRow label="Program" options={programOptions} value={filter.program} onChange={(program) => setFilter((f) => ({ ...f, program }))} />
              ) : null}
              {classOptions.length > 2 ? (
                <FilterRow label="Class" options={classOptions} value={filter.standard} onChange={(standard) => setFilter((f) => ({ ...f, standard }))} />
              ) : null}
            </View>
          ) : null}
          <View style={styles.countRow}>
            <Muted style={styles.flex}>
              {filtered
                ? `${shown.length} of ${plural(list.length, 'batch', 'batches')}`
                : `${plural(list.length, 'batch', 'batches')} · ${plural(students, 'student')} in batches`}
            </Muted>
            {filtered ? <ClearFilters onPress={() => setFilter(EMPTY_BATCH_FILTER)} /> : null}
          </View>
          {needTeachers.length && !filtered ? (
            <Notice
              tone="warning"
              title={`${plural(needTeachers.length, 'batch', 'batches')} ${needTeachers.length === 1 ? 'needs' : 'need'} a teacher`}
              text="Open the batch and tap Assign teachers."
            />
          ) : null}
          {shown.length ? (
            shown.map((batch) => <BatchCard key={batch.id} batch={batch} onPress={() => setOpen({ id: batch.id })} />)
          ) : (
            <Card>
              <EmptyView icon={{ ios: 'line.3.horizontal.decrease.circle', android: 'filter_list' }} title="No batches match" text="Try another program or class." />
            </Card>
          )}
        </>
      )}

      <NewBatchSheet
        visible={creating}
        batches={list}
        onClose={() => setCreating(false)}
        onCreated={(b) => show(`${b.name} created.`)}
        onOpen={(id) => {
          setCreating(false);
          setOpen({ id });
        }}
      />
      {open ? (
        <BatchDetail key={open.id} id={open.id} notice={open.notice} onClose={() => setOpen(null)} onDeleted={(name) => show(`${name} deleted.`)} />
      ) : null}
    </Screen>
  );
}

/** A batch at a glance: program, class and year, students, teachers assigned, class days, what's left to set up. */
function BatchCard({ batch, onPress }: { batch: Batch; onPress: () => void }) {
  const palette = usePalette();
  const missing = missingTeachers(batch);
  const assigned = batch.subjects.length - missing.length;
  const setup = setupOf(batch);
  const year = yearLabel(batch);
  const label = [
    batch.name,
    PROGRAM_LABELS[batch.program],
    classLabel(batch),
    year ? `academic year ${year}` : null,
    plural(batch.studentCount, 'student'),
    `${assigned} of ${batch.subjects.length} teachers assigned`,
    setup.ready ? 'Set up' : `Still to set up: ${stillToDo(batch)}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the batch's details"
      onPress={onPress}
      style={({ pressed }) => [styles.batchCard, { backgroundColor: palette.card, borderColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={[styles.batchName, { color: palette.foreground }]} numberOfLines={1}>
            {batch.name}
          </Text>
          <View style={styles.badges}>
            <Badge label={PROGRAM_LABELS[batch.program]} tone={programTone(batch.program)} />
            <Badge label={classLabel(batch)} />
            {year ? <Badge label={year} /> : null}
            {setup.ready ? <Badge label="Ready" tone="success" /> : null}
          </View>
        </View>
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
      </View>

      <View style={styles.metaRow}>
        <Meta icon={{ ios: 'person.3', android: 'groups' }} text={plural(batch.studentCount, 'student')} />
        <Meta
          icon={{ ios: 'person.crop.rectangle', android: 'co_present' }}
          text={`${assigned}/${batch.subjects.length} teachers`}
          warn={missing.length > 0}
        />
        <Meta icon={{ ios: 'clock', android: 'schedule' }} text={batch.classes.classes ? `${formatMinutes(batch.classes.weeklyMinutes)} a week` : 'No timetable'} />
      </View>

      {batch.classes.classes ? <DayStrip days={batch.classes.days} classes={batch.classes.classes} /> : null}

      {!setup.ready ? (
        <View style={[styles.setupRow, { backgroundColor: missing.length ? palette.warningSoft : palette.secondary }]}>
          <Icon
            name={missing.length ? { ios: 'exclamationmark.triangle', android: 'warning' } : { ios: 'checklist', android: 'checklist' }}
            color={missing.length ? palette.warningInk : palette.mutedForeground}
            size={14}
          />
          <Text style={[styles.setupText, { color: missing.length ? palette.warningInk : palette.mutedForeground }]} numberOfLines={2}>
            Setup {setup.done}/{setup.total} · {stillToDo(batch)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Meta({ icon, text, warn = false }: { icon: IconName; text: string; warn?: boolean }) {
  const palette = usePalette();
  const color = warn ? palette.warningInk : palette.mutedForeground;
  return (
    <View style={styles.meta}>
      <Icon name={icon} color={color} size={14} />
      <Text style={[styles.metaText, { color, fontWeight: warn ? '700' : '500' }]}>{text}</Text>
    </View>
  );
}

/** Mon–Sun with the days that have a class lit, and how many classes a week. */
function DayStrip({ days, classes }: { days: number[]; classes: number }) {
  const palette = usePalette();
  const week = [1, 2, 3, 4, 5, 6, 0];
  return (
    <View style={styles.dayStrip} accessible accessibilityLabel={`${plural(classes, 'class', 'classes')} a week, on ${days.map((d) => WEEKDAY_NAMES[d]).join(', ')}`}>
      <View style={styles.days}>
        {week.map((day) => {
          const on = days.includes(day);
          return (
            <View
              key={day}
              style={[styles.dayDot, { backgroundColor: on ? palette.primarySoft : palette.secondary, borderColor: on ? palette.primaryBorder : 'transparent' }]}
            >
              <Text style={[styles.dayDotText, { color: on ? palette.primaryInk : palette.mutedForeground }]}>{WEEKDAY_SHORT[day].slice(0, 2)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.dayTime, { color: palette.mutedForeground }]} numberOfLines={1}>
        {plural(classes, 'class', 'classes')} a week
      </Text>
    </View>
  );
}

const SETUP_ACTIONS: Record<SetupStep, { icon: IconName; title: string }> = {
  teachers: { icon: { ios: 'person.crop.rectangle', android: 'co_present' }, title: 'Assign teachers' },
  students: { icon: { ios: 'person.3', android: 'groups' }, title: 'Manage students' },
  timings: { icon: { ios: 'clock', android: 'schedule' }, title: 'Set the timetable' },
};

/** The next steps for a batch: teachers, students and timings, each optional. */
function SetupActions({ batch, steps, onTeachers, onStudents, onTimings }: { batch: Batch; steps: SetupStep[]; onTeachers: () => void; onStudents: () => void; onTimings: () => void }) {
  const missing = missingTeachers(batch);
  const subtitle: Record<SetupStep, string> = {
    teachers: missing.length ? `No teacher yet for ${missing.join(', ')}` : `One for each of ${batch.subjects.join(', ')}`,
    students: batch.studentCount ? plural(batch.studentCount, 'student') : 'Add students or move them in, in People',
    timings: batch.classes.classes
      ? `${plural(batch.classes.classes, 'class', 'classes')} · ${formatMinutes(batch.classes.weeklyMinutes)} a week`
      : 'Each subject’s days and times',
  };
  const press: Record<SetupStep, () => void> = { teachers: onTeachers, students: onStudents, timings: onTimings };
  return (
    <Card style={styles.listCard}>
      {steps.map((step, i) => (
        <ActionRow key={step} icon={SETUP_ACTIONS[step].icon} title={SETUP_ACTIONS[step].title} subtitle={subtitle[step]} onPress={press[step]} last={i === steps.length - 1} />
      ))}
    </Card>
  );
}

type FormSection = 'teachers';

function BatchDetail({ id, notice, onClose, onDeleted }: { id: string; notice?: string; onClose: () => void; onDeleted: (name: string) => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { goToTab } = useTabNavigation();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.batch(id), [id, version]);
  const timetable = useLoad(() => schoolApi.timetable(id), [id, version]);
  /** null: closed; 'basics': the whole form; or opened at its teachers. */
  const [editing, setEditing] = useState<FormSection | 'basics' | null>(null);
  const [timings, setTimings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allStudents, setAllStudents] = useState(false);
  const { flash, show, clear } = useFlash(notice);

  const batch = data?.batch;
  const remove = () => {
    if (!batch) return;
    confirmAction(
      `Delete ${batch.name}?`,
      'Its students stay enrolled without a batch. Its tests, results and syllabus progress are removed. This cannot be undone.',
      'Delete',
      async () => {
        setDeleting(true);
        clear();
        try {
          await tuitionApi.deleteBatch(id);
          bumpDataVersion();
          onDeleted(batch.name);
          onClose();
        } catch (e) {
          show(e instanceof Error ? e.message : "Couldn't delete the batch.", 'danger');
          setDeleting(false);
        }
      }
    );
  };
  const manageStudents = () => {
    showStudents(id);
    onClose();
    goToTab('people');
  };

  const students = data?.students ?? [];
  const missing = batch ? missingTeachers(batch) : [];
  const setup = batch ? setupOf(batch) : null;

  return (
    <DetailSheet
      visible
      title={batch?.name ?? 'Batch'}
      onClose={onClose}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        batch ? (
          <View style={styles.footerRow}>
            <Button label="Delete" variant="danger" icon={{ ios: 'trash', android: 'delete' }} onPress={remove} loading={deleting} style={styles.flex} accessibilityLabel={`Delete ${batch.name}`} />
            <Button label="Edit batch" icon={{ ios: 'pencil', android: 'edit' }} onPress={() => setEditing('basics')} disabled={deleting} style={styles.flex2} />
          </View>
        ) : undefined
      }
    >
      <FlashNotice flash={flash} onDismiss={clear} />
      {loading ? (
        <LoadingView label="Loading the batch…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the batch. ${error}`} onRetry={reload} />
      ) : batch && data && setup ? (
        <>
          {error ? <Notice tone="danger" text={`Couldn't refresh: ${error}`} /> : null}
          <Card style={styles.listCard}>
            <View style={[styles.detailBadges, { borderBottomColor: palette.border }]}>
              <Badge label={PROGRAM_LABELS[batch.program]} tone={programTone(batch.program)} />
              <Badge label={classLabel(batch)} />
              {yearLabel(batch) ? <Badge label={yearLabel(batch)!} /> : null}
              <Badge label={setup.ready ? 'Ready' : `Setup ${setup.done}/${setup.total}`} tone={setup.ready ? 'success' : missing.length ? 'warning' : 'neutral'} />
            </View>
            <InfoRow icon={{ ios: 'graduationcap', android: 'school' }} label="Program" value={PROGRAM_INFO[batch.program].label} />
            <InfoRow icon={{ ios: 'calendar', android: 'event' }} label="Academic year" value={yearLabel(batch) ?? ''} />
            <InfoRow icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }} label="Classroom" value={batch.venue} />
            <InfoRow icon={{ ios: 'person.3', android: 'groups' }} label="Students" value={plural(batch.studentCount, 'student')} />
            <InfoRow
              icon={{ ios: 'clock', android: 'schedule' }}
              label="Class time a week"
              value={batch.classes.weeklyMinutes ? formatMinutes(batch.classes.weeklyMinutes) : ''}
              last
            />
          </Card>
          <Muted>{bankNote(batch.program)}</Muted>

          {!setup.ready ? (
            <>
              <SectionTitle title="Finish setting up" />
              <SetupActions batch={batch} steps={setup.missing} onTeachers={() => setEditing('teachers')} onStudents={manageStudents} onTimings={() => setTimings(true)} />
            </>
          ) : null}

          <SectionTitle
            title="Subjects and teachers"
            action={<TextLink label={missing.length ? 'Assign' : 'Change'} onPress={() => setEditing('teachers')} />}
          />
          <Card style={styles.listCard}>
            {batch.subjects.map((subject, i) => {
              const teacher = batch.teachers.find((t) => t.subject === subject);
              return (
                <View
                  key={subject}
                  accessible
                  accessibilityLabel={`${subject}: ${teacher ? teacher.name : 'no teacher assigned'}`}
                  style={[styles.teacherRow, i < batch.subjects.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
                >
                  {teacher ? (
                    <Avatar name={teacher.name} size={34} />
                  ) : (
                    <View style={[styles.emptyAvatar, { backgroundColor: palette.warningSoft }]}>
                      <Icon name={{ ios: 'person.fill.questionmark', android: 'person_off' }} color={palette.warning} size={16} />
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Text style={[styles.subjectLabel, { color: palette.mutedForeground }]}>{subject}</Text>
                    <Text style={[styles.teacherName, { color: teacher ? palette.foreground : palette.warningInk }]} numberOfLines={1}>
                      {teacher ? teacher.name : 'No teacher assigned'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>

          <SectionTitle title="Weekly timetable" action={<TextLink label={batch.classes.classes ? 'Change' : 'Add'} onPress={() => setTimings(true)} />} />
          {timetable.data ? (
            <WeekTimetable
              entries={timetable.data.filter((e) => e.batch.id === batch.id)}
              emptyText="No classes yet. Tap Add to put each subject on its days and times."
            />
          ) : timetable.error ? (
            <Muted>Couldn&apos;t load the timetable. {timetable.error}</Muted>
          ) : (
            <Muted>Loading the timetable…</Muted>
          )}
          {batch.schedule.length ? (
            <Muted>
              {plural(batch.schedule.length, 'older class time', 'older class times')} without a subject {batch.schedule.length === 1 ? 'is' : 'are'} kept from before. Open the
              timetable to see {batch.schedule.length === 1 ? 'it' : 'them'}.
            </Muted>
          ) : null}

          <SectionTitle title={`Students (${students.length})`} action={<TextLink label="Manage" onPress={manageStudents} />} />
          {students.length ? (
            <Card style={styles.listCard}>
              {(allStudents ? students : students.slice(0, STUDENTS_SHOWN)).map((s, i, shown) => (
                <View
                  key={s.id}
                  style={[styles.studentRow, (i < shown.length - 1 || students.length > STUDENTS_SHOWN) && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
                >
                  <Avatar name={s.name} size={32} muted={!s.active} />
                  <View style={styles.flex}>
                    <Text style={[styles.teacherName, { color: palette.foreground }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[styles.small, { color: palette.mutedForeground }]} numberOfLines={1}>
                      {[s.standard, s.program && s.program !== batch.program ? `${PROGRAM_LABELS[s.program]} student` : null, !s.active ? 'Login off' : null, s.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
              {students.length > STUDENTS_SHOWN ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAllStudents((v) => !v)}
                  style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
                >
                  <Text style={[styles.showAllText, { color: palette.primary }]}>{allStudents ? 'Show fewer' : `Show all ${students.length} students`}</Text>
                </Pressable>
              ) : null}
            </Card>
          ) : (
            <Card>
              <Muted>No students in this batch yet. Tap Manage to add them or move them in from People.</Muted>
            </Card>
          )}

          <SectionTitle title="Syllabus covered" />
          <Card>
            {batch.subjects.map((subject) => {
              const c = batch.coverage?.[subject];
              return (
                <View key={subject} style={styles.coverage}>
                  <View style={styles.coverageTop}>
                    <Text style={[styles.subject, { color: palette.foreground }]}>{subject}</Text>
                    <Text style={[styles.small, { color: palette.mutedForeground }]}>{c?.total ? `${c.percent}% · ${c.covered}/${c.total} topics` : 'No syllabus found'}</Text>
                  </View>
                  <ProgressBar value={c?.percent ?? 0} />
                </View>
              );
            })}
            <Muted>Teachers mark topics as they cover them.</Muted>
          </Card>

          <BatchAnalysisSection batchId={batch.id} />

          <BatchForm
            visible={editing !== null}
            onClose={() => setEditing(null)}
            batch={batch}
            first={editing === 'basics' ? undefined : editing ?? undefined}
            onSaved={() => show('Batch saved.')}
          />
          <TimetableSheet visible={timings} batch={batch} onClose={() => setTimings(false)} />
        </>
      ) : null}
    </DetailSheet>
  );
}

/** A small text button beside a section title, e.g. "Assign". */
function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.link, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

// ─── New batch ─────────────────────────────────────────────────────────────

/**
 * Making a batch in one short form: program, class, academic year, a
 * suggested name and the program's subjects. Teachers, the classroom and
 * timings come after, from the next steps it shows. "Create another batch"
 * keeps the program, class and year and suggests the next name.
 */
function NewBatchSheet({ visible, batches, onClose, onCreated, onOpen }: {
  visible: boolean;
  batches: Batch[];
  onClose: () => void;
  onCreated: (b: Batch) => void;
  onOpen: (id: string) => void;
}) {
  const { goToTab } = useTabNavigation();
  const currentYear = academicYearOf();
  const years = academicYearChoices(currentYear);
  const [program, setProgram] = useState<Program | null>(null);
  const [standard, setStandard] = useState<SchoolStandard | null>(null);
  const [academicYear, setAcademicYear] = useState(currentYear);
  /** The name typed; null while the suggestion is used. */
  const [typedName, setTypedName] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The batches made since the sheet opened; the last one shows after creating it. */
  const [made, setMade] = useState<Batch[]>([]);
  const [showingMade, setShowingMade] = useState(false);
  const [editing, setEditing] = useState<FormSection | null>(null);
  const [timings, setTimings] = useState(false);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setTimings(false);
      setProgram(null);
      setStandard(null);
      setAcademicYear(currentYear);
      setTypedName(null);
      setSubjects([]);
      setError(null);
      setMade([]);
      setShowingMade(false);
      setEditing(null);
    }
  }

  const taken = [...batches, ...made].map((b) => b.name);
  const suggestion = program && standard ? suggestBatchName(`${PROGRAM_INFO[program].label} ${standard}`, taken) : '';
  const name = typedName ?? suggestion;
  const problem = program ? subjectProblem(program, subjects) : null;
  const last = made[made.length - 1];

  const pickProgram = (next: Program) => {
    setProgram(next);
    setSubjects([...PROGRAM_INFO[next].subjects]);
    setError(null);
  };

  const create = async () => {
    if (!program) return setError('Choose the program.');
    if (!standard) return setError('Choose the class: 11th or 12th.');
    if (!name.trim()) return setError('Enter a batch name.');
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const batch = await tuitionApi.createBatch({ program, standard, academicYear, name: name.trim(), subjects });
      bumpDataVersion();
      setMade((m) => [...m, batch]);
      setShowingMade(true);
      onCreated(batch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the batch.");
    } finally {
      setSaving(false);
    }
  };

  // Same program, class and year; the next free name; the program's subjects again.
  const another = () => {
    setShowingMade(false);
    setTypedName(null);
    if (program) setSubjects([...PROGRAM_INFO[program].subjects]);
    setError(null);
  };

  return (
    <FormSheet
      visible={visible}
      title={showingMade ? 'Batch created' : 'New batch'}
      onClose={onClose}
      submitLabel={showingMade ? 'Create another batch' : 'Create Batch'}
      onSubmit={showingMade ? another : () => void create()}
      submitting={saving}
      error={showingMade ? null : error}
      extraAction={showingMade ? <Button label="Done" variant="secondary" onPress={onClose} /> : undefined}
    >
      {showingMade && last ? (
        <>
          <Notice
            tone="success"
            title={`${last.name} created`}
            text={made.length > 1 ? `${made.length} batches created: ${made.map((b) => b.name).join(', ')}.` : "It's on your Batches list now."}
            live
          />
          <Card style={styles.listCard}>
            <View style={[styles.detailBadges, { borderBottomColor: 'transparent' }]}>
              <Badge label={PROGRAM_LABELS[last.program]} tone={programTone(last.program)} />
              <Badge label={classLabel(last)} />
              {yearLabel(last) ? <Badge label={yearLabel(last)!} /> : null}
            </View>
            <InfoRow icon={{ ios: 'book', android: 'menu_book' }} label="Subjects" value={last.subjects.join(', ')} last />
          </Card>
          <SectionTitle title="Next steps, when you're ready" />
          <SetupActions
            batch={last}
            steps={['teachers', 'students', 'timings']}
            onTeachers={() => setEditing('teachers')}
            onStudents={() => {
              showStudents(last.id);
              onClose();
              goToTab('people');
            }}
            onTimings={() => setTimings(true)}
          />
          <Button label="Open the batch" variant="tonal" icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} onPress={() => onOpen(last.id)} />
          <BatchForm
            visible={editing !== null}
            onClose={() => setEditing(null)}
            batch={last}
            first={editing ?? undefined}
            onSaved={(saved) => setMade((m) => m.map((b) => (b.id === saved.id ? saved : b)))}
          />
          <TimetableSheet visible={timings} batch={last} onClose={() => setTimings(false)} />
        </>
      ) : (
        <View style={styles.group}>
          <Chips label="Program" choices={OFFERED_PROGRAMS} selected={program} onChange={pickProgram} labels={PROGRAM_LABELS} />
          {program ? <Muted>{bankNote(program)}</Muted> : null}
          <Chips label="Class" choices={SCHOOL_STANDARDS} selected={standard} onChange={setStandard} />
          <Chips label="Academic year" choices={years} selected={academicYear} onChange={setAcademicYear} labels={yearLabels(years)} />
          <Field
            label="Batch name"
            value={name}
            onChangeText={setTypedName}
            placeholder={program && standard ? suggestion : 'e.g. NEET 11th A'}
            hint={typedName === null ? (suggestion ? 'Suggested from the program and class. You can change it.' : 'Pick the program and class for a suggested name.') : undefined}
            maxLength={80}
          />
          {typedName !== null && suggestion && typedName !== suggestion ? <TextLink label={`Use “${suggestion}”`} onPress={() => setTypedName(null)} /> : null}
          {program ? (
            <>
              <MultiChips label="Subjects" choices={PROGRAM_INFO[program].allowed} selected={subjects} onChange={setSubjects} />
              <SubjectHint program={program} problem={problem} />
            </>
          ) : (
            <Muted>Pick a program to see its subjects.</Muted>
          )}
          <Muted>Teachers, the classroom and class timings are optional. You can add them right after creating the batch.</Muted>
        </View>
      )}
    </FormSheet>
  );
}

/** What the subjects must be for the program, or what's wrong with the choice. */
function SubjectHint({ program, problem }: { program: Program; problem: string | null }) {
  const palette = usePalette();
  if (problem) return <Text style={[styles.small, { color: palette.dangerInk }]}>{problem}</Text>;
  const info = PROGRAM_INFO[program];
  return (
    <Muted>
      {info.required.length
        ? `${info.label}: ${info.required.join(' and ')}, with ${info.oneOf.join(', ')} or both.`
        : info.allowed.length === 4
          ? 'Pick the subjects this batch takes.'
          : `The ${info.label} subjects. Untick any this batch doesn't take.`}
    </Muted>
  );
}

// ─── Editing ───────────────────────────────────────────────────────────────

const NO_TEACHER = 'none';

/**
 * Everything about a batch but its timings: program, class, year, name and
 * subjects, teachers and the classroom. `first` puts teachers at the top when
 * opened for them. The timetable has its own sheet (TimetableSheet) and is left
 * as they are here.
 */
function BatchForm({ visible, onClose, batch, first, onSaved }: { visible: boolean; onClose: () => void; batch: Batch; first?: FormSection; onSaved?: (b: Batch) => void }) {
  const palette = usePalette();
  const { data: teachers, error: teachersError, reload: reloadTeachers } = useLoad(() => tuitionApi.teachers(), [visible], { enabled: visible });
  const [name, setName] = useState('');
  const [program, setProgram] = useState<Program>(batch.program);
  const [standard, setStandard] = useState<SchoolStandard | null>(null);
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [venue, setVenue] = useState('');
  const [assigned, setAssigned] = useState<Partial<Record<SchoolSubject, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setName(batch.name);
      setProgram(batch.program);
      setStandard(batch.standard);
      setAcademicYear(batch.academicYear);
      setSubjects(batch.subjects);
      setVenue(batch.venue);
      setAssigned(Object.fromEntries(batch.teachers.map((t) => [t.subject, t.teacherId])));
      setError(null);
    }
  }

  const years = academicYearChoices(academicYearOf(), batch.academicYear);
  const problem = subjectProblem(program, subjects);

  const changeProgram = (next: Program) => {
    setProgram(next);
    setSubjects([...PROGRAM_INFO[next].subjects]);
  };

  const save = async () => {
    if (!name.trim()) return setError('Enter a batch name.');
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    const input: BatchInput = {
      name: name.trim(),
      program,
      // Older batches for both classes keep that until a class is picked.
      ...(standard ? { standard } : {}),
      ...(academicYear ? { academicYear } : {}),
      subjects,
      venue: venue.trim(),
      teachers: subjects.flatMap((subject) => (assigned[subject] ? [{ subject, teacherId: assigned[subject]! }] : [])),
    };
    try {
      const saved = await tuitionApi.updateBatch(batch.id, input);
      bumpDataVersion();
      onClose();
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the batch.");
    } finally {
      setSaving(false);
    }
  };

  const unassigned = subjects.filter((s) => !assigned[s]);

  const groups = {
    basics: (
      <FormGroup key="basics" title="Program and class">
        <Chips label="Program" choices={programChoices(batch.program)} selected={program} onChange={changeProgram} labels={PROGRAM_LABELS} />
        {!OFFERED_PROGRAMS.includes(batch.program) ? (
          <Muted>{PROGRAM_LABELS[batch.program]} isn&apos;t offered for new batches, but this batch keeps it unless you change it.</Muted>
        ) : null}
        <Chips label="Class" choices={SCHOOL_STANDARDS} selected={standard} onChange={setStandard} />
        {!standard ? <Muted>This older batch is for both 11th and 12th. Pick one, or leave it as it is.</Muted> : null}
        <Chips label="Academic year" choices={years} selected={academicYear} onChange={setAcademicYear} labels={yearLabels(years)} />
        <Field label="Batch name" value={name} onChangeText={setName} placeholder="e.g. NEET 11th A" maxLength={80} />
        {batch.studentCount ? (
          <Muted>
            {plural(batch.studentCount, 'student')} in this batch. Its program and class can change only while every student in it matches them.
          </Muted>
        ) : null}
      </FormGroup>
    ),
    subjects: (
      <FormGroup key="subjects" title="Subjects">
        <MultiChips choices={PROGRAM_INFO[program].allowed} selected={subjects} onChange={setSubjects} />
        <SubjectHint program={program} problem={problem} />
      </FormGroup>
    ),
    timings: (
      <FormGroup key="timings" title="Classroom (optional)">
        <Field label="Classroom" value={venue} onChangeText={setVenue} placeholder="e.g. Room 2, Main branch" maxLength={200} />
        <Muted>The timetable has its own page: on the batch, tap Weekly timetable › {batch.classes.classes ? 'Change' : 'Add'}.</Muted>
      </FormGroup>
    ),
    teachers: (
      <FormGroup key="teachers" title="Teachers (optional)">
        {teachersError && !teachers ? (
          <View style={styles.teacherError}>
            <Text style={[styles.small, { color: palette.dangerInk }]}>Couldn&apos;t load the teachers. {teachersError}</Text>
            <Button label="Try again" variant="secondary" onPress={reloadTeachers} />
          </View>
        ) : !teachers ? (
          <Muted>Loading teachers…</Muted>
        ) : (
          subjects.map((subject) => {
            const able = teachers.filter((t) => t.subjects.includes(subject)).sort((a, b) => a.name.localeCompare(b.name));
            const options: PickerOption[] = [
              { value: NO_TEACHER, label: 'No teacher', pinned: true },
              ...able.map((t) => ({ value: t.id, label: t.name, hint: t.active ? t.email : `${t.email} · login off` })),
            ];
            return (
              <View key={subject} style={styles.teacherPick}>
                <OptionPicker
                  label={subject}
                  options={options}
                  selected={assigned[subject] ?? NO_TEACHER}
                  onChange={(teacherId) => setAssigned((prev) => ({ ...prev, [subject]: teacherId === NO_TEACHER ? undefined : teacherId }))}
                  searchPlaceholder={`Search ${subject} teachers`}
                />
                {able.length === 0 ? <Muted>No teacher teaches {subject} yet. Add one in People › Teachers.</Muted> : null}
              </View>
            );
          })
        )}
        {teachers && unassigned.length ? <Muted>You can save without a teacher for {unassigned.join(', ')} and assign one later.</Muted> : null}
      </FormGroup>
    ),
  };
  const order: (keyof typeof groups)[] = first === 'teachers' ? ['teachers', 'basics', 'subjects', 'timings'] : ['basics', 'subjects', 'teachers', 'timings'];

  return (
    <FormSheet visible={visible} title={`Edit ${batch.name}`} onClose={onClose} submitLabel="Save changes" onSubmit={() => void save()} submitting={saving} error={error}>
      {order.map((key) => groups[key])}
    </FormSheet>
  );
}

/** A titled group of fields inside a form. */
function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionTitle title={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2 },
  pressed: { opacity: 0.75 },
  listCard: { paddingVertical: 0 },
  footerRow: { flexDirection: 'row', gap: 10 },
  filters: { gap: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { fontSize: 14, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  batchCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  batchName: { fontSize: 17, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontVariant: ['tabular-nums'] },
  dayStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  days: { flexDirection: 'row', gap: 4 },
  dayDot: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayDotText: { fontSize: 11, fontWeight: '700' },
  dayTime: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
  setupRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  setupText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  detailBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 56 },
  emptyAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  subjectLabel: { fontSize: 12, fontWeight: '600' },
  teacherName: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  weekEmpty: { paddingVertical: 14 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, minHeight: 44 },
  weekDay: { width: 40, fontSize: 14, fontWeight: '700' },
  weekSlots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  slotText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  noClass: { fontSize: 13 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  showAll: { paddingVertical: 12, alignItems: 'center' },
  showAllText: { fontSize: 14, fontWeight: '700' },
  coverage: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  subject: { fontSize: 14, fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17 },
  group: { gap: 12 },
  teacherPick: { gap: 6 },
  teacherError: { gap: 8 },
});
