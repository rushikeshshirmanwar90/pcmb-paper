import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmAction } from '@/components/account-section';
import { QuestionSetFlow, type QuestionFlowControl } from '@/components/create-exam-modal';
import { Diagrams } from '@/components/diagrams';
import { MathText } from '@/components/math-text';
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
import { PROGRAM_LABELS, SCHOOL_STANDARDS, programOf, questionBankOf, type SchoolStandard, type SchoolSubject } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { DateField } from '@/screens/teacher/date-field';
import { pickerQuestions, stepBack } from '@/screens/teacher/test-questions';
import { TestAnalysisSection } from '@/screens/teacher/test-analysis';
import { LiveMonitorSection, useLiveMonitor } from '@/screens/teacher/test-monitor-section';
import { monitorModeOf } from '@/screens/teacher/test-monitor';
import {
  FILTER_LABELS,
  STATUS_FILTER,
  STATUS_WORDS,
  TEST_FILTERS,
  actionsFor,
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
import { dateTimeLabel, schoolApi, type TeacherOverview, type TestDetail as TestDetailData, type TestQuestionCopy, type TestSummary } from '@/services/school-api';
import type { Question, Standard, Subject } from '@/types/pcmb';

export const STATUS_BADGE = STATUS_WORDS;

const ALL = 'all';

/** The teacher's Test Room: set tests for batches, and manage upcoming, live and completed ones. */
export function TeacherTestsScreen() {
  const version = useDataVersion();
  const [batchFilter, setBatchFilter] = useState(ALL);
  const [filter, setFilter] = useState<TestFilter>('all');
  const overview = useLoad(() => schoolApi.teacherOverview(), [version]);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.tests(batchFilter === ALL ? undefined : batchFilter), [batchFilter, version]);
  const [wizard, setWizard] = useState<{ kind: 'new' } | { kind: 'edit'; test: TestSummary; questions: TestQuestionCopy[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const batches = overview.data?.batches ?? [];

  const counts = (status: TestFilter) => (data ? filterTests(data, status).length : 0);
  const shown = data ? sortTests(filterTests(data, filter)) : [];

  return (
    <Screen title="Test Room" subtitle="Set tests for your batches and manage them" onRefresh={refresh} refreshing={refreshing}>
      <Button label="New test" icon={{ ios: 'plus', android: 'add' }} onPress={() => setWizard({ kind: 'new' })} disabled={!batches.length} />
      {overview.data && !batches.length ? <Muted>You can set tests once your tuition assigns you to a batch.</Muted> : null}
      {batches.length > 1 ? (
        <Chips
          choices={[ALL, ...batches.map((b) => b.id)]}
          selected={batchFilter}
          onChange={setBatchFilter}
          labels={Object.fromEntries([[ALL, 'All batches'], ...batches.map((b) => [b.id, b.name])])}
        />
      ) : null}
      <Chips
        choices={TEST_FILTERS}
        selected={filter}
        onChange={setFilter}
        labels={Object.fromEntries(TEST_FILTERS.map((f) => [f, data ? `${FILTER_LABELS[f]} (${counts(f)})` : FILTER_LABELS[f]]))}
      />

      {loading ? (
        <LoadingView />
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
            <TestCard key={t.id} test={t} onPress={() => setOpenId(t.id)} />
          ))}
        </View>
      )}

      {wizard ? (
        <TestWizard
          key={wizard.kind === 'edit' ? wizard.test.id : 'new'}
          edit={wizard.kind === 'edit' ? wizard : null}
          batches={batches}
          onClose={() => setWizard(null)}
          onView={(id) => {
            setWizard(null);
            setOpenId(id);
          }}
          onManage={(status) => {
            setWizard(null);
            setFilter(STATUS_FILTER[status]);
          }}
        />
      ) : null}
      {openId ? (
        <TestDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onEdit={(test, questions) => {
            setOpenId(null);
            setWizard({ kind: 'edit', test, questions });
          }}
        />
      ) : null}
    </Screen>
  );
}

// ─── The list ──────────────────────────────────────────────────────────────

/** The line of timing that matters for where the test is. */
function scheduleLine(t: TestSummary) {
  if (t.status === 'scheduled') return `Opens ${dateTimeLabel(t.opensAt)} · closes ${dateTimeLabel(t.closesAt)}`;
  if (t.status === 'open') return `Closes ${dateTimeLabel(t.closesAt)} · ${t.submitted}/${t.batchStudents} submitted`;
  return `Closed ${dateTimeLabel(t.closesAt)} · ${t.submitted}/${t.batchStudents} submitted`;
}

function TestCard({ test: t, onPress }: { test: TestSummary; onPress: () => void }) {
  const palette = usePalette();
  const badge = STATUS_WORDS[t.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${badge.label}. ${t.batch.name}. ${scheduleLine(t)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.testCard, { backgroundColor: palette.card, borderColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { color: palette.foreground }]} numberOfLines={1}>
          {t.title}
        </Text>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      <Text style={[styles.cardLine, { color: palette.foreground }]} numberOfLines={1}>
        {t.batch.name}
        {t.subject ? ` · ${t.subject}` : ''}
      </Text>
      <Text style={[styles.cardLine, { color: palette.mutedForeground }]} numberOfLines={1}>
        {t.questionCount} Q · {t.maxScore} marks · {t.durationMinutes} min
      </Text>
      <Text style={[styles.cardLine, { color: palette.mutedForeground }]} numberOfLines={2}>
        {scheduleLine(t)}
      </Text>
    </Pressable>
  );
}

