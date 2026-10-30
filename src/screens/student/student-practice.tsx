import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyView,
  ErrorView,
  Icon,
  LoadingView,
  Muted,
  Notice,
  ProgressBar,
  Screen,
  SectionTitle,
  StatGrid,
  StatTile,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import { SUBJECTS_BY_TRACK, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { clearPracticeTarget, usePracticeTarget, type PracticeTarget } from '@/context/practice-target';
import { useTabNavigation } from '@/context/tab-context';
import { toneOf } from '@/screens/student/practice-session';
import { SelfAssessmentFlow } from '@/screens/student/self-assessment-flow';
import { TopicPracticeSheet } from '@/screens/student/topic-practice-sheet';
import {
  actionsFor,
  ALL_CHAPTER_QUESTIONS,
  applyAnswer,
  breadcrumb,
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
import { studentApi, type PracticeChapter, type PracticeStats, type PracticeTopic, type PracticeTree } from '@/services/student-api';

/** The tab's key in role-tabs. */
export const PRACTICE_TAB = 'practice';

const ALL = '__all__';
const chapterId = (c: { standard: string; chapter: string }) => `${c.standard}|${c.chapter}`;

/**
 * Topic practice: past-year questions by the student's syllabus. Subject →
 * chapter → topic (chapters without named topics skip the topic step), then
 * continue, review or retry. Progress is saved on the server.
 */
export function StudentPracticeScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { activeKey } = useTabNavigation();
  const subjects = SUBJECTS_BY_TRACK[user.track ?? 'General'];
  const [subject, setSubject] = useState<SchoolSubject>(subjects[0]);
  const [chapterKey, setChapterKey] = useState<string | null>(null);
  /** A topic name, ALL for the whole chapter, or null while choosing. */
  const [topic, setTopic] = useState<string | null>(null);
  const [session, setSession] = useState<{ node: PracticeNode; mode: PracticeMode } | null>(null);
  const [assessing, setAssessing] = useState(false);
  const { data, setData, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.practiceTree(subject), [subject, version]);

  // Only this subject's data is shown: a chapter picked in another subject is forgotten.
  const tree = data?.subject === subject ? data : null;

  // Opened from Home for a weak topic: switch subject, then open its chapter
  // (the student's own class first) and topic once that subject has loaded.
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
    else {
      setChapterKey(null);
      setTopic(null);
    }
  };
  const pickSubject = (s: SchoolSubject) => {
    setSubject(s);
    setChapterKey(null);
    setTopic(null);
  };

  // Android's back button steps up a level while this tab is on screen.
  const deep = !!chapter;
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

  let body: React.ReactNode;
  if (loading || (!tree && !error)) body = <LoadingView label={`Loading ${subject}…`} />;
  else if (!tree) body = <ErrorView message={error ?? "Couldn't load practice."} onRetry={reload} />;
  else if (!chapter) {
    body = <ChapterList tree={tree} onOpen={(c) => { setChapterKey(chapterId(c)); setTopic(null); }} />;
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
    <Screen title="Practice" subtitle="Past-year questions, topic by topic" onRefresh={refresh} refreshing={refreshing}>
      {!chapter ? <SelfAssessmentCard onPress={() => setAssessing(true)} /> : null}
      {!chapter ? <Chips choices={subjects} selected={subject} onChange={pickSubject} /> : null}
      {error && tree ? <Muted>{error}</Muted> : null}
      {body}
      {session ? (
        <TopicPracticeSheet
          node={session.node}
          mode={session.mode}
          complete={!!sessionStats && sessionStats.questions > 0 && sessionStats.remaining === 0}
          next={sessionNext ? { label: sessionNext.label, onGo: () => goTo(sessionNext) } : null}
          // Counts move as each answer is saved, so they're already right on the way back.
          onAnswered={(at, delta) => setData((prev) => (prev && prev.subject === session.node.subject ? applyAnswer(prev, at, delta) : prev))}
          onClose={(changed) => {
            setSession(null);
            // Then the server's own numbers, in the background (the screen keeps showing the counts meanwhile).
            if (changed) bumpDataVersion();
          }}
        />
      ) : null}
      {assessing ? <SelfAssessmentFlow subject={subject} onClose={() => setAssessing(false)} /> : null}
    </Screen>
  );
}

/** The way into self-assessment: a test the student makes from chosen chapters and topics. */
function SelfAssessmentCard({ onPress }: { onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Self-assessment. Make a test from chapters and topics you choose and see your strong and weak topics"
      onPress={onPress}
      style={({ pressed }) => [styles.assessCard, { backgroundColor: palette.primarySoft, borderColor: palette.primaryBorder }, pressed && styles.pressed]}
    >
      <View style={[styles.tile, { backgroundColor: palette.card }]}>
        <Icon name={{ ios: 'checklist', android: 'fact_check' }} color={palette.primary} size={20} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.primaryInk }]}>Self-assessment</Text>
        <Text style={[styles.meta, { color: palette.primaryInk }]}>Make a test from your chosen topics and find where you&apos;re strong or weak</Text>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.primaryInk} size={16} />
    </Pressable>
  );
}

