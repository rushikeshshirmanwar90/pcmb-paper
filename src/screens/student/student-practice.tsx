import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorView, Icon, Screen, SectionTitle, StatusChip, useLoad, usePalette } from '@/components/kit';
import { NeoTag } from '@/design/neo-kit';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { programOf, programSubjects, questionBankOf, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useTabDataVersion } from '@/context/data-version';
import { ContinueCard } from '@/screens/student/practice/continue-card';
import { PracticeUnavailable } from '@/screens/student/practice/practice-parts';
import { assessmentHref, loadLastPractised } from '@/screens/student/practice/practice-links';
import { summaryLine } from '@/screens/student/self-assessment';
import { handOffAssessment, type FlowView } from '@/screens/student/self-assessment-flow';
import { dayLabel } from '@/services/school-api';
import { studentApi, type AssessmentSummary } from '@/services/student-api';
import { face } from '@/design/type';
import { Neo } from '@/design/tokens';

/** The tab's key in role-tabs. */
export const PRACTICE_TAB = 'practice';

/** Results listed on the tab; the rest are a tap away in Past results. */
const RECENT_RESULTS = 3;

/**
 * The Practice tab, just three things, top to bottom: Start practice (the
 * one yellow button: subject → topics → Include PYQs → start), Continue
 * (tests left part-way, else the topic practised last), Recent results (the
 * last three; See all opens the rest, Retake is on each result).
 *
 * Only JEE and NEET have a question bank. Students of other programs see that
 * practice isn't available yet; nothing is loaded for them.
 */
export function StudentPracticeScreen() {
  const user = useSignedInUser();
  const router = useRouter();
  const version = useTabDataVersion(PRACTICE_TAB);
  const program = programOf(user);
  const subjects = programSubjects(program);
  const hasBank = questionBankOf(program) !== null;
  /** Self-assessment opens as a page of its own: the list, making one, or one assessment. */
  const setAssessing = (view: FlowView) => {
    if (view.kind === 'session' && view.initial) handOffAssessment(view.initial);
    router.push(assessmentHref(view.kind === 'session' ? { kind: 'session', id: view.id } : view));
  };
  // Self-assessments are made from the question bank too, so they load only with one.
  const assessments = useLoad(() => studentApi.assessments(), [version], { enabled: hasBank, cacheKey: 'self-assessments' });
  const last = useLoad(() => loadLastPractised(user.id), [user.id, version], { enabled: hasBank });

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
  const recent = done.slice(0, RECENT_RESULTS);
  const newTest = () => setAssessing({ kind: 'build', subject: newSubject, preset: null });
  const seeAll = () => setAssessing({ kind: 'home' });

  return (
    <Screen
      title="Practice"
      subtitle="Pick topics and practise"
      // Nothing loads without a question bank, so there's nothing to refresh.
      onRefresh={hasBank ? assessments.refresh : undefined}
      refreshing={assessments.refreshing}
    >
      {!hasBank ? (
        <PracticeUnavailable program={program} />
      ) : (
        <>
          {/* 1. The tab's one job, at the top: subject → topics → Include PYQs → start. */}
          <Button label="Start practice" size="lg" icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={newTest} accessibilityLabel="Start practice: pick a subject and topics" />

          {/* 2. Continue: tests left part-way; with none, the topic practised last. */}
          {going.length ? (
            <View style={styles.group}>
              <SectionTitle title="Continue" />
              <Card style={styles.listCard}>
                {going.map((a, i) => (
                  <TestRow
                    key={a.id}
                    title={a.title}
                    // The chip says started or not, so the line doesn't repeat it.
                    meta={summaryLine(a, now).replace(/ · (In progress|Not started)/, '')}
                    trailing={a.state === 'in-progress' ? <StatusChip kind="live" word="In progress" /> : <StatusChip kind="new" word="Not started" />}
                    last={i === going.length - 1}
                    onPress={() => setAssessing({ kind: 'session', id: a.id })}
                  />
                ))}
              </Card>
            </View>
          ) : (
            <ContinueCard />
          )}

          {/* 3. Recent results: the last few; See all opens the rest. Retake is on each result. */}
          {assessments.loading && !assessments.data ? (
            <View style={styles.group}>
              <SectionTitle title="Recent results" />
              <SkeletonCard rows={2} label="your results" />
            </View>
          ) : assessments.error && !assessments.data ? (
            <View style={styles.group}>
              <SectionTitle title="Recent results" />
              <ErrorView message={assessments.error} onRetry={assessments.reload} />
            </View>
          ) : recent.length ? (
            <View style={styles.group}>
              <SectionTitle title="Recent results" action={done.length > recent.length ? <SeeAll count={done.length} onPress={seeAll} /> : null} />
              {assessments.error ? <StaleNotice message={assessments.error} onRetry={assessments.reload} /> : null}
              <Card style={styles.listCard}>
                {recent.map((a, i) => (
                  <ResultRow key={a.id} a={a} last={i === recent.length - 1} onOpen={() => setAssessing({ kind: 'session', id: a.id })} />
                ))}
              </Card>
            </View>
          ) : null}
        </>
      )}
    </Screen>
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
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2} textBreakStrategy="balanced" lineBreakStrategyIOS="push-out">
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

/** One result: title, when, how many weak topics and a calm strength chip. Opens the full result (with Retake). */
function ResultRow({ a, last, onOpen }: { a: AssessmentSummary; last: boolean; onOpen: () => void }) {
  const strength = a.result?.strength ?? 0;
  const weak = a.result?.weakTopics ?? 0;
  return (
    <TestRow
      title={a.title}
      meta={`${a.subject} · ${dayLabel(a.submittedAt ?? a.createdAt)}${weak ? ` · ${weak} weak topic${weak === 1 ? '' : 's'}` : ''}`}
      trailing={<NeoTag label={`${strength}%`} tone={strength >= 70 ? 'success' : strength >= 40 ? 'primarySoft' : 'dangerSoft'} accessibilityLabel={`${strength}% strength`} />}
      last={last}
      onPress={onOpen}
    />
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
      <Text style={[styles.seeAllText, { color: palette.foreground }]}>See all</Text>
    </Pressable>
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
  bigNumber: { fontSize: 28, lineHeight: 34, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  bigOf: { fontSize: 17, fontFamily: face.semibold },
  strip: { flexDirection: 'row', overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  rowAccuracy: { fontSize: 13, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  tile: { width: 40, height: 40, borderRadius: Neo.radius.md, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 60 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: face.semibold },
  rowBar: { marginTop: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontFamily: face.bold },
  heading: { gap: 6 },
  headingTitle: { fontSize: 22, fontFamily: face.heavy, lineHeight: 28 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { gap: 10, marginTop: 4 },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  seeAllText: { fontSize: 14, fontFamily: face.bold, textDecorationLine: 'underline' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
});
