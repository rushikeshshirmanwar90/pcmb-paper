import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, DetailSheet, EmptyView, ErrorView, ListRow, LoadingView, Muted, ProgressBar, SectionTitle, StatGrid, StatTile, useLoad, usePalette } from '@/components/kit';
import { TRACK_LABELS, type Track } from '@/constants/school';
import { analysisApi, dayLabel } from '@/services/school-api';
import type { TopicStat } from '@/services/student-api';

/**
 * A student's profile analysis for their teachers and the tuition: test
 * results, accuracy by subject and chapter, and strong and weak topics.
 */
export function StudentInsightSheet({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => analysisApi.student(studentId), [studentId]);
  return (
    <DetailSheet visible title={data?.student.name ?? 'Student'} onClose={onClose} onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          <View style={styles.badges}>
            {data.student.track ? <Badge label={TRACK_LABELS[data.student.track as Track] ?? data.student.track} tone="primary" /> : null}
            {data.student.standard ? <Badge label={data.student.standard} /> : null}
            {data.student.batch ? <Badge label={data.student.batch} /> : null}
          </View>
          <StatGrid>
            <StatTile label="Tests taken" value={data.summary.testsTaken} icon={{ ios: 'list.clipboard', android: 'assignment' }} />
            <StatTile label="Average score" value={data.summary.averagePercent === null ? '–' : `${data.summary.averagePercent}%`} icon={{ ios: 'chart.bar', android: 'bar_chart' }} tone="violet" />
            <StatTile label="Accuracy" value={data.summary.accuracy === null ? '–' : `${data.summary.accuracy}%`} icon={{ ios: 'scope', android: 'target' }} tone="success" />
          </StatGrid>

          {!data.summary.answered ? (
            <Card>
              <EmptyView icon={{ ios: 'chart.bar', android: 'bar_chart' }} title="No answers yet" text="Strong and weak topics show once the student takes tests or practises PYQs." />
            </Card>
          ) : (
            <>
              <TopicList title="Weak topics" stats={data.weak} tone="danger" empty="No weak topics. Good going!" />
              <TopicList title="Strong topics" stats={data.strong} tone="success" empty="None yet. A topic is strong from 70% right (3+ answers)." />

              {data.subjects.map((s) => (
                <View key={s.subject} style={styles.group}>
                  <SectionTitle title={`${s.subject} · ${s.accuracy}% right`} />
                  <Card>
                    {s.chapters.map((c) => (
                      <AccuracyRow key={c.chapter} label={c.chapter} stat={c} />
                    ))}
                  </Card>
                </View>
              ))}
            </>
          )}

          <SectionTitle title="Tests" />
          {data.tests.length ? (
            <Card style={styles.listCard}>
              {data.tests.map((t, i) => (
                <ListRow
                  key={t.testId}
                  title={t.title}
                  subtitle={`${t.correct} right · ${t.wrong} wrong · ${t.skipped} skipped · ${dayLabel(t.submittedAt)}`}
                  right={<Badge label={`${t.score}/${t.maxScore}`} tone={t.percent >= 70 ? 'success' : t.percent < 40 ? 'danger' : 'warning'} />}
                  last={i === data.tests.length - 1}
                />
              ))}
            </Card>
          ) : (
            <Muted>No tests taken yet.</Muted>
          )}
        </>
      ) : null}
    </DetailSheet>
  );
}

function TopicList({ title, stats, tone, empty }: { title: string; stats: TopicStat[]; tone: 'success' | 'danger'; empty: string }) {
  return (
    <>
      <SectionTitle title={title} />
      {stats.length ? (
        <Card>
          {stats.map((s) => (
            <AccuracyRow key={`${s.subject}|${s.chapter}|${s.topic}`} label={s.topic || s.chapter} detail={`${s.subject} · ${s.chapter}`} stat={s} tone={tone} />
          ))}
        </Card>
      ) : (
        <Muted>{empty}</Muted>
      )}
    </>
  );
}

/** A topic or chapter: its name, accuracy and a bar. */
export function AccuracyRow({ label, detail, stat, tone }: { label: string; detail?: string; stat: TopicStat; tone?: 'success' | 'danger' }) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: palette.foreground }]} numberOfLines={2}>
            {label}
          </Text>
          {detail ? <Text style={[styles.detail, { color: palette.mutedForeground }]}>{detail}</Text> : null}
        </View>
        <Text style={[styles.pct, { color: tone === 'danger' ? palette.dangerInk : tone === 'success' ? palette.successInk : palette.foreground }]}>
          {stat.accuracy}%
        </Text>
      </View>
      <ProgressBar value={stat.accuracy} tone={stat.level === 'strong' ? 'success' : 'primary'} />
      <Text style={[styles.detail, { color: palette.mutedForeground }]}>
        {stat.correct} of {stat.answered} right
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  group: { gap: 8 },
  listCard: { paddingVertical: 0 },
  row: { gap: 4, paddingVertical: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  label: { fontSize: 14, fontWeight: '600' },
  detail: { fontSize: 12 },
  pct: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