// ─── Setting or editing a test: four steps, then a confirmation ────────────

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

function TestWizard({
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
  const [batchId, setBatchId] = useState<string | null>(edit?.test.batch.id ?? batches[0]?.id ?? null);
  const batch = batches.find((b) => b.id === batchId) ?? null;
  const [subjectPick, setSubjectPick] = useState<string | null>(edit?.test.subject ?? null);
  const subject = batch && subjectPick && batch.mySubjects.includes(subjectPick as SchoolSubject) ? subjectPick : batch?.mySubjects.length === 1 ? batch.mySubjects[0] : null;
  const [standardPick, setStandardPick] = useState<SchoolStandard | null>((edit?.test.standard as SchoolStandard) || null);
  const standard = batch?.standard ?? standardPick;
  const bank = batch ? questionBankOf(programOf(batch)) : null;

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
        : await schoolApi.createTest({ ...timing, batchId: batch!.id, title: title.trim(), subject: subject!, standard: standard!, questions });
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

  // The ✕: leaving an edit with unsaved changes asks first; the saved test stays as it was.
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
                <DetailRow label="Batch" value={edit.test.batch.name} />
                <DetailRow label="Subject" value={edit.test.subject} />
              </Card>
            ) : (
              <>
                <Chips label="Batch" choices={batches.map((b) => b.id)} selected={batchId} onChange={(id) => { setBatchId(id); setSubjectPick(null); setStandardPick(null); }} labels={Object.fromEntries(batches.map((b) => [b.id, b.name]))} />
                {batch && !bank ? (
                  <Notice tone="warning" title="No question bank yet" text={`There is no question bank for ${PROGRAM_LABELS[programOf(batch) ?? 'GENERAL']} yet, so tests can't be set for this batch.`} />
                ) : null}
                {batch ? <Chips label="Subject" choices={batch.mySubjects} selected={subject as SchoolSubject | null} onChange={setSubjectPick} /> : null}
                {batch && !batch.standard ? <Chips label="Class" choices={SCHOOL_STANDARDS} selected={standardPick} onChange={setStandardPick} /> : null}
              </>
            )}
          </WizardPage>
        ) : null}

        {/* The question picker stays mounted once opened, so going back to it keeps the picks. */}
        {pickerOpened && (edit || (bank && standard && subject)) ? (
          <View style={[styles.flex, step !== 2 && styles.hidden]}>
            <QuestionSetFlow
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
            />
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
                { value: 'now', label: 'Start Now' },
                { value: 'later', label: 'Schedule for Later' },
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
                {closesPick ? '' : 'Suggested: the time limit plus an hour. '}Students can start until {dateTimeLabel(lastStartOf(closesAt, duration).toISOString())}.
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
                  label={edit ? 'Save changes' : mode === 'now' ? 'Publish Now' : 'Schedule Test'}
                  onPress={publish}
                  loading={submitting}
                  style={styles.flex2}
                />
              </View>
            }
          >
            <Card>
              <DetailRow label="Title" value={title.trim()} />
              <DetailRow label="Batch" value={edit?.test.batch.name ?? batch?.name ?? ''} />
              <DetailRow label="Subject" value={edit?.test.subject ?? subject ?? ''} />
              <DetailRow label="Questions" value={String(questions.length)} />
              <DetailRow label="Marks" value={`${total} (+${marksPer}${negative ? ` / −${negative}` : ''} each)`} />
              <DetailRow label="Time limit" value={`${duration} min`} />
              <DetailRow label="Opens" value={mode === 'now' ? 'Now' : dateTimeLabel(opens.toISOString())} />
              <DetailRow label="Closes" value={dateTimeLabel(closesAt.toISOString())} />
              <DetailRow label="Last start" value={dateTimeLabel(lastStartOf(closesAt, duration).toISOString())} />
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
                <Button label="View Test" variant="secondary" onPress={() => onView(saved.id)} style={styles.flex} />
                <Button label="Manage Tests" onPress={() => onManage(saved.status)} style={styles.flex} />
              </View>
            }
          >
            <View style={styles.doneHead} accessibilityLiveRegion="polite">
              <View style={[styles.doneIcon, { backgroundColor: palette.successSoft }]}>
                <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.successInk} size={30} />
              </View>
              <Text accessibilityRole="header" style={[styles.doneTitle, { color: palette.foreground }]}>
                {saved.status === 'scheduled' ? 'TEST SCHEDULED SUCCESSFULLY' : 'TEST PUBLISHED SUCCESSFULLY'}
              </Text>
            </View>
            <Card>
              <DetailRow label="Title" value={saved.title} />
              <DetailRow label="Batch" value={saved.batch.name} />
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
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.wizardBody} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={[styles.wizardFooter, { borderTopColor: palette.border, backgroundColor: palette.card }]}>
        <ErrorText message={error} />
        {footer}
      </View>
    </View>
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

