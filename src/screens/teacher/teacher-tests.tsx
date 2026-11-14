import { useRouter, type Href } from 'expo-router';
import { DropdownSelect } from '@/components/dropdown-select';
import { BatchMultiSelect } from '@/screens/teacher/batch-multi-select';
import { AudiencePicker } from '@/screens/teacher/test-access';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { QuestionSetFlow, type QuestionFlowControl } from '@/components/create-exam-modal';
import { Diagrams } from '@/components/diagrams';
import { KeyboardAwareScrollView, KeyboardSafeView } from '@/components/keyboard-safe-view';
import { MathText } from '@/components/math-text';
import {
  Badge,
  Button,
  Card,
  Chips,
  DetailRow,
  EmptyView,
  ErrorText,
  ErrorView,
  Field,
  Icon,
  ListRow,
  LoadingView,
  Muted,
  Notice,
  Screen,
  SectionTitle,
  Segmented,
  useLoad,
  usePalette,
} from '@/components/kit';
import { SpringPressable } from '@/components/spring-pressable';
import { SubjectChips } from '@/components/subject-chips';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { PROGRAM_LABELS, SCHOOL_STANDARDS, programOf, questionBankOf, type SchoolStandard, type SchoolSubject } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { useCacheKeys } from '@/hooks/use-cache-keys';
import { DateField } from '@/screens/teacher/date-field';
import { pickerQuestions, stepBack } from '@/screens/teacher/test-questions';
import { TestEditSelection } from '@/screens/teacher/question-selection/test-edit-selection';
import {
  FILTER_LABELS,
  STATUS_WORDS,
  TEST_FILTERS,
  durationProblem,
  filterTests,
  lastStartOf,
  marksProblem,
  maxMarks,
  scheduleProblem,
  sortTests,
  suggestClosing,
  timeOf,
  withDay,
  withTime,
  type StartMode,
  type TestFilter,
} from '@/screens/teacher/test-schedule';
import { TimeField } from '@/screens/tuition/time-field';
import { dateTimeLabel, schoolApi, type TeacherOverview, type TestQuestionCopy, type TestSummary } from '@/services/school-api';
import type { Question, Standard, Subject } from '@/types/pcmb';

export const STATUS_BADGE = STATUS_WORDS;

const ALL = 'all';

