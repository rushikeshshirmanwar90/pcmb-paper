import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyView,
  ErrorView,
  Field,
  Icon,
  LoadingView,
  Muted,
  MultiChips,
  Notice,
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
import {
  ALL,
  countBy,
  EMPTY_BATCH_FILTER,
  filterBatches,
  missingTeachers,
  NO_CLASS,
  plural,
  setupOf,
  type BatchFilter,
  type SetupStep,
} from '@/screens/tuition/admin-filters';
import { ActionRow, ClearFilters, FilterRow, programTone, type FilterOption } from '@/screens/tuition/admin-ui';
import { batchHref } from '@/screens/tuition/batch-nav';
import { FormPage, useDiscardGuard, useGoBack } from '@/components/stack-screen';
import { formatMinutes, tuitionApi, type Batch, type BatchInput } from '@/services/tuition-api';

/** Older batches may be for both classes. */
export const classLabel = (b: Pick<Batch, 'standard'>) => b.standard ?? '11th & 12th';
export const yearLabel = (b: Pick<Batch, 'academicYear'>) => (b.academicYear ? formatAcademicYear(b.academicYear) : null);
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
export function bankNote(program: Program) {
  const bank = PROGRAM_INFO[program].questionBank;
  return bank
    ? `Students practise ${bank} past-year questions.`
    : `There's no ${PROGRAM_INFO[program].label} question bank yet, so students won't get practice questions. Tests, timings and announcements work as usual.`;
}

/** The tuition's batches: filter by program and class, create, open, edit and delete. */
export function TuitionBatchesScreen() {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.batches(), [version]);
  const router = useRouter();
  const openBatch = (batchId: string) => router.push(batchHref(batchId));
  const [filter, setFilter] = useState<BatchFilter>(EMPTY_BATCH_FILTER);
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
      <Button label="Create Batch" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/batch/new')} />
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
            shown.map((batch) => <BatchCard key={batch.id} batch={batch} onPress={() => openBatch(batch.id)} />)
          ) : (
            <Card>
              <EmptyView icon={{ ios: 'line.3.horizontal.decrease.circle', android: 'filter_list' }} title="No batches match" text="Try another program or class." />
            </Card>
          )}
        </>
      )}
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
            {setup.missing.length} setup steps remaining
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
export function SetupActions({ batch, steps, onTeachers, onStudents, onTimings }: { batch: Batch; steps: SetupStep[]; onTeachers: () => void; onStudents: () => void; onTimings: () => void }) {
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

/** A small text button beside a section title, e.g. "Assign". */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.link, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

/** What the subjects must be for the program, or what's wrong with the choice. */
export function SubjectHint({ program, problem }: { program: Program; problem: string | null }) {
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

/**
 * Edits a batch's details: program, class, year, name, subjects and the
 * classroom. Teachers have their own screens (assigned per batch), and the
 * timetable has its own too, so neither is touched here.
 */
export function BatchForm({ batch, onSaved, dangerZone }: { batch: Batch; onSaved?: (b: Batch) => void; /** Destructive actions, in their own section at the end of the form rather than beside Save. Gets the function that switches off the unsaved-changes question, for leaving on purpose. */ dangerZone?: (allowLeave: () => void) => React.ReactNode }) {
  const goBack = useGoBack();
  const [name, setName] = useState(batch.name);
  const [program, setProgram] = useState<Program>(batch.program);
  const [standard, setStandard] = useState<SchoolStandard | null>(batch.standard);
  const [academicYear, setAcademicYear] = useState<string | null>(batch.academicYear);
  const [subjects, setSubjects] = useState<SchoolSubject[]>(batch.subjects);
  const [venue, setVenue] = useState(batch.venue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = academicYearChoices(academicYearOf(), batch.academicYear);
  const problem = subjectProblem(program, subjects);
  const changed = name !== batch.name || program !== batch.program || standard !== batch.standard || academicYear !== batch.academicYear || venue !== batch.venue || subjects.join() !== batch.subjects.join();
  const allowLeave = useDiscardGuard(changed && !saving, 'Discard batch changes?');

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
    };
    try {
      const saved = await tuitionApi.updateBatch(batch.id, input);
      bumpDataVersion();
      onSaved?.(saved);
      allowLeave();
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the batch.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <FormPage title={`Edit ${batch.name}`} onBack={goBack} submitLabel="Save Changes" onSubmit={() => void save()} submitting={saving} error={error}>
      <FormGroup title="Program and class">
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
      <FormGroup title="Subjects">
        <MultiChips choices={PROGRAM_INFO[program].allowed} selected={subjects} onChange={setSubjects} />
        <SubjectHint program={program} problem={problem} />
      </FormGroup>
      <FormGroup title="Classroom (optional)">
        <Field label="Classroom" value={venue} onChangeText={setVenue} placeholder="e.g. Room 2, Main branch" maxLength={200} />
        <Muted>Teachers and session times are managed from the batch&apos;s Teachers and Schedule screens.</Muted>
      </FormGroup>
      {dangerZone ? <FormGroup title="Danger zone">{dangerZone(allowLeave)}</FormGroup> : null}
    </FormPage>
  );
}

/** A titled group of fields inside a form. */
export function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
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
