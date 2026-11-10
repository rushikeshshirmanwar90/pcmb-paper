import React, { type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyView, Icon, Muted, Notice, SectionTitle, usePalette, type IconName, type Palette } from '@/components/kit';
import { PROGRAM_LABELS, type Program } from '@/constants/school';
import { toneOf } from '@/screens/student/practice-session';
import {
  actionsFor,
  ALL_CHAPTER_QUESTIONS,
  completionText,
  countLabel,
  coverageLabel,
  sortTopics,
  type NextPlace,
  type PracticeMode,
  type PracticeNode,
} from '@/screens/student/topic-practice';
import { dayLabel } from '@/services/school-api';
import type { PracticeChapter, PracticeStats, PracticeTopic, PracticeTree } from '@/services/student-api';

// The pieces of topic practice (moved from the Practice tab when subject →
// chapter → topic became pushed screens): a subject's chapters, a chapter's
// topics, one chapter or topic with its actions, and the summaries they share.

export const chapterId = (c: { standard: string; chapter: string }) => `${c.standard}|${c.chapter}`;

/** For programs without a question bank: say so plainly, never show another program's questions. */
export function PracticeUnavailable({ program }: { program: Program | null }) {
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

// ─── Chapters ──────────────────────────────────────────────────────────────

export function ChapterList({ tree, onOpen }: { tree: PracticeTree; onOpen: (c: PracticeChapter) => void }) {
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

export function ChapterView({
  chapter,
  hasBatch,
  onOpen,
}: {
  chapter: PracticeChapter;
  hasBatch: boolean;
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

export function NodeView({
  node,
  stats,
  coveredOn,
  coverage,
  hasBatch,
  untagged,
  next,
  onNext,
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
  onStart: (mode: PracticeMode) => void;
}) {
  const palette = usePalette();
  const actions = actionsFor(stats);
  return (
    <>
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
export const accuracyInk = (palette: Palette, accuracy: number | null) =>
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
export function ResultSummary({ stats, children }: PropsWithChildren<{ stats: PracticeStats }>) {
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
