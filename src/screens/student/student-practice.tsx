import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorView, Icon, ListRow, Muted, Notice, Screen, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { programOf, programSubjects, questionBankOf, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useTabDataVersion } from '@/context/data-version';
import { ContinueCard } from '@/screens/student/practice/continue-card';
import { accuracyInk, PracticeUnavailable } from '@/screens/student/practice/practice-parts';
import { loadLastPractised, practiceSubjectHref } from '@/screens/student/practice/practice-links';
import { retakeSetup, summaryLine } from '@/screens/student/self-assessment';
import { SelfAssessmentFlow, type FlowView } from '@/screens/student/self-assessment-flow';
import { subjectIcon } from '@/screens/student/test-format';
import { dayLabel } from '@/services/school-api';
import { studentApi, type AssessmentSummary } from '@/services/student-api';

/** The tab's key in role-tabs. */
export const PRACTICE_TAB = 'practice';

/** Results listed on the tab; the rest are a tap away in the full list. */
const EARLIER_RESULTS = 3;

/**
 * The Practice tab, daily habit first: Continue (the last topic, or an
 * unfinished self-assessment) → practise by topic (subject → chapter → topic are
 * pushed screens) → self-assessments (to finish, the latest results with their
 * weak topics a tap from a retake, See all, and New).
 *
 * Only JEE and NEET have a question bank. Students of other programs see that
 * practice isn't available yet; nothing is loaded for them.
 */