// ─── A test's details, with what can be done by where it is ────────────────

function TestDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (test: TestSummary, questions: TestQuestionCopy[]) => void }) {
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.test(id), [id, version]);
  const [actionError, setActionError] = useState<string | null>(null);
  const test: TestSummary | undefined = data?.test;
  const can = test ? actionsFor(test) : null;
  // Live: polled while this sheet is open; completed: read once; upcoming: nothing to watch.
  const monitor = useLiveMonitor(id, monitorModeOf(test?.status), reload);

  const act = async (action: () => Promise<unknown>, after?: () => void) => {
    setActionError(null);
    try {
      await action();
      bumpDataVersion();
      void monitor.refresh();
      after?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const closeNow = () =>
    test && confirmAction('Close this test now?', "Students who haven't submitted can't start or finish it any more.", 'Close test', () => act(() => schoolApi.updateTest(test.id, { closeNow: true })));
  const cancelTest = () =>
    test && confirmAction(`Cancel "${test.title}"?`, 'The test is removed before anyone has taken it. Your question bank is not affected.', 'Cancel test', () => act(() => schoolApi.deleteTest(test.id), onClose));

  return (
    <DetailSheet
      visible
      title={test?.title ?? 'Test'}
      onClose={onClose}
      onRefresh={() => {
        refresh();
        void monitor.refresh();
      }}
      refreshing={refreshing}
      footer={
        data?.canEdit && test && can && (can.edit || can.closeNow) ? (
          <View style={styles.row}>
            {can.cancel ? <Button label="Cancel Test" variant="danger" onPress={cancelTest} style={styles.flex} /> : null}
            {can.edit ? <Button label="Edit Test" onPress={() => onEdit(test, data.questions)} style={styles.flex2} /> : null}
            {can.closeNow ? <Button label="Close Now" onPress={closeNow} style={styles.flex} /> : null}
          </View>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data && test ? (
        <>
          <ErrorText message={actionError} />
          <Card>
            <View style={styles.badges}>
              <Badge label={STATUS_WORDS[test.status].label} tone={STATUS_WORDS[test.status].tone} />
            </View>
            <DetailRow label="Subject" value={test.subject || '—'} />
            <DetailRow label="Batch" value={test.batch.name} />
            <DetailRow label="Start time" value={dateTimeLabel(test.opensAt)} />
            <DetailRow label="Closing time" value={dateTimeLabel(test.closesAt)} />
            {test.lastStartAt ? <DetailRow label="Last start" value={dateTimeLabel(test.lastStartAt)} /> : null}
            <DetailRow label="Duration" value={`${test.durationMinutes} min`} />
            <DetailRow label="Total questions" value={String(test.questionCount)} />
            <DetailRow label="Maximum marks" value={String(test.maxScore)} />
            <DetailRow label="Marking" value={`+${test.marksPerQuestion}${test.negativeMarks ? ` / −${test.negativeMarks}` : ', no negative marks'}`} />
            <DetailRow label="Set by" value={test.teacher.name} />
          </Card>

          {test.status === 'scheduled' ? (
            <Muted>{"Students can't see this test's questions until it opens. You can edit or cancel it until then."}</Muted>
          ) : (
            <>
              <LiveMonitorSection monitor={monitor} live={test.status === 'open'} />
              {test.status === 'closed' ? <ResultsList data={data} test={test} /> : null}
              <TestAnalysisSection testId={test.id} submitted={test.submitted} />
            </>
          )}
        </>
      ) : null}
    </DetailSheet>
  );
}

/** The scores of a completed test, best first. */
function ResultsList({ data, test }: { data: TestDetailData; test: TestSummary }) {
  const palette = usePalette();
  return (
    <>
      <SectionTitle title={`Results · ${test.submitted}/${test.batchStudents} submitted`} />
      {test.averageScore !== null ? (
        <Muted>
          Average {test.averageScore} of {test.maxScore}
        </Muted>
      ) : null}
      {data.results.length ? (
        <Card style={styles.listCard}>
          {data.results.map((r, i) => (
            <ListRow
              key={r.student.id}
              title={r.student.name}
              subtitle={
                r.state === 'submitted'
                  ? `${r.correct} right · ${r.wrong} wrong · ${r.skipped} skipped · ${Math.round(r.timeTakenSeconds / 60)} min`
                  : r.state === 'in-progress'
                  ? 'Taking it now'
                  : 'Not taken yet'
              }
              right={
                r.score !== null ? (
                  <Text style={[styles.score, { color: palette.foreground }]}>
                    {r.score}/{test.maxScore}
                  </Text>
                ) : undefined
              }
              last={i === data.results.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Muted>No students in this batch.</Muted>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  hidden: { display: 'none' },
  row: { flexDirection: 'row', gap: 10 },
  cards: { gap: 10 },
  listCard: { paddingVertical: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.8 },
  testCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  cardLine: { fontSize: 13 },
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
  doneTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center' },
});