/** The teacher's Test Room: set tests for batches, and manage upcoming, live and completed ones. */
export function TeacherTestsScreen() {
  const palette = usePalette();
  const version = useDataVersion();
  const [batchFilter, setBatchFilter] = useState(ALL);
  const [filter, setFilter] = useState<TestFilter>('all');
  const keys = useCacheKeys();
  // Shared with Home, Batches and Profile (one request); only the batch filter needs it.
  const overview = useLoad(() => schoolApi.teacherOverview(), [version, keys.teacherOverview], { cacheKey: keys.teacherOverview });
  // Each batch filter's list is kept, so switching back shows it at once while it refreshes.
  // The status filters below only sort what's loaded: switching them sends no request.
  const testsKey = keys.tests(batchFilter === ALL ? undefined : batchFilter);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.tests(batchFilter === ALL ? undefined : batchFilter), [batchFilter, version, testsKey], { cacheKey: testsKey });
  const router = useRouter();
  const openTest = useCallback((id: string) => router.push({ pathname: '/test/[testId]', params: { testId: id } } as Href), [router]);
  const batches = overview.data?.batches ?? [];

  const counts = useMemo(() => (data ? Object.fromEntries(TEST_FILTERS.map((s) => [s, filterTests(data, s).length])) as Record<TestFilter, number> : null), [data]);
  const shown = useMemo(() => (data ? sortTests(filterTests(data, filter)) : []), [data, filter]);

  return (
    <Screen title="Tests" subtitle="Create tests, monitor students and manage access" onRefresh={refresh} refreshing={refreshing}>
      <Button label="Create test" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/create-test' as Href)} />
      {batches.length > 1 ? (
        <DropdownSelect
          label="Filter by batch"
          options={['All batches', ...batches.map(b => b.name)]}
          selected={batches.find(b => b.id === batchFilter)?.name ?? 'All batches'}
          onSelect={name => setBatchFilter(batches.find(b => b.name === name)?.id ?? ALL)}
          required
          searchable
        />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll} contentContainerStyle={styles.statusFilters}>
        <View accessibilityRole="tablist" accessibilityLabel="Filter tests by status" style={styles.statusRow}>
          {TEST_FILTERS.map(value => {
            const selected = value === filter;
            const count = counts ? counts[value] : undefined;
            return (
              <SpringPressable
                key={value}
                pressedScale={0.96}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={count === undefined ? FILTER_LABELS[value] : `${FILTER_LABELS[value]}, ${count}`}
                onPress={() => setFilter(value)}
                style={[
                  styles.statusChip,
                  { backgroundColor: selected ? palette.primarySoft : palette.card, borderColor: selected ? palette.primary : palette.border },
                ]}
              >
                <Text style={[styles.statusLabel, { color: selected ? palette.primaryInk : palette.foreground, fontWeight: selected ? '700' : '500' }]}>
                  {FILTER_LABELS[value]}
                </Text>
                {count !== undefined ? <Text style={[styles.statusCount, { color: selected ? palette.primaryInk : palette.mutedForeground }]}>{count}</Text> : null}
              </SpringPressable>
            );
          })}
        </View>
      </ScrollView>

      {data && error ? <StaleNotice message={error} onRetry={reload} /> : null}
      {loading ? (
        <SkeletonCard rows={4} label="your tests" />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !shown.length ? (
        <Card>
          <EmptyView
            icon={{ ios: 'list.clipboard', android: 'assignment' }}
            title={filter === 'all' ? 'No tests yet' : `No ${FILTER_LABELS[filter].toLowerCase()} tests`}
            text={filter === 'all' ? 'Set a test for a batch; its students take it in the app and you see their results here.' : 'Nothing here right now.'}
          />
        </Card>
      ) : (
        <View style={styles.cards}>
          {shown.map((t) => (
            <TestCard key={t.id} test={t} onOpen={openTest} />
          ))}
        </View>
      )}

    </Screen>
  );
}

// --- The list ---

/** The line of timing that matters for where the test is. */
function scheduleLine(t: TestSummary) {
  if (t.status === 'scheduled') return `Opens ${dateTimeLabel(t.opensAt)} · closes ${dateTimeLabel(t.closesAt)}`;
  if (t.status === 'open') return `Closes ${dateTimeLabel(t.closesAt)} · ${t.submitted}/${t.batchStudents} submitted`;
  return `Closed ${dateTimeLabel(t.closesAt)} · ${t.submitted}/${t.batchStudents} submitted`;
}

// Memoized: a refresh that leaves a test unchanged doesn't redraw its card.
const TestCard = memo(function TestCard({ test: t, onOpen }: { test: TestSummary; onOpen: (id: string) => void }) {
  const palette = usePalette();
  const onPress = () => onOpen(t.id);
  const badge = STATUS_WORDS[t.status];
  return (
    <SpringPressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${badge.label}. ${(t.batches ?? [t.batch]).map(b => b.name).join(', ')}. ${scheduleLine(t)}`}
      onPress={onPress}
      style={[styles.testCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { color: palette.foreground }]} numberOfLines={3}>
          {t.title}
        </Text>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      <Text style={[styles.cardLine, { color: palette.foreground }]} numberOfLines={2}>
        {(t.batches ?? [t.batch]).map(b => b.name).join(', ')}
      </Text>
      <SubjectChips subjects={t.subject} />
      <Text style={[styles.cardLine, styles.cardMeta, { color: palette.mutedForeground }]} numberOfLines={1}>
        {t.questionCount} questions · {t.maxScore} marks · {t.durationMinutes} min
      </Text>
      <Text style={[styles.cardLine, { color: palette.mutedForeground }]} numberOfLines={2}>
        {scheduleLine(t)}
      </Text>
    </SpringPressable>
  );
});

// --- Setting or editing a test: four steps, then a confirmation ---

type Batch = TeacherOverview['batches'][number];
type Step = 1 | 2 | 3 | 4 | 5;
const STEP_NAMES = ['Details', 'Questions', 'Marks and timing', 'Review'];


/** Tomorrow at 10:00, in the phone's time zone. */
function defaultOpening() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function TestWizard({
  edit,
  batches,
  onClose,
  onView,
  onManage,
}: {
  edit: { test: TestSummary; questions: TestQuestionCopy[] } | null;
  batches: Batch[];
  onClose: () => void;
  onView: (id: string) => void;
  onManage: (status: TestSummary['status']) => void;
}) {
  const palette = usePalette();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1: details
  const [title, setTitle] = useState(edit?.test.title ?? '');
  const [batchIds, setBatchIds] = useState<string[]>(edit?.test.batches?.map(b => b.id) ?? [edit?.test.batch.id ?? batches[0]?.id].filter((id): id is string => !!id));
  const batchId = batchIds[0];
  const [audienceMode, setAudienceMode] = useState<'all' | 'selected'>('all');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [audienceReady, setAudienceReady] = useState(false);
  const batch = batches.find((b) => b.id === batchId) ?? null;
  const [subjectPick, setSubjectPick] = useState<string | null>(edit?.test.subject ?? null);
  const subjects = batch?.mySubjects.filter(s => batchIds.every(id => batches.find(b => b.id === id)?.mySubjects.includes(s))) ?? [];
  const subject = subjectPick && subjects.includes(subjectPick as SchoolSubject) ? subjectPick : subjects.length === 1 ? subjects[0] : null;
  const [standardPick, setStandardPick] = useState<SchoolStandard | null>((edit?.test.standard as SchoolStandard) || null);
  const standard = batch?.standard ?? standardPick;
  const bank = batch ? questionBankOf(programOf(batch)) : null;
  const editSubjects = edit?.test.subject.split(',').map(s => s.trim()) ?? [];
  const combinedEdit = !!edit && editSubjects.length > 1;
  const { testBatches: testBatchesKey } = useCacheKeys();
  const editBatches = useLoad(() => schoolApi.testBatches(), [testBatchesKey], { enabled: combinedEdit, cacheKey: testBatchesKey });
  const editBank = editBatches.data?.find(b => b.id === edit?.test.batch.id)?.questionBank;

  // Step 2: questions
  // An edited test's questions start picked, matched to the bank by their source id.
  const [questions, setQuestions] = useState<Question[]>(() => (edit ? pickerQuestions(edit.questions) : []));
  // Mounted only once the details are right, so nothing is fetched for a batch without a question bank.
  const [pickerOpened, setPickerOpened] = useState(false);
  // The picker's own steps (Change topic) and live picks, for Back and for unsaved changes.
  const flow = useRef<QuestionFlowControl | null>(null);

  // Step 3: marks and timing
  const [correct, setCorrect] = useState(String(edit?.test.marksPerQuestion ?? 4));
  const [wrong, setWrong] = useState(String(edit?.test.negativeMarks ?? 0));
  const [minutes, setMinutes] = useState(String(edit?.test.durationMinutes ?? 60));
  const [mode, setMode] = useState<StartMode>(edit ? 'later' : 'now');
  const [opens, setOpens] = useState<Date>(edit ? new Date(edit.test.opensAt) : defaultOpening());
  // null until the teacher picks a closing time: then it follows the suggestion.
  const [closesPick, setClosesPick] = useState<Date | null>(edit ? new Date(edit.test.closesAt) : null);
  const [anchor, setAnchor] = useState(() => new Date());

  const duration = Number(minutes) || 0;
  const opensAt = mode === 'now' ? anchor : opens;
  const closesAt = closesPick ?? suggestClosing(opensAt, duration || 60);
  const marksPer = Number(correct) || 0;
  const negative = Number(wrong) || 0;
  const total = maxMarks(questions.length, marksPer);

  const timingError = () =>
    marksProblem(correct, wrong) ?? durationProblem(minutes) ?? scheduleProblem({ mode, opensAt: mode === 'later' ? opens : null, closesAt, durationMinutes: duration });

  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState<TestSummary | null>(null);

  const goTo = (next: Step) => {
    setError(null);
    if (next === 3 || next === 4) setAnchor(new Date());
    setStep(next);
  };

  const fromDetails = () => {
    if (!title.trim()) return setError('Give the test a name.');
    if (!edit) {
      if (!batch) return setError('Pick a batch.');
      if (!bank) return setError(`There is no question bank for ${PROGRAM_LABELS[programOf(batch) ?? 'GENERAL']} yet, so a test can't be set for this batch.`);
      if (!subject) return setError('Pick a subject.');
      if (!audienceReady) return setError('Wait for the student list to load.');
      if (audienceMode === 'selected' && !studentIds.length) return setError('Select at least one student.');
      if (batchIds.some(id => !batches.find(b => b.id === id)?.mySubjects.includes(subject as SchoolSubject))) return setError('Choose a subject you teach in every selected batch.');
      if (!standard) return setError('Pick a class.');
    }
    setPickerOpened(true);
    goTo(2);
  };

  const fromTiming = () => {
    const problem = timingError();
    if (problem) return setError(problem);
    goTo(4);
  };

  const publish = async () => {
    // A second tap while the first is still saving must not set the test twice.
    if (inFlight.current) return;
    const problem = timingError();
    if (problem) return setError(problem);
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const timing = {
        durationMinutes: duration,
        marksPerQuestion: marksPer,
        negativeMarks: negative,
        startNow: mode === 'now',
        ...(mode === 'later' ? { opensAt: opens.toISOString() } : {}),
        closesAt: (mode === 'now' ? closesPick ?? suggestClosing(new Date(), duration) : closesAt).toISOString(),
      };
      const test = edit
        ? await schoolApi.updateTest(edit.test.id, { title: title.trim(), questions, ...timing })
        : await schoolApi.createTest({ ...timing, batchId: batch!.id, batchIds, audienceMode, ...(audienceMode === 'selected' ? { studentIds } : { excludedStudentIds }), title: title.trim(), subject: subject!, standard: standard!, questions });
      bumpDataVersion();
      setSaved(test);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the test. Try again.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const headerTitle = step === 5 ? 'Done' : edit ? 'Edit test' : 'New test';

  // Whether an edit has anything not yet saved; the picks come from the picker while it holds them.
  const changed = () => {
    if (!edit) return false;
    const t = edit.test;
    const picked = flow.current?.pickedIds() ?? questions.map((q) => q._id);
    const saved = pickerQuestions(edit.questions).map((q) => q._id);
    return (
      title.trim() !== t.title ||
      picked.join('|') !== saved.join('|') ||
      correct !== String(t.marksPerQuestion ?? 4) ||
      wrong !== String(t.negativeMarks ?? 0) ||
      minutes !== String(t.durationMinutes ?? 60) ||
      mode !== 'later' ||
      opens.getTime() !== new Date(t.opensAt).getTime() ||
      (closesPick !== null && closesPick.getTime() !== new Date(t.closesAt).getTime())
    );
  };

  // Closing an edit with unsaved changes asks first; the saved test stays as it was.
  const leave = () => {
    if (step < 5 && changed()) confirmAction('Discard your changes?', 'The test stays as it was last saved.', 'Discard', onClose);
    else onClose();
  };

  // One Back for the arrow, the Back buttons and Android's Back button or gesture:
  // inside the picker it steps back from Change topic to the questions, otherwise one step back.
  const back = () => {
    if (step === 2 && flow.current?.back()) return;
    const to = stepBack(step);
    if (to === 'leave') return leave();
    goTo(to);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={back}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: palette.background }]}>
        <View style={[styles.wizardHeader, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
          {step > 1 && step < 5 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={10} style={styles.headerBtn}>
              <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={18} />
            </Pressable>
          ) : null}
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.wizardTitle, { color: palette.foreground }]} numberOfLines={1}>
              {headerTitle}
            </Text>
            {step < 5 ? (
              <Text style={[styles.cardLine, { color: palette.mutedForeground }]}>
                Step {step} of 4 · {STEP_NAMES[step - 1]}
              </Text>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={leave} hitSlop={10} style={styles.headerBtn}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={18} />
          </Pressable>
        </View>

        {step === 1 ? (
          <WizardPage footer={<Button label="Next: questions" onPress={fromDetails} />} error={error}>
            <Field label="Test name" value={title} onChangeText={setTitle} placeholder="e.g. Kinematics weekly test" maxLength={120} returnKeyType="done" />
            {edit ? (
              <Card>
                <DetailRow label="Batch" value={(edit.test.batches ?? [edit.test.batch]).map(b => b.name).join(', ')} />
                <DetailRow label="Subject" value={edit.test.subject} />
              </Card>
            ) : (
              <>
                <BatchMultiSelect batches={batches} selected={batchIds} onChange={(ids) => { setBatchIds(ids); setSubjectPick(null); setStandardPick(null); setStudentIds([]); setExcludedStudentIds([]); setAudienceReady(false); }} />

                {batch && !bank ? (
                  <Notice tone="warning" title="No question bank yet" text={`There is no question bank for ${PROGRAM_LABELS[programOf(batch) ?? 'GENERAL']} yet, so tests can't be set for this batch.`} />
                ) : null}
                {batch ? <DropdownSelect label="Subject" options={subjects} selected={subject ?? ''} placeholder="Select subject" emptyText="No common authorized subjects" required onSelect={(s) => { setSubjectPick(s); setAudienceReady(false); setStudentIds([]); setExcludedStudentIds([]); }} /> : null}
                {subject ? <AudiencePicker batchIds={batchIds} subject={subject} mode={audienceMode} onMode={setAudienceMode} selected={audienceMode === 'all' ? excludedStudentIds : studentIds} onChange={audienceMode === 'all' ? setExcludedStudentIds : setStudentIds} onReady={setAudienceReady} /> : null}
                {batch && !batch.standard ? <Chips label="Class" choices={SCHOOL_STANDARDS} selected={standardPick} onChange={setStandardPick} /> : null}
              </>
            )}
          </WizardPage>
        ) : null}

        {/* The question picker stays mounted once opened, so going back to it keeps the picks. */}
        {pickerOpened && (edit || (bank && standard && subject)) ? (
          <View style={[styles.flex, step !== 2 && styles.hidden]}>
            {combinedEdit ? (editBank ? <TestEditSelection questions={questions} subjects={editSubjects} exam={editBank}
              standard={edit?.test.standard || '11th'} onChange={setQuestions} onNext={() => goTo(3)} />
              : editBatches.error ? <ErrorView message={editBatches.error} onRetry={editBatches.reload} /> : <LoadingView label="Loading question scope…" />) : <QuestionSetFlow
              key={edit ? edit.test.id : `${batchId}|${subject}|${standard}`}
              purpose="room"
              active={step === 2}
              locked={{
                title: title.trim(),
                standard: (edit ? edit.test.standard || '11th' : standard) as Standard,
                subject: (edit ? edit.test.subject : subject) as Subject,
              }}
              initialQuestions={edit ? questions : undefined}
              onBack={back}
              controlRef={flow}
              onSubmitTest={async ({ questions: picked }) => {
                setQuestions(picked);
                goTo(3);
              }}
            />}
          </View>
        ) : null}

        {step === 3 ? (
          <WizardPage
            error={error}
            footer={
              <View style={styles.row}>
                <Button label="Back" variant="secondary" onPress={back} style={styles.flex} />
                <Button label="Next: review" onPress={fromTiming} style={styles.flex2} />
              </View>
            }
          >
            <SectionTitle title="Marking" />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field label="Right answer (+)" value={correct} onChangeText={(v) => setCorrect(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" maxLength={5} />
              </View>
              <View style={styles.flex}>
                <Field label="Wrong answer (−)" value={wrong} onChangeText={(v) => setWrong(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" maxLength={5} />
              </View>
            </View>
            <Card>
              <DetailRow label="Maximum marks" value={`${questions.length} × ${marksPer} = ${total}`} />
            </Card>

            <SectionTitle title="Time limit" />
            <Field label="Minutes for each student" value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} hint="Starts when a student opens the test." />

            <SectionTitle title="When students can take it" />
            <Segmented
              label="When it opens"
              options={[
                { value: 'now', label: 'Open now' },
                { value: 'later', label: 'Schedule' },
              ]}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setAnchor(new Date());
              }}
            />
            {mode === 'later' ? (
              <View style={styles.row}>
                <DateField label="Opens on" value={opens} minimumDate={new Date()} onChange={(day) => setOpens(withDay(opens, day))} />
                <TimeField label="Opens at" value={timeOf(opens)} onChange={(t) => setOpens(withTime(opens, t))} />
              </View>
            ) : (
              <Muted>It opens the moment you publish it.</Muted>
            )}
            <View style={styles.row}>
              <DateField label="Closes on" value={closesAt} minimumDate={opensAt} onChange={(day) => setClosesPick(withDay(closesAt, day))} />
              <TimeField label="Closes at" value={timeOf(closesAt)} onChange={(t) => setClosesPick(withTime(closesAt, t))} />
            </View>
            {duration ? (
              <Muted>
                {closesPick ? '' : 'Suggested: the time limit plus an hour. '}{!edit || edit.test.accessVersion === 1 ? `Approved students can start until closing. Starting after ${dateTimeLabel(lastStartOf(closesAt, duration).toISOString())} gives reduced time.` : `Students can start until ${dateTimeLabel(lastStartOf(closesAt, duration).toISOString())}.`}
              </Muted>
            ) : null}
          </WizardPage>
        ) : null}

        {step === 4 ? (
          <WizardPage
            error={error}
            footer={
              <View style={styles.row}>
                <Button label="Back" variant="secondary" onPress={back} style={styles.flex} disabled={submitting} />
                <Button
                  label={edit ? 'Save changes' : mode === 'now' ? 'Publish test' : 'Schedule test'}
                  onPress={publish}
                  loading={submitting}
                  style={styles.flex2}
                />
              </View>
            }
          >
            <Card>
              <DetailRow label="Title" value={title.trim()} />
              <DetailRow label="Batch" value={edit ? (edit.test.batches ?? [edit.test.batch]).map(b => b.name).join(', ') : batches.filter(b => batchIds.includes(b.id)).map(b => b.name).join(', ')} />
              <DetailRow label="Subject" value={edit?.test.subject ?? subject ?? ''} />
              {!edit ? <DetailRow label="Access" value={audienceMode === 'all' ? `All students · ${excludedStudentIds.length} restricted` : `${studentIds.length} selected students`} /> : null}
              <DetailRow label="Questions" value={String(questions.length)} />
              <DetailRow label="Marks" value={`${total} (+${marksPer}${negative ? ` / −${negative}` : ''} each)`} />
              <DetailRow label="Time limit" value={`${duration} min`} />
              <DetailRow label="Opens" value={mode === 'now' ? 'Now' : dateTimeLabel(opens.toISOString())} />
              <DetailRow label="Closes" value={dateTimeLabel(closesAt.toISOString())} />
              <DetailRow label="Last start" value={!edit || edit.test.accessVersion === 1 ? dateTimeLabel(closesAt.toISOString()) + ' (reduced time for late starts)' : dateTimeLabel(lastStartOf(closesAt, duration).toISOString())} />
            </Card>
            <SectionTitle title="Questions" />
            <QuestionPreview
              questions={questions}
              onRemove={(i) => {
                // The picker is where picks live: unpick there too, or going back would bring it back.
                flow.current?.deselect(questions[i]._id);
                setQuestions((q) => q.filter((_, at) => at !== i));
              }}
            />
          </WizardPage>
        ) : null}

        {step === 5 && saved ? (
          <WizardPage
            footer={
              <View style={styles.row}>
                <Button label="Back to tests" variant="secondary" onPress={() => onManage(saved.status)} style={styles.flex} />
                <Button label="View test" onPress={() => onView(saved.id)} style={styles.flex} />
              </View>
            }
          >
            <View style={styles.doneHead} accessibilityLiveRegion="polite">
              <View style={[styles.doneIcon, { backgroundColor: palette.successSoft }]}>
                <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.successInk} size={30} />
              </View>
              <Text accessibilityRole="header" style={[styles.doneTitle, { color: palette.foreground }]}>
                {edit ? 'Changes saved' : saved.status === 'scheduled' ? 'Your test is scheduled' : 'Your test is open'}
              </Text>
            </View>
            <Card>
              <DetailRow label="Title" value={saved.title} />
              <DetailRow label="Batch" value={(saved.batches ?? [saved.batch]).map(b => b.name).join(', ')} />
              <DetailRow label="Subject" value={saved.subject} />
              <DetailRow label="Questions" value={String(saved.questionCount)} />
              <DetailRow label="Marks" value={String(saved.maxScore)} />
              <DetailRow label="Duration" value={`${saved.durationMinutes} min`} />
              <DetailRow label="Availability" value={`${saved.status === 'scheduled' ? dateTimeLabel(saved.opensAt) : 'Now'} → ${dateTimeLabel(saved.closesAt)}`} />
            </Card>
          </WizardPage>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

/** A step's scrolling body with its buttons pinned underneath. */
function WizardPage({ children, footer, error }: { children: React.ReactNode; footer: React.ReactNode; error?: string | null }) {
  const palette = usePalette();
  return (
    <KeyboardSafeView>
      <KeyboardAwareScrollView contentContainerStyle={styles.wizardBody} keyboardShouldPersistTaps="handled">
        {children}
      </KeyboardAwareScrollView>
      <View style={[styles.wizardFooter, { borderTopColor: palette.border, backgroundColor: palette.card }]}>
        <ErrorText message={error} />
        {footer}
      </View>
    </KeyboardSafeView>
  );
}

/** The picked questions, numbered, with a way to take one out. The bank's own questions are never changed. */
function QuestionPreview({ questions, onRemove }: { questions: Question[]; onRemove: (index: number) => void }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const shown = open ? questions : questions.slice(0, 3);
  return (
    <Card style={styles.listCard}>
      {shown.map((q, i) => (
        <View key={`${q._id}-${i}`} style={[styles.previewRow, i < shown.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
          <Text style={[styles.previewNo, { color: palette.mutedForeground }]}>{i + 1}</Text>
          <View style={styles.flex}>
            <MathText text={q.questionText} fontSize={14} color={palette.foreground} />
            <Diagrams urls={q.diagramUrls} maxHeight={180} />
            {(['A', 'B', 'C', 'D'] as const).map((key) => {
              const option = q[`option${key}` as const];
              const figures = q.optionDiagramUrls?.[key];
              return option || figures?.length ? (
                <View key={key} style={styles.previewOption}>
                  <Text style={[styles.previewOptionKey, { color: palette.mutedForeground }]}>{key}.</Text>
                  <View style={styles.flex}>
                    {option ? <MathText text={option} fontSize={13} color={palette.foreground} /> : null}
                    <Diagrams urls={figures} maxHeight={120} />
                  </View>
                </View>
              ) : null;
            })}
            <Text style={[styles.cardLine, { color: palette.mutedForeground }]} numberOfLines={1}>
              {[q.chapter, q.topic].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {questions.length > 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${i + 1}`} onPress={() => onRemove(i)} hitSlop={8} style={styles.headerBtn}>
              <Icon name={{ ios: 'xmark.circle', android: 'cancel' }} color={palette.mutedForeground} size={20} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {questions.length > 3 ? (
        <ListRow title={open ? 'Show fewer' : `Show all ${questions.length} questions`} onPress={() => setOpen((v) => !v)} last />
      ) : null}
    </Card>
  );
}

// --- A test's details, with what can be done by where it is ---

const styles = StyleSheet.create({
  statusScroll: { flexGrow: 0, flexShrink: 0 },
  statusFilters: { paddingVertical: 2 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 44, minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.2, borderRadius: 999 },
  statusLabel: { flexShrink: 0, fontSize: 14 },
  statusCount: { flexShrink: 0, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  hidden: { display: 'none' },
  row: { flexDirection: 'row', gap: 10 },
  cards: { gap: 10 },
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pressed: { opacity: 0.8 },
  testCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  cardMeta: { fontVariant: ['tabular-nums'] },
  cardLine: { fontSize: 14, lineHeight: 19 },
  wizardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  wizardTitle: { fontSize: 18, fontWeight: '700' },
  headerBtn: { padding: 4 },
  wizardBody: { padding: 16, gap: 14 },
  wizardFooter: { padding: 16, gap: 10, borderTopWidth: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  previewNo: { width: 22, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  previewText: { fontSize: 14 },
  previewOption: { flexDirection: 'row', gap: 6, marginTop: 4 },
  previewOptionKey: { width: 16, fontSize: 13, fontWeight: '600' },
  doneHead: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
});