export function StudentPracticeScreen() {
  const user = useSignedInUser();
  const palette = usePalette();
  const router = useRouter();
  const version = useTabDataVersion(PRACTICE_TAB);
  const program = programOf(user);
  const subjects = programSubjects(program);
  const hasBank = questionBankOf(program) !== null;
  /** Where self-assessment is open at, or null when it's closed. */
  const [assessing, setAssessing] = useState<FlowView | null>(null);
  /** The result whose "Retake weak topics" is making and starting its test, and which one couldn't and why. */
  const [retake, setRetake] = useState<{ busyId: string | null; error: { id: string; message: string } | null }>({ busyId: null, error: null });

  // Self-assessments are made from the question bank too, so they load only with one.
  const assessments = useLoad(() => studentApi.assessments(), [version], { enabled: hasBank, cacheKey: 'self-assessments' });
  const last = useLoad(() => loadLastPractised(user.id), [user.id, version], { enabled: hasBank });

  // Retaking weak topics skips the builder: the test is made from every topic
  // of that result that wasn't strong, in the Retake mix (30% easy, 30%
  // medium, 40% hard), started, and opened on its first question.
  const retakeWeak = async (from: AssessmentSummary) => {
    setRetake({ busyId: from.id, error: null });
    try {
      const detail = await studentApi.assessment(from.id);
      // The same topics the full result's "Retake" takes: weak, getting there, or too few questions to tell.
      const weak = detail.report?.topics.filter((t) => t.level !== 'strong') ?? [];
      if (!weak.length) throw new Error("Every topic in this test was strong, so there's nothing to retake. Try a harder mix next.");
      const made = await studentApi.createAssessment(retakeSetup(from, weak));
      const started = await studentApi.startAssessment(made.assessment.id);
      setAssessing({ kind: 'session', id: started.assessment.id, initial: started });
      setRetake({ busyId: null, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      // A server older than the app doesn't know the Retake mix yet and lists the ones it does.
      const tooOld = message.startsWith('Choose a difficulty mix');
      setRetake({
        busyId: null,
        error: {
          id: from.id,
          message: tooOld ? "Retake isn't on the server yet. It needs the latest server update; try again after that." : message || "Couldn't start the retake. Try again.",
        },
      });
    }
  };
  // New tests start where the student was just working: the subject they practised, else the one they tested last.
  const lastSubject = last.data && subjects.includes(last.data.subject) ? last.data.subject : null;
  const newSubject: SchoolSubject = lastSubject ?? assessments.data?.find((a) => a.state === 'submitted')?.subject ?? assessments.data?.[0]?.subject ?? subjects[0];

  // A timed test left part-way keeps counting down, so its "min left" is kept current.
  const timing = (assessments.data ?? []).some((a) => a.state === 'in-progress' && a.deadline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timing) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [timing]);

  const list = assessments.data ?? [];
  const going = list.filter((a) => a.state !== 'submitted');
  const done = list.filter((a) => a.state === 'submitted');
  const earlier = done.slice(0, EARLIER_RESULTS);
  const newTest = () => setAssessing({ kind: 'build', subject: newSubject, preset: null });

  return (
    <Screen
      title="Practice"
      subtitle="Past-year questions and self-assessment"
      // Nothing loads without a question bank, so there's nothing to refresh.
      onRefresh={hasBank ? assessments.refresh : undefined}
      refreshing={assessments.refreshing}
    >
      {!hasBank ? (
        <PracticeUnavailable program={program} />
      ) : (
        <>
          <ContinueCard />

          <View style={styles.group}>
            <SectionTitle title="Practise by topic" />
            <SubjectChips subjects={subjects} onOpen={(s) => router.push(practiceSubjectHref(s))} />
          </View>

          <View style={styles.group}>
            <SectionTitle
              title="Self-assessments"
              action={done.length > earlier.length ? <SeeAll count={done.length} onPress={() => setAssessing({ kind: 'home' })} /> : null}
            />
            {assessments.loading && !assessments.data ? (
              <SkeletonCard rows={2} label="your self-assessments" />
            ) : assessments.error && !assessments.data ? (
              <ErrorView message={assessments.error} onRetry={assessments.reload} />
            ) : !list.length ? (
              <StartCard error={null} onNew={newTest} />
            ) : (
              <>
                {assessments.error ? <StaleNotice message={assessments.error} onRetry={assessments.reload} /> : null}
                {going.length ? (
                  <Card style={styles.listCard}>
                    {going.map((a, i) => (
                      <TestRow
                        key={a.id}
                        title={a.title}
                        meta={`To finish · ${summaryLine(a, now)}`}
                        trailing={<Text style={[styles.trailingAction, { color: palette.primaryInk }]}>{a.state === 'in-progress' ? 'Continue' : 'Start'}</Text>}
                        last={i === going.length - 1}
                        onPress={() => setAssessing({ kind: 'session', id: a.id })}
                      />
                    ))}
                  </Card>
                ) : null}
                {earlier.length ? (
                  <Card style={styles.listCard}>
                    {earlier.map((a, i) => (
                      <ResultRow
                        key={a.id}
                        a={a}
                        last={i === earlier.length - 1}
                        onOpen={() => setAssessing({ kind: 'session', id: a.id })}
                        retakeBusy={retake.busyId === a.id}
                        // One retake at a time: the others wait while one is being made.
                        retakeDisabled={retake.busyId !== null}
                        retakeError={retake.error?.id === a.id ? retake.error.message : null}
                        onRetake={() => retakeWeak(a)}
                      />
                    ))}
                  </Card>
                ) : null}
                <Button label="New self-assessment" variant="secondary" icon={{ ios: 'plus', android: 'add' }} onPress={newTest} />
              </>
            )}
          </View>
        </>
      )}
      {assessing ? <SelfAssessmentFlow start={assessing} subject={newSubject} onClose={() => setAssessing(null)} /> : null}
    </Screen>
  );
}

// ─── Self-assessment ───────────────────────────────────────────────────────

/** Before the first result: what a self-assessment gives, and the way to make one. */
function StartCard({ error, onNew }: { error: string | null; onNew: () => void }) {
  const palette = usePalette();
  return (
    <Card style={styles.startCard}>
      <Text accessibilityRole="header" style={[styles.startTitle, { color: palette.foreground }]}>
        Find your weak topics
      </Text>
      <Text style={[styles.startText, { color: palette.mutedForeground }]}>
        Make a test from the chapters you choose. Your result shows your strength in every topic, and what to retake.
      </Text>
      {error ? <Muted>{error}</Muted> : null}
      <Button label="Create a self-assessment" icon={{ ios: 'plus', android: 'add' }} onPress={onNew} />
    </Card>
  );
}

// ─── Lists ─────────────────────────────────────────────────────────────────

function TestRow({ title, meta, trailing, last, onPress }: { title: string; meta: string; trailing: React.ReactNode; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {trailing}
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

/**
 * One earlier result: opens the full result. With weak topics, it also
 * retakes them, straight into a new test.
 */
function ResultRow({
  a,
  last,
  onOpen,
  retakeBusy,
  retakeDisabled,
  retakeError,
  onRetake,
}: {
  a: AssessmentSummary;
  last: boolean;
  onOpen: () => void;
  retakeBusy: boolean;
  retakeDisabled: boolean;
  retakeError: string | null;
  onRetake: () => void;
}) {
  const palette = usePalette();
  const strength = a.result?.strength ?? 0;
  const weak = a.result?.weakTopics ?? 0;
  // What tapping Retake makes (the topics don't change its size or time).
  const plan = retakeSetup(a, []);
  const planLine = `${plan.count} questions · ${plan.durationMinutes ? `${plan.durationMinutes} min` : 'no time limit'} · starts right away`;
  return (
    <View style={!last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }}>
      <TestRow
        title={a.title}
        meta={`${a.subject} · ${dayLabel(a.submittedAt ?? a.createdAt)}${weak ? ` · ${weak} weak topic${weak === 1 ? '' : 's'}` : ''}`}
        trailing={
          <View accessible accessibilityLabel={`${strength}% strength`} style={styles.rowFigure}>
            <Text style={[styles.rowStrength, { color: accuracyInk(palette, strength) }]}>{strength}%</Text>
            <Text style={[styles.rowFigureLabel, { color: palette.mutedForeground }]}>strength</Text>
          </View>
        }
        last
        onPress={onOpen}
      />
      {weak ? (
        <View style={styles.retake}>
          {/* Right above the button that was tapped, so it can't go unseen. */}
          {retakeError ? <Notice tone="danger" title="Couldn't start the retake" text={retakeError} live /> : null}
          <Button
            label={retakeBusy ? 'Starting your retake…' : 'Retake weak topics'}
            accessibilityLabel={`Retake the weak topics of ${a.title}: ${planLine}`}
            variant="tonal"
            icon={{ ios: 'arrow.counterclockwise', android: 'replay' }}
            loading={retakeBusy}
            disabled={retakeDisabled && !retakeBusy}
            onPress={onRetake}
          />
          <Text style={[styles.retakeHint, { color: palette.mutedForeground }]}>{planLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SeeAll({ count, onPress }: { count: number; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`See all ${count} results`}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
    >
      <Text style={[styles.seeAllText, { color: palette.primaryInk }]}>See all</Text>
    </Pressable>
  );
}

/** One row per subject, each opening its chapters: a list scans and taps better than wrapping chips. */
function SubjectChips({ subjects, onOpen }: { subjects: SchoolSubject[]; onOpen: (s: SchoolSubject) => void }) {
  return (
    <Card style={styles.subjectList}>
      {subjects.map((s, i) => (
        <ListRow
          key={s}
          icon={subjectIcon(s)}
          title={s}
          subtitle="Past-year questions by chapter"
          onPress={() => onOpen(s)}
          accessibilityLabel={`${s}: practise past-year questions by chapter`}
          last={i === subjects.length - 1}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  group: { gap: 8 },
  listCard: { paddingVertical: 0 },
  summary: { gap: 12, padding: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  summaryRight: { alignItems: 'flex-end' },
  bigNumber: { fontSize: 28, lineHeight: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigOf: { fontSize: 17, fontWeight: '600' },
  strip: { flexDirection: 'row', overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  rowAccuracy: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 60 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowBar: { marginTop: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '700' },
  heading: { gap: 6 },
  headingTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { gap: 10, marginTop: 4 },
  startCard: { gap: 16, padding: 18, borderRadius: 18 },
  retake: { gap: 8, paddingBottom: 12 },
  retakeHint: { fontSize: 13, lineHeight: 18, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowFigure: { alignItems: 'flex-end' },
  rowFigureLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  startTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  startText: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  trailingAction: { fontSize: 15, fontWeight: '700' },
  rowStrength: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subjectList: { paddingVertical: 0 },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  seeAllText: { fontSize: 13, fontWeight: '700' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
});
