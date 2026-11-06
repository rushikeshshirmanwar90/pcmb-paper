import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DropdownSelect } from '@/components/dropdown-select';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { Button, Card, DetailRow, ErrorView, Field, Icon, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { bumpDataVersion } from '@/context/data-version';
import { FlowPage } from '@/screens/teacher/create-test/flow-page';
import { useTestDraft } from '@/screens/teacher/create-test/draft';
import { deriveScope, isDerived, uniqueLabels } from '@/screens/teacher/create-test/scope';
import { DateField } from '@/screens/teacher/date-field';
import { durationProblem, marksProblem, maxMarks, scheduleProblem, suggestClosing, timeOf, withDay, withTime } from '@/screens/teacher/test-schedule';
import { TimeField } from '@/screens/tuition/time-field';
import { dateTimeLabel, schoolApi, type TestSummary } from '@/services/school-api';

const MODES = { all: 'All Students', selected: 'Selected Only' } as const;

/** Create Test, page 2 of 2: who can take the test, and when, for how long and how it is marked. */
export function SetupScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { draft, update, markSaved } = useTestDraft();
  const batches = useLoad(() => schoolApi.testBatches(), []);
  const derivation = deriveScope((batches.data ?? []).filter((b) => draft.batchIds.includes(b.id)));
  const derived = isDerived(derivation) ? derivation : null;
  const subject = derived?.subjects.includes(draft.subject) ? draft.subject : '';
  const ready = !!derived && !!subject && draft.questions.length > 0;

  const audienceKey = draft.batchIds.slice().sort().join(',');
  const audience = useLoad(() => schoolApi.testAudience(draft.batchIds, subject), [audienceKey, subject], { enabled: ready });
  const students = audience.data?.students ?? [];
  const labels = uniqueLabels(students);
  const allowedOnly = draft.audienceMode === 'selected';
  const picked = allowedOnly ? draft.studentIds : draft.excludedStudentIds;
  const eligible = allowedOnly ? picked.length : Math.max(0, students.length - picked.length);

  const duration = Number(draft.minutes) || 0;
  const opens = withTime(draft.date, draft.start);
  const closes = draft.end ? withTime(draft.date, draft.end) : suggestClosing(opens, duration || 60);
  const marksPer = Number(draft.correct) || 0;
  const negative = Number(draft.wrong) || 0;

  const timingProblem = () => marksProblem(draft.correct, draft.wrong) ?? durationProblem(draft.minutes) ?? scheduleProblem({ mode: 'later', opensAt: opens, closesAt: closes, durationMinutes: duration });
  const problem = () =>
    (!audience.data ? 'Wait for the student list to load.' : null) ??
    (allowedOnly && !draft.studentIds.length ? 'Select at least one allowed student.' : null) ??
    timingProblem();

  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState<TestSummary | null>(null);

  const create = async () => {
    if (inFlight.current) return;
    setTried(true);
    const issue = problem();
    if (issue || !derived) return setError(issue);
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const test = await schoolApi.createTest({
        batchId: draft.batchIds[0],
        batchIds: draft.batchIds,
        audienceMode: draft.audienceMode,
        ...(allowedOnly ? { studentIds: draft.studentIds } : { excludedStudentIds: draft.excludedStudentIds }),
        title: draft.title.trim(),
        subject,
        standard: derived.standard,
        questions: draft.questions,
        durationMinutes: duration,
        marksPerQuestion: marksPer,
        negativeMarks: negative,
        startNow: false,
        opensAt: opens.toISOString(),
        closesAt: closes.toISOString(),
      });
      markSaved();
      bumpDataVersion();
      setSaved(test);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the test. Try again.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (saved) {
    const open = (id?: string) => {
      router.dismissAll();
      if (id) router.push({ pathname: '/test/[testId]', params: { testId: id } } as Href);
    };
    return (
      <FlowPage
        title="Test created"
        subtitle="Done"
        onBack={() => open()}
        footer={
          <View style={styles.row}>
            <Button label="View Test" variant="secondary" onPress={() => open(saved.id)} style={styles.flex} />
            <Button label="Manage Tests" onPress={() => open()} style={styles.flex} />
          </View>
        }
      >
        <View style={styles.doneHead} accessibilityLiveRegion="polite">
          <View style={[styles.doneIcon, { backgroundColor: palette.successSoft }]}>
            <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.successInk} size={30} />
          </View>
          <Text accessibilityRole="header" style={[styles.doneTitle, { color: palette.foreground }]}>TEST SCHEDULED SUCCESSFULLY</Text>
        </View>
        <Card>
          <DetailRow label="Title" value={saved.title} />
          <DetailRow label="Batch" value={(saved.batches ?? [saved.batch]).map((b) => b.name).join(', ')} />
          <DetailRow label="Subject" value={saved.subject} />
          <DetailRow label="Questions" value={String(saved.questionCount)} />
          <DetailRow label="Marks" value={String(saved.maxScore)} />
          <DetailRow label="Availability" value={`${dateTimeLabel(saved.opensAt)} → ${dateTimeLabel(saved.closesAt)}`} />
        </Card>
      </FlowPage>
    );
  }

  const marksError = tried ? marksProblem(draft.correct, draft.wrong) : null;
  const durationError = tried ? durationProblem(draft.minutes) : null;
  const scheduleError = tried && !marksError && !durationError ? scheduleProblem({ mode: 'later', opensAt: opens, closesAt: closes, durationMinutes: duration }) : null;

  return (
    <FlowPage
      title="Test Setup (2 of 2)"
      subtitle="Access and settings"
      onBack={() => router.back()}
      error={error}
      footer={
        <View style={styles.row}>
          <Button label="Back" variant="secondary" onPress={() => router.back()} disabled={submitting} style={styles.flex} />
          <Button label="Create Test" onPress={() => void create()} loading={submitting} disabled={!ready} style={styles.flex2} />
        </View>
      }
    >
      {!ready ? (
        <Notice tone="warning" title="Finish page 1 first" text="Choose batches, a subject and at least one question, then come back." />
      ) : (
        <>
          <SectionTitle title="Student access" />
          <DropdownSelect
            label="Who can take this test?"
            required
            searchable={false}
            options={Object.values(MODES)}
            selected={MODES[draft.audienceMode]}
            onSelect={(v) => update({ audienceMode: v === MODES.selected ? 'selected' : 'all' })}
          />
          <Muted>{allowedOnly ? 'Only the students you choose can start. Others can request access.' : 'All students in the selected batches, except those you exclude.'}</Muted>
          {audience.loading && !audience.data ? <LoadingView label="Loading students…" /> : null}
          {audience.error && !audience.data ? <ErrorView message={audience.error} onRetry={audience.reload} /> : null}
          {audience.data ? (
            students.length ? (
              <MultiSelectDropdown
                key={draft.audienceMode}
                label={allowedOnly ? 'Select Allowed Students' : 'Exclude Students'}
                options={labels.map((l) => l.label)}
                selected={labels.filter((l) => picked.includes(l.id)).map((l) => l.label)}
                onSelect={(values) => {
                  const ids = labels.filter((l) => values.includes(l.label)).map((l) => l.id);
                  update(allowedOnly ? { studentIds: ids } : { excludedStudentIds: ids });
                }}
                placeholder={allowedOnly ? 'Select multiple' : 'None excluded'}
                emptyText="No students"
                selectedLabel={(n) => `${n} Student${n === 1 ? '' : 's'} Selected`}
                applyOnDone searchable
                icon={{ ios: 'person.2', android: 'group', web: 'group' }}
              />
            ) : <Notice tone="warning" text="No activated students are enrolled in these batches." />
          ) : null}
          <DetailRow label="Eligible Students" value={String(eligible)} />
          {tried && allowedOnly && !draft.studentIds.length ? <Notice tone="danger" text="Select at least one allowed student." /> : null}

          <SectionTitle title="Test settings" />
          <DateField label="Test Date" value={draft.date} minimumDate={new Date()} onChange={(day) => update({ date: withDay(draft.date, day) })} />
          <View style={styles.row}>
            <View style={styles.flex}><TimeField label="Start Time" value={draft.start} onChange={(start) => update({ start })} /></View>
            <View style={styles.flex}><TimeField label="End Time" value={timeOf(closes)} onChange={(end) => update({ end })} /></View>
          </View>
          {scheduleError ? <Notice tone="danger" text={scheduleError} live /> : null}
          <Field label="Duration (minutes)" value={draft.minutes} onChangeText={(v) => update({ minutes: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} hint="Starts when a student opens the test." error={durationError} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Marks Per Question" value={draft.correct} onChangeText={(v) => update({ correct: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" maxLength={5} error={marksError} />
            </View>
            <View style={styles.flex}>
              <Field label="Negative Marking" value={draft.wrong} onChangeText={(v) => update({ wrong: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" maxLength={5} />
            </View>
          </View>
          <DetailRow label="Maximum Marks" value={`${draft.questions.length} × ${marksPer} = ${maxMarks(draft.questions.length, marksPer)}`} />
        </>
      )}
    </FlowPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  row: { flexDirection: 'row', gap: 10 },
  doneHead: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center' },
});
