import React, { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Badge, Card, Chips, DetailSheet, ErrorView, Icon, ListRow, Muted, ProgressBar, Screen, SectionTitle, StatGrid, StatTile, useLoad, usePalette } from '@/components/kit';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { programOf, programSubjects, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useTabDataVersion } from '@/context/data-version';
import { dayLabel } from '@/services/school-api';
import { LEVEL_LABEL, LEVEL_TONE, studentApi, type RoadmapChapter, type StudentOverview } from '@/services/student-api';

const RECENT_SHOWN = 3;
/** From this text size up, a subject's coverage bar goes under its name instead of beside it. */
const STACK_FROM_FONT_SCALE = 1.3;

/**
 * The student's syllabus: how much the tuition has covered in each subject and
 * what was covered lately (moved here from Home), then the roadmap subject by
 * subject: every chapter with its marks weightage, what's covered, and their
 * strong and weak topics in it.
 */
export function StudentRoadmapScreen() {
  const user = useSignedInUser();
  const version = useTabDataVersion('syllabus');
  const subjects = programSubjects(programOf(user));
  const [subject, setSubject] = useState<SchoolSubject>(subjects[0]);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.roadmap(subject), [subject, version]);
  // The batch's coverage and recent topics; the roadmap below works without it.
  const overview = useLoad(() => studentApi.overview(), [version]);
  const [open, setOpen] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const batch = overview.data?.batch ?? null;
  const recent = overview.data?.recent ?? [];

  return (
    <Screen
      title="Syllabus"
      subtitle="What's covered, chapter by chapter"
      onRefresh={() => {
        refresh();
        overview.refresh();
      }}
      refreshing={refreshing || overview.refreshing}
    >
      {batch ? (
        <>
          <SectionTitle title="Covered in class" />
          <CoverageCard batch={batch} recent={recent} onShowRecent={() => setShowRecent(true)} />
        </>
      ) : overview.loading ? (
        <SkeletonCard rows={3} label="syllabus coverage" />
      ) : null}

      <SectionTitle title="Roadmap" />
      <Chips choices={subjects} selected={subject} onChange={setSubject} />
      {loading ? (
        <SkeletonCard rows={4} label={`${subject} chapters`} />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {error ? <StaleNotice message={error} onRetry={reload} /> : null}
          <StatGrid>
            <StatTile label="Covered" value={`${data.summary.coveredPercent}%`} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
            <StatTile label="Strong topics" value={data.summary.strongTopics} icon={{ ios: 'bolt.fill', android: 'bolt' }} />
            <StatTile label="Weak topics" value={data.summary.weakTopics} icon={{ ios: 'exclamationmark.triangle', android: 'warning' }} tone="warning" />
          </StatGrid>
          {!data.hasBatch ? <Muted>You&apos;re not in a batch yet, so nothing is marked as covered.</Muted> : null}
          {data.chapters.length === 0 ? <Muted>No {subject} chapters in the question bank yet.</Muted> : null}
          {data.chapters.map((c) => {
            const key = `${c.standard}|${c.chapter}`;
            return <ChapterCard key={key} chapter={c} open={open === key} onToggle={() => setOpen(open === key ? null : key)} mine={data.standard === c.standard} />;
          })}
        </>
      ) : null}

      <DetailSheet visible={showRecent} title="Covered in class lately" onClose={() => setShowRecent(false)}>
        <Card style={styles.flush}>
          {recent.map((r, i) => (
            <ListRow key={r.id} title={r.topic || r.chapter} subtitle={`${r.subject}${r.topic ? ` · ${r.chapter}` : ''} · ${dayLabel(r.coveredOn)}`} last={i === recent.length - 1} />
          ))}
        </Card>
      </DetailSheet>
    </Screen>
  );
}

