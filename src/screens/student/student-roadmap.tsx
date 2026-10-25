import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Chips, ErrorView, Icon, LoadingView, Muted, ProgressBar, Screen, StatGrid, StatTile, useLoad, usePalette } from '@/components/kit';
import { SUBJECTS_BY_TRACK, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { dayLabel } from '@/services/school-api';
import { LEVEL_LABEL, LEVEL_TONE, studentApi, type RoadmapChapter } from '@/services/student-api';

/**
 * The student's syllabus roadmap, subject by subject: every chapter with its
 * marks weightage, what the tuition has covered, and their strong and weak
 * topics in it.
 */
export function StudentRoadmapScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const subjects = SUBJECTS_BY_TRACK[user.track ?? 'General'];
  const [subject, setSubject] = useState<SchoolSubject>(subjects[0]);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.roadmap(subject), [subject, version]);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen title="Syllabus" subtitle="Your roadmap, chapter by chapter" onRefresh={refresh} refreshing={refreshing}>
      <Chips choices={subjects} selected={subject} onChange={setSubject} />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
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
    </Screen>
  );
}

function ChapterCard({ chapter, open, onToggle, mine }: { chapter: RoadmapChapter; open: boolean; onToggle: () => void; mine: boolean }) {
  const palette = usePalette();
  const pct = chapter.topics.length ? (chapter.coveredTopics / chapter.topics.length) * 100 : 0;
  const whole = chapter.topics.length === 1 && chapter.topics[0].topic === '';
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.head}>
        <View style={styles.flex}>
          <Text style={[styles.chapter, { color: palette.foreground }]}>{chapter.chapter}</Text>
          <View style={styles.badges}>
            <Badge label={chapter.standard} tone={mine ? 'primary' : 'neutral'} />
            {chapter.marks !== null ? <Badge label={`${chapter.marks} marks`} tone="violet" /> : null}
            {chapter.level !== 'not-enough' ? <Badge label={`${LEVEL_LABEL[chapter.level]} · ${chapter.accuracy}%`} tone={LEVEL_TONE[chapter.level]} /> : null}
          </View>
        </View>
        <Icon name={open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.mutedForeground} size={16} />
      </Pressable>
      <View style={styles.coverageTop}>
        <Muted>{whole ? (chapter.coveredTopics ? 'Covered in class' : 'Not covered yet') : `Covered ${chapter.coveredTopics}/${chapter.topics.length} topics`}</Muted>
      </View>
      <ProgressBar value={pct} tone="success" />
      {chapter.strong.length ? <Text style={[styles.line, { color: palette.successInk }]}>Strong: {chapter.strong.join(', ')}</Text> : null}
      {chapter.weak.length ? <Text style={[styles.line, { color: palette.dangerInk }]}>Weak: {chapter.weak.join(', ')}</Text> : null}
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
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chapter: { fontSize: 16, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  line: { fontSize: 13, fontWeight: '600' },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  topicName: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 1 },
});