// ─── Chapters ──────────────────────────────────────────────────────────────

function ChapterList({ tree, onOpen }: { tree: PracticeTree; onOpen: (c: PracticeChapter) => void }) {
  const palette = usePalette();
  const { summary } = tree;
  if (!tree.chapters.length) {
    return (
      <Card>
        <EmptyView icon={{ ios: 'book', android: 'menu_book' }} title="Nothing to practise yet" text={`There are no ${tree.subject} chapters in the question bank yet.`} />
      </Card>
    );
  }
  const standards = [...new Set(tree.chapters.map((c) => c.standard))];
  return (
    <>
      <Card style={styles.overview}>
        <View style={styles.overviewTop}>
          <View style={[styles.tile, { backgroundColor: palette.primarySoft }]}>
            <Icon name={{ ios: 'book', android: 'menu_book' }} color={palette.primary} size={20} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.overviewTitle, { color: palette.foreground }]}>{tree.subject}</Text>
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>
              {summary.answered} of {summary.questions} practised{summary.accuracy !== null ? ` · ${summary.accuracy}% right` : ''}
            </Text>
          </View>
          {summary.accuracy !== null ? <Badge label={`${summary.accuracy}%`} tone={toneOf(summary.accuracy)} /> : null}
        </View>
        <ProgressBar value={summary.questions ? (summary.answered / summary.questions) * 100 : 0} tone="success" />
        {tree.hasBatch ? (
          <Muted>
            Covered in class: {summary.coveredTopics} of {summary.totalTopics} topics
          </Muted>
        ) : (
          <Muted>You&apos;re not in a batch yet, so nothing is marked as covered. Every topic is open to practise.</Muted>
        )}
      </Card>
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
                  icon={coverageIcon(c.coveredTopics, c.totalTopics)}
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
          subtitle={[t.coveredOn ? `Covered ${dayLabel(t.coveredOn)}` : null, countLabel(t)].filter(Boolean).join(' · ')}
          icon={t.coveredOn ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }}
          iconColor={t.coveredOn ? palette.success : palette.mutedForeground}
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
          {chapter.accuracy !== null ? <Badge label={`${chapter.accuracy}% right`} tone={toneOf(chapter.accuracy)} /> : null}
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
        <Text style={[styles.path, { color: palette.mutedForeground }]}>{breadcrumb(node)}</Text>
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
          <StatGrid>
            <StatTile label="Total" value={stats.questions} icon={{ ios: 'square.stack', android: 'stacks' }} />
            <StatTile label="Answered" value={stats.answered} icon={{ ios: 'pencil.and.list.clipboard', android: 'edit_note' }} tone="violet" />
            <StatTile label="Remaining" value={stats.remaining} icon={{ ios: 'hourglass', android: 'hourglass_empty' }} tone="neutral" />
            <StatTile label="Correct" value={stats.correct} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
            <StatTile label="Incorrect" value={stats.wrong} icon={{ ios: 'xmark.circle', android: 'cancel' }} tone="danger" />
            <StatTile label="Accuracy" value={stats.accuracy === null ? '–' : `${stats.accuracy}%`} icon={{ ios: 'target', android: 'my_location' }} tone={stats.accuracy === null ? 'neutral' : toneOf(stats.accuracy)} />
          </StatGrid>
          <ProgressBar value={stats.questions ? (stats.answered / stats.questions) * 100 : 0} tone="success" />
          {untagged ? <Muted>Includes {untagged} question{untagged === 1 ? '' : 's'} of this chapter not tagged to a topic.</Muted> : null}

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
  icon: IconName;
  iconColor: string;
  stats: PracticeStats;
  last: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const empty = stats.questions === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityState={{ disabled: empty }}
      disabled={empty}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
        empty && styles.empty,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} color={iconColor} size={20} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>{subtitle}</Text>
        {stats.answered ? (
          <View style={styles.rowBar}>
            <ProgressBar value={(stats.answered / Math.max(1, stats.questions)) * 100} tone="success" />
          </View>
        ) : null}
      </View>
      {stats.accuracy !== null ? <Badge label={`${stats.accuracy}%`} tone={toneOf(stats.accuracy)} /> : null}
      {empty ? null : <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  empty: { opacity: 0.55 },
  group: { gap: 8 },
  listCard: { paddingVertical: 0 },
  overview: { gap: 12, padding: 16 },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overviewTitle: { fontSize: 17, fontWeight: '700' },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 60 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowBar: { marginTop: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '700' },
  heading: { gap: 6 },
  headingTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  path: { fontSize: 13, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { gap: 10, marginTop: 4 },
  assessCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, minHeight: 72 },
});