/** Each subject's coverage as a gauge (name, bar, percent), then the last few topics covered in class. */
function CoverageCard({ batch, recent, onShowRecent }: { batch: NonNullable<StudentOverview['batch']>; recent: StudentOverview['recent']; onShowRecent: () => void }) {
  const palette = usePalette();
  // One line per subject reads like a gauge; large text stacks it.
  const { fontScale } = useWindowDimensions();
  const inline = fontScale < STACK_FROM_FONT_SCALE;
  return (
    <Card style={styles.coverageCard}>
      <View style={styles.coverageList}>
        {batch.subjects.map((s) => {
          const c = batch.coverage[s];
          const pct = c?.total ? `${c.percent}%` : '–';
          return (
            <View
              key={s}
              style={inline ? styles.coverageInline : styles.coverageStacked}
              accessible
              accessibilityLabel={`${s}, ${c?.total ? `${c.percent} percent covered, ${c.covered} of ${c.total} topics` : 'no syllabus'}`}
            >
              {inline ? (
                <>
                  <Text style={[styles.subjectName, { color: palette.foreground }]} numberOfLines={1}>
                    {s}
                  </Text>
                  <View style={styles.flex}>
                    <ProgressBar value={c?.percent ?? 0} tone="success" />
                  </View>
                  <Text style={[styles.pct, { color: palette.mutedForeground }]}>{pct}</Text>
                </>
              ) : (
                <>
                  <View style={styles.coverageTop}>
                    <Text style={[styles.subjectStacked, { color: palette.foreground }]}>{s}</Text>
                    <Text style={[styles.pct, { color: palette.mutedForeground }]}>{pct}</Text>
                  </View>
                  <ProgressBar value={c?.percent ?? 0} tone="success" />
                </>
              )}
            </View>
          );
        })}
      </View>
      {recent.length ? (
        <View style={[styles.recent, { borderTopColor: palette.border }]}>
          <Text style={[styles.label, { color: palette.mutedForeground }]}>Covered lately</Text>
          {recent.slice(0, RECENT_SHOWN).map((r) => (
            <Text key={r.id} style={[styles.recentLine, { color: palette.foreground }]} numberOfLines={1}>
              {r.topic || r.chapter} <Text style={{ color: palette.mutedForeground }}>· {r.subject} · {dayLabel(r.coveredOn)}</Text>
            </Text>
          ))}
          {recent.length > RECENT_SHOWN ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all ${recent.length} topics covered lately`}
              onPress={onShowRecent}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
            >
              <Text style={[styles.seeAllText, { color: palette.primary }]}>See all {recent.length}</Text>
              <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.primary} size={14} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Muted>Your teachers mark topics here as they teach them.</Muted>
      )}
    </Card>
  );
}

function ChapterCard({ chapter, open, onToggle, mine }: { chapter: RoadmapChapter; open: boolean; onToggle: () => void; mine: boolean }) {
  const palette = usePalette();
  const pct = chapter.topics.length ? (chapter.coveredTopics / chapter.topics.length) * 100 : 0;
  const whole = chapter.topics.length === 1 && chapter.topics[0].topic === '';
  return (
    <Card>
      {/* The whole summary opens the chapter's topics. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides the topics' : 'Shows the topics'}
        onPress={onToggle}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <View style={styles.head}>
          <View style={styles.flex}>
            <Text style={[styles.chapter, { color: palette.foreground }]}>{chapter.chapter}</Text>
            <View style={styles.badges}>
              {/* Only a chapter from another class needs its class named. */}
              {!mine ? <Badge label={chapter.standard} /> : null}
              {chapter.marks !== null ? <Badge label={`${chapter.marks} marks`} tone="violet" /> : null}
              {chapter.level !== 'not-enough' ? <Badge label={`${LEVEL_LABEL[chapter.level]} · ${chapter.accuracy}%`} tone={LEVEL_TONE[chapter.level]} /> : null}
            </View>
          </View>
          <Icon name={open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.mutedForeground} size={16} />
        </View>
        <Muted>{whole ? (chapter.coveredTopics ? 'Covered in class' : 'Not covered yet') : `Covered ${chapter.coveredTopics} of ${chapter.topics.length} topics`}</Muted>
        <ProgressBar value={pct} tone="success" />
        {chapter.strong.length ? <Text style={[styles.line, { color: palette.successInk }]}>Strong: {chapter.strong.join(', ')}</Text> : null}
        {chapter.weak.length ? <Text style={[styles.line, { color: palette.dangerInk }]}>Weak: {chapter.weak.join(', ')}</Text> : null}
      </Pressable>
      {open
        ? chapter.topics.map((t) => (
            <View key={t.topic || 'whole'} style={[styles.topic, { borderTopColor: palette.border }]}>
              <Icon
                name={t.coveredOn ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }}
                color={t.coveredOn ? palette.success : palette.mutedForeground}
                size={18}
              />
              <View style={styles.flex}>
                <Text style={[styles.topicName, { color: palette.foreground }]}>{t.topic || 'Whole chapter'}</Text>
                <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                  {[t.coveredOn ? `Covered ${dayLabel(t.coveredOn)}` : 'Not covered yet', t.answered ? `${t.accuracy}% right in ${t.answered} answers` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {t.level !== 'not-enough' ? <Badge label={LEVEL_LABEL[t.level]} tone={LEVEL_TONE[t.level]} /> : null}
            </View>
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flush: { padding: 0, gap: 0 },
  coverageCard: { gap: 12, padding: 16 },
  coverageList: { gap: 12 },
  coverageInline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coverageStacked: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectName: { fontSize: 14, fontWeight: '600', width: 96 },
  subjectStacked: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pct: { fontSize: 13, fontWeight: '600', minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, fontWeight: '600' },
  recent: { gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  recentLine: { fontSize: 13, lineHeight: 19 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 44 },
  seeAllText: { fontSize: 15, fontWeight: '700' },
  summary: { gap: 10 },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chapter: { fontSize: 16, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  line: { fontSize: 13, fontWeight: '600' },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  topicName: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 1 },
});
