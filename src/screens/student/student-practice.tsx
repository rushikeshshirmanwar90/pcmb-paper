import React, { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorView,
  Icon,
  LoadingView,
  Muted,
  Notice,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
  type IconName,
  type Palette,
} from '@/components/kit';
import { PROGRAM_LABELS, programOf, programSubjects, questionBankOf, type Program, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { clearPracticeTarget, usePracticeTarget, type PracticeTarget } from '@/context/practice-target';
import { useTabNavigation } from '@/context/tab-context';
import { toneOf } from '@/screens/student/practice-session';
import { retakeSetup, summaryLine } from '@/screens/student/self-assessment';
import { SelfAssessmentFlow, type FlowView } from '@/screens/student/self-assessment-flow';
import { subjectIcon } from '@/screens/student/test-format';
import { TopicPracticeSheet } from '@/screens/student/topic-practice-sheet';
import {
  actionsFor,
  ALL_CHAPTER_QUESTIONS,
  applyAnswer,
  completionText,
  countLabel,
  coverageLabel,
  nextPlace,
  sortTopics,
  statsAt,
  type NextPlace,
  type PracticeMode,
  type PracticeNode,
} from '@/screens/student/topic-practice';
import { dayLabel } from '@/services/school-api';
import {
  studentApi,
  type AssessmentSummary,
  type PracticeChapter,
  type PracticeStats,
  type PracticeTopic,
  type PracticeTree,
} from '@/services/student-api';

/** The tab's key in role-tabs. */
export const PRACTICE_TAB = 'practice';

const ALL = '__all__';
const chapterId = (c: { standard: string; chapter: string }) => `${c.standard}|${c.chapter}`;
/** Earlier results listed on the tab; the rest are a tap away in the full list. */
const EARLIER_RESULTS = 5;
const subjectLabel = (s: SchoolSubject) => (s === 'Mathematics' ? 'Maths' : s);

/**
 * The Practice tab: a new self-assessment, the ones to finish, earlier
 * results (each with its weak topics a tap away from a retake), then topic
 * practice: past-year questions by the student's syllabus, subject → chapter
 * → topic (chapters without named topics skip the topic step), then
 * continue, review or retry. Progress is saved on the server.
 *
 * Only JEE and NEET have a question bank. Students of other programs see
 * that practice isn't available yet; nothing is loaded for them.
 */
export function StudentPracticeScreen() {
  const user = useSignedInUser();
  const palette = usePalette();
  const version = useDataVersion();
  const { activeKey } = useTabNavigation();
  const program = programOf(user);
  const subjects = programSubjects(program);
  const hasBank = questionBankOf(program) !== null;
  /** The subject open in topic practice, or null on the tab's front page. */
  const [subject, setSubject] = useState<SchoolSubject | null>(null);
  const [chapterKey, setChapterKey] = useState<string | null>(null);
  /** A topic name, ALL for the whole chapter, or null while choosing. */
  const [topic, setTopic] = useState<string | null>(null);
  const [session, setSession] = useState<{ node: PracticeNode; mode: PracticeMode } | null>(null);
  /** Where self-assessment is open at, or null when it's closed. */
  const [assessing, setAssessing] = useState<FlowView | null>(null);
  /** The result whose "Retake weak topics" is making and starting its test, and which one couldn't and why. */
  const [retake, setRetake] = useState<{ busyId: string | null; error: { id: string; message: string } | null }>({ busyId: null, error: null });

  // Self-assessments are made from the question bank too, so they load only with one.
  const assessments = useLoad(() => studentApi.assessments(), [version], { enabled: hasBank });
  const trees = useLoad(() => (subject ? studentApi.practiceTree(subject) : Promise.resolve(null)), [subject, version], { enabled: hasBank && !!subject });

  // Only the open subject's data is shown: a chapter picked in another subject is forgotten.
  const tree = subject && trees.data?.subject === subject ? trees.data : null;

  // Opened from Home or a result for a weak topic: open the subject, then its
  // chapter (the student's own class first) and topic once it has loaded.
  // Names that aren't in the syllabus leave the chapter list showing.
  const target = usePracticeTarget();
  // `taken`: the last target handled, so it's taken over once even before the effect clears it.
  const [taken, setTaken] = useState<PracticeTarget | null>(null);
  const [pending, setPending] = useState<PracticeTarget | null>(null);
  // Take the target over (React's "adjust state while rendering" pattern), then clear it.
  if (target && target !== taken && subjects.includes(target.subject)) {
    setTaken(target);
    setPending(target);
    setSubject(target.subject);
    setChapterKey(null);
    setTopic(null);
  }
  useEffect(() => {
    if (target) clearPracticeTarget();
  }, [target]);
  if (pending && tree && tree.subject === pending.subject) {
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const matches = tree.chapters.filter((c) => same(c.chapter, pending.chapter));
    const found = matches.find((c) => c.mine) ?? matches[0];
    const t = found && pending.topic ? found.topics.find((x) => same(x.topic, pending.topic!)) : undefined;
    setPending(null);
    setChapterKey(found ? chapterId(found) : null);
    setTopic(t ? t.topic : null);
  }

  const chapter = tree && chapterKey ? tree.chapters.find((c) => chapterId(c) === chapterKey) ?? null : null;
  const hasTopics = !!chapter?.topics.length;
  const atNode = !!chapter && (!hasTopics || topic !== null);

  const back = () => {
    if (hasTopics && topic !== null) setTopic(null);
    else if (chapterKey !== null) {
      setChapterKey(null);
      setTopic(null);
    } else setSubject(null);
  };
  const openSubject = (s: SchoolSubject) => {
    setSubject(s);
    setChapterKey(null);
    setTopic(null);
  };

  // Android's back button steps up a level while this tab is on screen.
  const deep = subject !== null;
  useEffect(() => {
    if (!deep || activeKey !== PRACTICE_TAB) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  });

  /** Opens a chapter (its topic list, or the chapter itself when it has none) or a topic. */
  const goTo = (place: NextPlace | null) => {
    if (!place) return;
    setChapterKey(chapterId(place));
    setTopic(place.topic);
  };
  // The open session's counts as saved so far, and where to go once it's complete.
  const sessionStats = session && tree ? statsAt(tree.chapters, session.node) : null;
  const sessionNext = session && tree ? nextPlace(tree.chapters, session.node) : null;
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
  // New tests start on the subject the student tested last (newest first).
  const newSubject = assessments.data?.find((a) => a.state === 'submitted')?.subject ?? assessments.data?.[0]?.subject ?? subjects[0];

  // The server has the last word: it may know of no bank for this student either.
  const unavailable = !hasBank || tree?.available === false;

  let body: React.ReactNode;
  if (unavailable) {
    body = (
      <>
        {subject ? <BackRow label="Practice" onPress={back} /> : null}
        <PracticeUnavailable program={program} />
      </>
    );
  } else if (!subject) {
    const list = assessments.data ?? [];
    const going = list.filter((a) => a.state !== 'submitted');
    const done = list.filter((a) => a.state === 'submitted');
    const earlier = done.slice(0, EARLIER_RESULTS);
    const newTest = () => setAssessing({ kind: 'build', subject: newSubject, preset: null });
    body = (
      <>
        {assessments.loading ? (
          <Card>
            <InlineLoading label="Loading your results…" />
          </Card>
        ) : done.length ? (
          <Button label="New self-assessment" icon={{ ios: 'plus', android: 'add' }} onPress={newTest} />
        ) : (
          <StartCard error={assessments.error} onNew={newTest} />
        )}

        {going.length ? (
          <View style={styles.group}>
            <SectionTitle title="To finish" />
            <Card style={styles.listCard}>
              {going.map((a, i) => (
                <TestRow
                  key={a.id}
                  title={a.title}
                  meta={summaryLine(a)}
                  trailing={<Text style={[styles.trailingAction, { color: palette.primaryInk }]}>{a.state === 'in-progress' ? 'Continue' : 'Start'}</Text>}
                  last={i === going.length - 1}
                  onPress={() => setAssessing({ kind: 'session', id: a.id })}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {earlier.length ? (
          <View style={styles.group}>
            <SectionTitle title="Earlier results" action={done.length > earlier.length ? <SeeAll count={done.length} onPress={() => setAssessing({ kind: 'home' })} /> : null} />
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
          </View>
        ) : null}

        <View style={styles.group}>
          <SectionTitle title="Practise by topic" />
          <SubjectChips subjects={subjects} onOpen={openSubject} />
        </View>
      </>
    );
  } else if (trees.loading || (!tree && !trees.error)) body = <LoadingView label={`Loading ${subject}…`} />;
  else if (!tree) {
    body = (
      <>
        <BackRow label="Practice" onPress={back} />
        <ErrorView message={trees.error ?? "Couldn't load practice."} onRetry={trees.reload} />
      </>
    );
  } else if (!chapter) {
    body = <ChapterList tree={tree} onBack={back} onOpen={(c) => { setChapterKey(chapterId(c)); setTopic(null); }} />;
  } else if (!atNode) {
    body = <ChapterView subject={subject} chapter={chapter} hasBatch={tree.hasBatch} onBack={back} onOpen={(t) => setTopic(t ?? ALL)} />;
  } else {
    const node: PracticeNode = { subject, standard: chapter.standard, chapter: chapter.chapter, topic: hasTopics && topic !== ALL ? topic : null };
    const t = node.topic !== null ? chapter.topics.find((x) => x.topic === node.topic) ?? null : null;
    body = (
      <NodeView
        node={node}
        stats={t ?? chapter}
        coveredOn={t ? t.coveredOn : hasTopics ? null : chapter.coveredOn}
        coverage={t ? null : hasTopics ? coverageLabel(chapter) : null}
        hasBatch={tree.hasBatch}
        untagged={node.topic === null ? chapter.untagged : 0}
        backLabel={hasTopics ? chapter.chapter : subject}
        next={nextPlace(tree.chapters, node)}
        onNext={() => goTo(nextPlace(tree.chapters, node))}
        onBack={back}
        onStart={(mode) => setSession({ node, mode })}
      />
    );
  }

  return (
    <Screen
      title="Practice"
      subtitle="Self-assessment and past-year questions"
      // Nothing loads without a question bank, so there's nothing to refresh.
      onRefresh={unavailable ? undefined : () => (subject ? trees.refresh() : assessments.refresh())}
      refreshing={subject ? trees.refreshing : assessments.refreshing}
    >
      {trees.error && tree ? <Muted>{trees.error}</Muted> : null}
      {body}
      {session ? (
        <TopicPracticeSheet
          node={session.node}
          mode={session.mode}
          complete={!!sessionStats && sessionStats.questions > 0 && sessionStats.remaining === 0}
          next={sessionNext ? { label: sessionNext.label, onGo: () => goTo(sessionNext) } : null}
          // Counts move as each answer is saved, so they're already right on the way back.
          onAnswered={(at, delta) => trees.setData((prev) => (prev && prev.subject === session.node.subject ? applyAnswer(prev, at, delta) : prev))}
          onClose={(changed) => {
            setSession(null);
            // Then the server's own numbers, in the background (the screen keeps showing the counts meanwhile).
            if (changed) bumpDataVersion();
          }}
        />
      ) : null}
      {assessing ? <SelfAssessmentFlow start={assessing} subject={subject ?? newSubject} onClose={() => setAssessing(null)} /> : null}
    </Screen>
  );
}

/** For programs without a question bank: say so plainly, never show another program's questions. */
function PracticeUnavailable({ program }: { program: Program | null }) {
  return (
    <Card>
      <EmptyView
        icon={{ ios: 'book', android: 'menu_book' }}
        title={program ? `${PROGRAM_LABELS[program]} practice isn't available yet` : "Practice isn't available yet"}
        text={
          program
            ? 'Past-year questions are ready for JEE and NEET only. Your tests, roadmap, timetable and announcements work as usual.'
            : 'Your tuition hasn\'t set your program yet. Your tests, timetable and announcements work as usual.'
        }
      />
    </Card>
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
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
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
  return (
    <View style={!last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }}>
      <TestRow
        title={a.title}
        meta={`${a.subject} · ${dayLabel(a.submittedAt ?? a.createdAt)}${weak ? ` · ${weak} weak topic${weak === 1 ? '' : 's'}` : ''}`}
        trailing={
          <Text accessibilityLabel={`${strength}% strength`} style={[styles.rowStrength, { color: accuracyInk(palette, strength) }]}>
            {strength}%
          </Text>
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
            accessibilityLabel={`Retake the weak topics of ${a.title}: a new test, starting now`}
            variant="tonal"
            icon={{ ios: 'arrow.counterclockwise', android: 'replay' }}
            loading={retakeBusy}
            disabled={retakeDisabled && !retakeBusy}
            onPress={onRetake}
          />
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

/** Topic practice, kept quiet: one pill per subject, opening its chapters. */
function SubjectChips({ subjects, onOpen }: { subjects: SchoolSubject[]; onOpen: (s: SchoolSubject) => void }) {
  const palette = usePalette();
  return (
    <View style={styles.chips}>
      {subjects.map((s) => (
        <Pressable
          key={s}
          accessibilityRole="button"
          accessibilityLabel={`${s}: practise past-year questions by chapter`}
          onPress={() => onOpen(s)}
          style={({ pressed }) => [styles.chip, { backgroundColor: palette.card, borderColor: palette.border }, pressed && styles.pressed]}
        >
          <Icon name={subjectIcon(s)} color={palette.inkSoft} size={16} />
          <Text style={[styles.chipText, { color: palette.foreground }]}>{subjectLabel(s)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function InlineLoading({ label }: { label: string }) {
  const palette = usePalette();
  return (
    <View style={styles.inlineLoading}>
      <ActivityIndicator color={palette.primary} />
      <Text style={[styles.meta, { color: palette.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Chapters ──────────────────────────────────────────────────────────────

function ChapterList({ tree, onBack, onOpen }: { tree: PracticeTree; onBack: () => void; onOpen: (c: PracticeChapter) => void }) {
  const palette = usePalette();
  const { summary } = tree;
  const heading = (
    <>
      <BackRow label="Practice" onPress={onBack} />
      <Text accessibilityRole="header" style={[styles.headingTitle, { color: palette.foreground }]}>
        {tree.subject}
      </Text>
    </>
  );
  if (!tree.chapters.length) {
    return (
      <>
        {heading}
        <Card>
          <EmptyView icon={{ ios: 'book', android: 'menu_book' }} title="Nothing to practise yet" text={`There are no ${tree.subject} chapters in the question bank yet.`} />
        </Card>
      </>
    );
  }
  const standards = [...new Set(tree.chapters.map((c) => c.standard))];
  return (
    <>
      {heading}
      <ResultSummary stats={summary}>
        {tree.hasBatch ? (
          <Muted>
            Covered in class: {summary.coveredTopics} of {summary.totalTopics} topics
          </Muted>
        ) : (
          <Muted>You&apos;re not in a batch yet, so nothing is marked as covered. Every topic is open to practise.</Muted>
        )}
      </ResultSummary>
      {standards.map((standard) => {
        const rows = tree.chapters.filter((c) => c.standard === standard);
        const mine = rows[0]?.mine;
        return (
          <View key={standard} style={styles.group}>
            <SectionTitle title={`${standard}${mine ? ' · your class' : ''} · ${rows.length} chapter${rows.length === 1 ? '' : 's'}`} />
            <Card style={styles.listCard}>
              {rows.map((c, i) => (
                <Row
                  key={chapterId(c)}
                  title={c.chapter}
                  subtitle={[tree.hasBatch ? coverageLabel(c) : null, countLabel(c)].filter(Boolean).join(' · ')}
                  // Coverage marks only mean something once a batch marks topics as covered.
                  icon={tree.hasBatch ? coverageIcon(c.coveredTopics, c.totalTopics) : undefined}
                  iconColor={c.coveredTopics ? palette.success : palette.mutedForeground}
                  stats={c}
                  last={i === rows.length - 1}
                  onPress={() => onOpen(c)}
                />
              ))}
            </Card>
          </View>
        );
      })}
    </>
  );
}

function ChapterView({
  subject,
  chapter,
  hasBatch,
  onBack,
  onOpen,
}: {
  subject: SchoolSubject;
  chapter: PracticeChapter;
  hasBatch: boolean;
  onBack: () => void;
  onOpen: (topic: string | null) => void;
}) {
  const palette = usePalette();
  const topics = sortTopics(chapter.topics);
  const covered = topics.filter((t) => t.coveredOn);
  const rest = topics.filter((t) => !t.coveredOn);
  const list = (rows: PracticeTopic[]) => (
    <Card style={styles.listCard}>
      {rows.map((t, i) => (
        <Row
          key={t.topic}
          title={t.topic}
          // The section headings say covered or not, so the rows carry no mark of their own.
          subtitle={[t.coveredOn ? `Covered ${dayLabel(t.coveredOn)}` : null, countLabel(t)].filter(Boolean).join(' · ')}
          stats={t}
          last={i === rows.length - 1}
          onPress={() => onOpen(t.topic)}
        />
      ))}
    </Card>
  );
  return (
    <>
      <BackRow label={subject} onPress={onBack} />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.headingTitle, { color: palette.foreground }]}>
          {chapter.chapter}
        </Text>
        <View style={styles.badges}>
          <Badge label={chapter.standard} tone={chapter.mine ? 'primary' : 'neutral'} />
          {hasBatch ? <Badge label={coverageLabel(chapter)} tone={chapter.coveredTopics ? 'success' : 'neutral'} /> : null}
        </View>
      </View>
      <Card style={styles.listCard}>
        <Row
          title={ALL_CHAPTER_QUESTIONS}
          subtitle={[countLabel(chapter), chapter.untagged ? `includes ${chapter.untagged} not tagged to a topic` : null].filter(Boolean).join(' · ')}
          icon={{ ios: 'square.stack.3d.up', android: 'stacks' }}
          iconColor={palette.primary}
          stats={chapter}
          last
          onPress={() => onOpen(null)}
        />
      </Card>
      {covered.length ? (
        <>
          <SectionTitle title="Covered in class" />
          {list(covered)}
        </>
      ) : null}
      {rest.length ? (
        <>
          <SectionTitle title={covered.length ? 'Not covered yet' : 'Topics'} />
          {list(rest)}
        </>
      ) : null}
    </>
  );
}

// ─── One chapter or topic ──────────────────────────────────────────────────

function NodeView({
  node,
  stats,
  coveredOn,
  coverage,
  hasBatch,
  untagged,
  backLabel,
  next,
  onNext,
  onBack,
  onStart,
}: {
  node: PracticeNode;
  /** Where to go once this is complete. */
  next: NextPlace | null;
  onNext: () => void;
  stats: PracticeStats;
  coveredOn: string | null;
  /** For a whole chapter with topics: "Covered 3/7 topics". */
  coverage: string | null;
  hasBatch: boolean;
  untagged: number;
  backLabel: string;
  onBack: () => void;
  onStart: (mode: PracticeMode) => void;
}) {
  const palette = usePalette();
  const actions = actionsFor(stats);
  return (
    <>
      <BackRow label={backLabel} onPress={onBack} />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.headingTitle, { color: palette.foreground }]}>
          {node.topic ?? (coverage ? ALL_CHAPTER_QUESTIONS : node.chapter)}
        </Text>
        <View style={styles.badges}>
          <Badge label={node.standard} tone="neutral" />
          {hasBatch ? (
            coverage ? (
              <Badge label={coverage} tone={coverage.startsWith('Covered') ? 'success' : 'neutral'} />
            ) : (
              <Badge label={coveredOn ? `Covered in class ${dayLabel(coveredOn)}` : 'Not covered yet'} tone={coveredOn ? 'success' : 'neutral'} />
            )
          ) : null}
        </View>
      </View>

      {actions.continue === 'none' ? (
        <Card>
          <EmptyView icon={{ ios: 'tray', android: 'inbox' }} title="No practice questions yet" text="There are no past-year questions for this part of the syllabus yet." />
        </Card>
      ) : (
        <>
          <ResultSummary stats={stats}>
            {untagged ? <Muted>Includes {untagged} question{untagged === 1 ? '' : 's'} of this chapter not tagged to a topic.</Muted> : null}
          </ResultSummary>

          {actions.continue === 'done' ? (
            <Notice
              tone="success"
              icon={{ ios: 'checkmark.seal.fill', android: 'verified' }}
              title={node.topic !== null ? 'Topic complete' : 'Chapter complete'}
              text={`${completionText(stats)}${stats.wrong ? `. Retry the ${stats.wrong} incorrect to improve it.` : '.'}`}
              live
            />
          ) : null}

          <View style={styles.actions}>
            {actions.continue !== 'done' ? (
              <Button
                label={actions.continue === 'start' ? 'Start practice' : 'Continue practice'}
                icon={{ ios: 'play.fill', android: 'play_arrow' }}
                onPress={() => onStart('continue')}
              />
            ) : null}
            {actions.retry ? (
              <Button
                label={`Retry incorrect (${stats.wrong})`}
                variant={actions.primary === 'retry' ? 'primary' : 'tonal'}
                icon={{ ios: 'arrow.counterclockwise', android: 'replay' }}
                onPress={() => onStart('retry')}
              />
            ) : null}
            {actions.again ? (
              <Button label="Practice again" icon={{ ios: 'arrow.clockwise', android: 'restart_alt' }} onPress={() => onStart('again')} />
            ) : null}
            {actions.review ? (
              <Button label="Review answers" variant="secondary" icon={{ ios: 'doc.text.magnifyingglass', android: 'fact_check' }} onPress={() => onStart('review')} />
            ) : null}
          </View>

          {actions.continue === 'done' && next ? (
            <Card style={styles.listCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={next.label}
                onPress={onNext}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.tile, { backgroundColor: palette.primarySoft }]}>
                  <Icon name={{ ios: 'arrow.right', android: 'arrow_forward' }} color={palette.primary} size={18} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.meta, { color: palette.mutedForeground }]}>{next.kind === 'topic' ? 'Next topic' : 'Next chapter'}</Text>
                  <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
                    {next.topic ?? next.chapter}
                  </Text>
                </View>
                <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
              </Pressable>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function coverageIcon(covered: number, total: number): IconName {
  if (covered && covered >= total) return { ios: 'checkmark.circle.fill', android: 'check_circle' };
  if (covered) return { ios: 'circle.lefthalf.filled', android: 'contrast' };
  return { ios: 'circle', android: 'radio_button_unchecked' };
}

/** Accuracy as text: the darker "ink" shade of its band, so it reads at small sizes in both themes. */
const accuracyInk = (palette: Palette, accuracy: number | null) =>
  accuracy === null ? palette.mutedForeground : { success: palette.successInk, warning: palette.warningInk, danger: palette.dangerInk }[toneOf(accuracy)];

/**
 * One bar split into correct, incorrect and still to answer. Visual only: the
 * numbers it shows are always written out next to it.
 */
function AnswerStrip({ stats, thick = false }: { stats: PracticeStats; thick?: boolean }) {
  const palette = usePalette();
  const height = thick ? 8 : 4;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.strip, { height, borderRadius: height / 2, gap: thick ? 2 : 1, backgroundColor: palette.secondary }]}
    >
      {stats.correct ? <View style={{ flex: stats.correct, backgroundColor: palette.success }} /> : null}
      {stats.wrong ? <View style={{ flex: stats.wrong, backgroundColor: palette.danger }} /> : null}
      {stats.remaining ? <View style={{ flex: stats.remaining }} /> : null}
    </View>
  );
}

/** Where a subject, chapter or topic stands: answered of total, accuracy, and the answer strip with its key. */
function ResultSummary({ stats, children }: PropsWithChildren<{ stats: PracticeStats }>) {
  const palette = usePalette();
  return (
    <Card style={styles.summary}>
      <View style={styles.summaryTop}>
        <View accessible accessibilityLabel={`${stats.answered} of ${stats.questions} answered`} style={styles.flex}>
          <Text style={[styles.bigNumber, { color: palette.foreground }]}>
            {stats.answered}
            <Text style={[styles.bigOf, { color: palette.mutedForeground }]}> / {stats.questions}</Text>
          </Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>answered</Text>
        </View>
        <View
          accessible
          accessibilityLabel={stats.accuracy === null ? 'No accuracy yet' : `${stats.accuracy}% accuracy`}
          style={styles.summaryRight}
        >
          <Text style={[styles.bigNumber, { color: accuracyInk(palette, stats.accuracy) }]}>{stats.accuracy === null ? '–' : `${stats.accuracy}%`}</Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>accuracy</Text>
        </View>
      </View>
      <AnswerStrip stats={stats} thick />
      <View style={styles.legend}>
        <LegendItem color={palette.success} label={`${stats.correct} correct`} />
        <LegendItem color={palette.danger} label={`${stats.wrong} incorrect`} />
        <LegendItem color={palette.secondary} border={palette.borderStrong} label={`${stats.remaining} left`} />
      </View>
      {children}
    </Card>
  );
}

function LegendItem({ color, border, label }: { color: string; border?: string; label: string }) {
  const palette = usePalette();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }, border ? { borderWidth: 1, borderColor: border } : null]} />
      <Text style={[styles.legendText, { color: palette.inkSoft }]}>{label}</Text>
    </View>
  );
}

function BackRow({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Icon name={{ ios: 'chevron.left', android: 'chevron_left' }} color={palette.primary} size={16} />
      <Text style={[styles.backText, { color: palette.primary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({
  title,
  subtitle,
  icon,
  iconColor,
  stats,
  last,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon?: IconName;
  iconColor?: string;
  stats: PracticeStats;
  last: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const empty = stats.questions === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, stats.accuracy !== null ? `${stats.accuracy}% right` : null].filter(Boolean).join(', ')}
      accessibilityState={{ disabled: empty }}
      disabled={empty}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
        pressed && styles.pressed,
      ]}
    >
      {icon && iconColor ? <Icon name={icon} color={iconColor} size={20} /> : null}
      <View style={styles.flex}>
        {/* An empty row stays readable: a muted title and no chevron, not faded text. */}
        <Text style={[styles.rowTitle, { color: empty ? palette.mutedForeground : palette.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{subtitle}</Text>
        {stats.answered ? (
          <View style={styles.rowBar}>
            <AnswerStrip stats={stats} />
          </View>
        ) : null}
      </View>
      {stats.accuracy !== null ? (
        <Text style={[styles.rowAccuracy, { color: accuracyInk(palette, stats.accuracy) }]}>{stats.accuracy}%</Text>
      ) : null}
      {empty ? null : <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />}
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
  retake: { gap: 10, paddingBottom: 12 },
  startTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  startText: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  trailingAction: { fontSize: 15, fontWeight: '700' },
  rowStrength: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 15, fontWeight: '600' },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  seeAllText: { fontSize: 13, fontWeight: '700' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
});
