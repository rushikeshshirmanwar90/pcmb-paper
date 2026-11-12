import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MultiSelectDropdown } from '@/components/multi-select-dropdown';
import { Button, Card, DetailRow, ErrorView, Field, Icon, Muted, Notice, SectionTitle, Segmented, SkeletonCards, SkeletonRows, useLoad, usePalette } from '@/components/kit';
import { useCacheKeys } from '@/hooks/use-cache-keys';
import { bumpDataVersion } from '@/context/data-version';
import { FlowPage } from '@/screens/teacher/create-test/flow-page';
import { useLeaveCreateTest, useTestDraft } from '@/screens/teacher/create-test/draft';
import { deriveScope, isDerived, uniqueLabels } from '@/screens/teacher/create-test/scope';
import { DateField } from '@/screens/teacher/date-field';
import { durationProblem, marksProblem, maxMarks, scheduleProblem, suggestClosing, timeOf, withDay, withTime } from '@/screens/teacher/test-schedule';
import { TimeField } from '@/screens/tuition/time-field';
import { selectionProblem } from '@/screens/teacher/question-selection/model';
import { dateTimeLabel, schoolApi, type TestSummary } from '@/services/school-api';


/** Create Test, page 2 of 2: who can take the test, and when, for how long and how it is marked. */
export function SetupScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { draft, update, markSaved } = useTestDraft();
  const leave = useLeaveCreateTest();
  // Shared by both pages of Create Test: the second page doesn't ask again.
  const { testBatches: batchesKey } = useCacheKeys();
  const batches = useLoad(() => schoolApi.testBatches(), [batchesKey], { cacheKey: batchesKey });
  const derivation = deriveScope((batches.data ?? []).filter((b) => draft.batchIds.includes(b.id)));
  const derived = isDerived(derivation) ? derivation : null;
  const subjects = draft.selections.map(s => s.subject);
  const subject = subjects.join(', ');
  const ready = !!derived && subjects.every(s => derived.subjects.includes(s)) && !selectionProblem(draft.selections);

  const audienceKey = draft.batchIds.slice().sort().join(',');
  const audience = useLoad(() => schoolApi.testAudience(draft.batchIds, subjects[0], subjects), [audienceKey, subject], { enabled: ready });
  const students = audience.data?.students ?? [];
  const labels = uniqueLabels(students);
  const allowedOnly = draft.audienceMode === 'selected';
  const picked = allowedOnly ? draft.studentIds : draft.excludedStudentIds;
  const eligible = allowedOnly ? picked.length : Math.max(0, students.length - picked.length);

  const duration = Number(draft.minutes) || 0;
  const mode = draft.startMode ?? 'later';
  const opens = withTime(draft.date, draft.start);
  const closes = draft.end ? withTime(draft.date, draft.end) : suggestClosing(opens, duration || 60);
  // The API requires a closing time even for Start Now. Reuse the existing
  // duration-plus-an-hour suggestion, refreshed when submitting.
  const timing = () => mode === 'now'
    ? { startNow: true, closesAt: suggestClosing(new Date(), duration).toISOString() }
    : { startNow: false, opensAt: opens.toISOString(), closesAt: closes.toISOString() };
  const marksPer = Number(draft.correct) || 0;
  const negative = Number(draft.wrong) || 0;

  const timingProblem = () => marksProblem(draft.correct, draft.wrong) ?? durationProblem(draft.minutes) ?? (mode === 'later' ? scheduleProblem({ mode, opensAt: opens, closesAt: closes, durationMinutes: duration }) : null);
  const problem = () =>
    (!ready ? 'Finish subject selections on page 1.' : null) ??
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
        requestId: draft.requestId,
        batchId: draft.batchIds[0],
        batchIds: draft.batchIds,
        audienceMode: draft.audienceMode,
        ...(allowedOnly ? { studentIds: draft.studentIds } : { excludedStudentIds: draft.excludedStudentIds }),
        title: draft.title.trim(),
        subject,
        subjects,
        // The server checks each subject's count against its questions: the count is what was picked.
        subjectTargets: draft.selections.map(s => ({ subject: s.subject, count: s.questions.length })),
        standard: derived.standard,
        questions: draft.questions,
        durationMinutes: duration,
        marksPerQuestion: marksPer,
        negativeMarks: negative,
        ...timing(),
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
        subtitle={saved.status === 'scheduled' ? 'Scheduled' : 'Open now'}
        onBack={() => open()}
        footer={
          <View style={styles.row}>
            <Button label="Back to tests" variant="secondary" onPress={() => open()} style={styles.flex} />
            <Button label="View test" onPress={() => open(saved.id)} style={styles.flex} />
          </View>
        }
      >
        <View style={styles.doneHead} accessibilityLiveRegion="polite">
          <View style={[styles.doneIcon, { backgroundColor: palette.successSoft }]}>
            <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.successInk} size={30} />
          </View>
          <Text accessibilityRole="header" style={[styles.doneTitle, { color: palette.foreground }]}>{saved.status === 'scheduled' ? 'Your test is scheduled' : 'Your test is open'}</Text>
          <Text style={[styles.doneText, { color: palette.mutedForeground }]}>
            {saved.status === 'scheduled' ? `Students can start it from ${dateTimeLabel(saved.opensAt)}.` : 'Students can start it now. You can follow them from the test.'}
          </Text>
        </View>
        <Card>
          <DetailRow label="Title" value={saved.title} />
          <DetailRow label="Batch" value={(saved.batches ?? [saved.batch]).map((b) => b.name).join(', ')} />
          <DetailRow label="Subject" value={saved.subject} />
          <DetailRow label="Questions" value={String(saved.questionCount)} />
          <DetailRow label="Marks" value={String(saved.maxScore)} />
          <DetailRow label="Open" value={`${dateTimeLabel(saved.opensAt)} → ${dateTimeLabel(saved.closesAt)}`} />
        </Card>
      </FlowPage>
    );
  }

  const marksError = tried ? marksProblem(draft.correct, draft.wrong) : null;
  const durationError = tried ? durationProblem(draft.minutes) : null;
  const scheduleError = tried && mode === 'later' && !marksError && !durationError ? scheduleProblem({ mode, opensAt: opens, closesAt: closes, durationMinutes: duration }) : null;

  return (
    <FlowPage
      title="New test"
      subtitle="Step 2 of 2 · Who and when"
      onBack={() => router.back()}
      onClose={leave}
      error={error}
      footer={
        <View style={styles.row}>
          <Button label="Back" variant="secondary" onPress={() => router.back()} disabled={submitting} style={styles.flex} />
          <Button label={mode === 'now' ? 'Publish test' : 'Schedule test'} onPress={() => void create()} loading={submitting} disabled={!ready} style={styles.flex2} />
        </View>
      }
    >
      {!batches.data && batches.loading ? (
        <SkeletonCards count={2} lines={2} label="Loading test details" />
      ) : !batches.data && batches.error ? (
        <ErrorView message={batches.error} onRetry={batches.reload} />
      ) : !ready ? (
        <Notice tone="warning" title="Finish step 1 first" text="Go back and choose batches, subjects and questions for each subject." />
      ) : (
        <>
          <SectionTitle title="Who can take it" />
          <Segmented
            label="Who can take it"
            options={[{ value: 'all', label: 'All students' }, { value: 'selected', label: 'Only some' }]}
            value={draft.audienceMode}
            onChange={(audienceMode) => update({ audienceMode })}
          />
          <Muted>{allowedOnly ? 'Only the students you choose can start. Others can request access.' : 'All students in the selected batches, except those you exclude.'}</Muted>
          {audience.loading && !audience.data ? <SkeletonRows rows={3} label="Loading students" /> : null}
          {audience.error && !audience.data ? <ErrorView message={audience.error} onRetry={audience.reload} /> : null}
          {audience.data ? (
            students.length ? (
              <MultiSelectDropdown
                key={draft.audienceMode}
                label={allowedOnly ? 'Students who can take it' : 'Leave out (optional)'}
                options={labels.map((l) => l.label)}
                selected={labels.filter((l) => picked.includes(l.id)).map((l) => l.label)}
                onSelect={(values) => {
                  const ids = labels.filter((l) => values.includes(l.label)).map((l) => l.id);
                  update(allowedOnly ? { studentIds: ids } : { excludedStudentIds: ids });
                }}
                placeholder={allowedOnly ? 'Choose students' : 'Nobody left out'}
                emptyText="No students"
                selectedLabel={(n) => `${n} student${n === 1 ? '' : 's'}`}
                applyOnDone searchable showSelectedChips
                icon={{ ios: 'person.2', android: 'group', web: 'group' }}
              />
            ) : <Notice tone="warning" text="No activated students are enrolled in these batches." />
          ) : null}
          <DetailRow label="Can take it" value={`${eligible} student${eligible === 1 ? '' : 's'}`} />
          {tried && allowedOnly && !draft.studentIds.length ? <Notice tone="danger" text="Select at least one allowed student." /> : null}

          <SectionTitle title="When" />
          <Segmented
            label="When it opens"
            options={[{ value: 'now', label: 'Open now' }, { value: 'later', label: 'Schedule' }]}
            value={mode}
            onChange={(startMode) => { update({ startMode }); setError(null); }}
          />
          {mode === 'later' ? <>
          <DateField label="Date" value={draft.date} minimumDate={new Date()} onChange={(day) => update({ date: withDay(draft.date, day) })} />
          <View style={styles.row}>
            <View style={styles.flex}><TimeField label="Opens at" value={draft.start} onChange={(start) => update({ start })} /></View>
            <View style={styles.flex}><TimeField label="Closes at" value={timeOf(closes)} onChange={(end) => update({ end })} /></View>
          </View>
          {scheduleError ? <Notice tone="danger" text={scheduleError} live /> : null}
          </> : <Muted>Opens as soon as you publish it. It closes after the time limit plus an hour.</Muted>}
          <SectionTitle title="Time and marks" />
          <Field label="Time limit (minutes)" value={draft.minutes} onChangeText={(v) => update({ minutes: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={3} hint="Starts when a student opens the test." error={durationError} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Right answer (+)" value={draft.correct} onChangeText={(v) => update({ correct: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" maxLength={5} error={marksError} />
            </View>
            <View style={styles.flex}>
              <Field label="Wrong answer (−)" value={draft.wrong} onChangeText={(v) => update({ wrong: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" maxLength={5} />
            </View>
          </View>
          <DetailRow label="Maximum marks" value={`${draft.questions.length} × ${marksPer} = ${maxMarks(draft.questions.length, marksPer)}`} />
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
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  doneText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
