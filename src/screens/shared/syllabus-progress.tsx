import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Chips, ErrorText, ErrorView, Icon, LoadingView, Muted, ProgressBar, usePalette, useLoad } from '@/components/kit';
import type { SchoolSubject } from '@/constants/school';
import { bumpDataVersion } from '@/context/data-version';
import { dayLabel, schoolApi, todayISODate, type SyllabusProgress } from '@/services/school-api';

type Chapter = NonNullable<SyllabusProgress['syllabus']>['chapters'][number];

/**
 * A batch's syllabus for one subject at a time, chapter by chapter, with each
 * topic ticked when it was covered. Teachers tick and untick topics (dated
 * today); students see it read-only.
 */
export function SyllabusProgressView({ batchId, subjects, editable }: { batchId: string; subjects: SchoolSubject[]; editable: boolean }) {
  const [subject, setSubject] = useState<SchoolSubject | null>(subjects[0] ?? null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, loading, reload, setData } = useLoad(
    () => (subject ? schoolApi.progress(batchId, subject) : Promise.resolve(null)),
    [batchId, subject]
  );

  if (!subject) return <Muted>No subjects to show.</Muted>;
  const chapters = data?.syllabus?.chapters ?? [];
  const units = chapters.flatMap((c) => c.topics);
  const covered = units.filter((t) => t.covered).length;

  const toggle = async (chapter: Chapter, topic: string, isCovered: boolean) => {
    const key = `${chapter.standard}|${chapter.chapter}|${topic}`;
    setBusy(key);
    setError(null);
    try {
      if (isCovered) await schoolApi.unmarkCovered(batchId, { subject, standard: chapter.standard, chapter: chapter.chapter, topic });
      else await schoolApi.markCovered(batchId, { subject, standard: chapter.standard, chapter: chapter.chapter, topics: [topic], coveredOn: todayISODate() });
      // Show the change at once, without reloading the whole syllabus.
      setData((prev) =>
        prev?.syllabus
          ? {
              ...prev,
              syllabus: {
                ...prev.syllabus,
                chapters: prev.syllabus.chapters.map((c) =>
                  c === chapter
                    ? { ...c, topics: c.topics.map((t) => (t.topic === topic ? { ...t, covered: isCovered ? null : { on: new Date().toISOString(), by: 'You' } } : t)) }
                    : c
                ),
              },
            }
          : prev
      );
      bumpDataVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {subjects.length > 1 ? <Chips choices={subjects} selected={subject} onChange={setSubject} /> : null}
      {loading ? (
        <LoadingView label="Loading the syllabus…" />
      ) : loadError && !data ? (
        <ErrorView message={loadError} onRetry={reload} />
      ) : !chapters.length ? (
        <Muted>No {subject} chapters in the question bank yet.</Muted>
      ) : (
        <>
          <Card>
            <View style={styles.summaryRow}>
              <SummaryText subject={subject} covered={covered} total={units.length} />
            </View>
            <ProgressBar value={units.length ? (covered / units.length) * 100 : 0} />
            {editable ? <Muted>Tick the topics you covered today; students of the batch see them.</Muted> : null}
          </Card>
          <ErrorText message={error} />
          {chapters.map((chapter) => {
            const key = `${chapter.standard}|${chapter.chapter}`;
            return (
              <ChapterCard
                key={key}
                chapter={chapter}
                open={open === key}
                onToggleOpen={() => setOpen(open === key ? null : key)}
                editable={editable}
                busyKey={busy}
                onToggleTopic={(topic, isCovered) => toggle(chapter, topic, isCovered)}
              />
            );
          })}
        </>
      )}
    </View>
  );
}

function SummaryText({ subject, covered, total }: { subject: string; covered: number; total: number }) {
  const palette = usePalette();
  return (
    <>
      <Text style={[styles.summaryTitle, { color: palette.foreground }]}>{subject}</Text>
      <Text style={[styles.summaryNum, { color: palette.mutedForeground }]}>
        {covered}/{total} topics · {total ? Math.round((covered / total) * 100) : 0}%
      </Text>
    </>
  );
}

function ChapterCard({
  chapter,
  open,
  onToggleOpen,
  editable,
  busyKey,
  onToggleTopic,
}: {
  chapter: Chapter;
  open: boolean;
  onToggleOpen: () => void;
  editable: boolean;
  busyKey: string | null;
  onToggleTopic: (topic: string, isCovered: boolean) => void;
}) {
  const palette = usePalette();
  const done = chapter.topics.filter((t) => t.covered).length;
  const whole = chapter.topics.length === 1 && chapter.topics[0].topic === '';
  const allDone = done === chapter.topics.length;
  return (
    <Card style={styles.chapterCard}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggleOpen} style={styles.chapterHead}>
        <Icon
          name={allDone ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }}
          color={allDone ? palette.success : palette.mutedForeground}
          size={20}
        />
        <View style={styles.flex}>
          <Text style={[styles.chapterName, { color: palette.foreground }]}>{chapter.chapter}</Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>
            {chapter.standard} · {whole ? (done ? 'Covered' : 'Not covered yet') : `${done}/${chapter.topics.length} topics`}
          </Text>
        </View>
        <Icon name={open ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.mutedForeground} size={16} />
      </Pressable>
      {open
        ? chapter.topics.map((t) => {
            const key = `${chapter.standard}|${chapter.chapter}|${t.topic}`;
            const label = t.topic || 'Whole chapter';
            const row = (
              <>
                <Icon
                  name={t.covered ? { ios: 'checkmark.square.fill', android: 'check_box' } : { ios: 'square', android: 'check_box_outline_blank' }}
                  color={t.covered ? palette.success : palette.mutedForeground}
                  size={20}
                />
                <View style={styles.flex}>
                  <Text style={[styles.topic, { color: palette.foreground }]}>{label}</Text>
                  {t.covered ? (
                    <Text style={[styles.meta, { color: palette.mutedForeground }]}>
                      {dayLabel(t.covered.on)}
                      {t.covered.by ? ` · ${t.covered.by}` : ''}
                    </Text>
                  ) : null}
                </View>
              </>
            );
            return editable ? (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!t.covered, busy: busyKey === key }}
                accessibilityLabel={label}
                disabled={busyKey !== null}
                onPress={() => onToggleTopic(t.topic, !!t.covered)}
                style={({ pressed }) => [styles.topicRow, { borderTopColor: palette.border }, pressed && styles.pressed, busyKey === key && styles.busy]}
              >
                {row}
              </Pressable>
            ) : (
              <View key={key} style={[styles.topicRow, { borderTopColor: palette.border }]}>
                {row}
              </View>
            );
          })
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  busy: { opacity: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryNum: { fontSize: 13, fontVariant: ['tabular-nums'] },
  chapterCard: { paddingVertical: 4, gap: 0 },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  chapterName: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 1 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 30, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  topic: { fontSize: 14 },
});
