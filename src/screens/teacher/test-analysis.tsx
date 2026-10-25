import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, ErrorText, LoadingView, Muted, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { MathText } from '@/components/math-text';
import { useDataVersion } from '@/context/data-version';
import { AccuracyRow } from '@/screens/teacher/student-insight';
import { analysisApi } from '@/services/school-api';

/**
 * How the batch did on a test: the spread of scores, topic understanding
 * across everyone, and the questions most got wrong.
 */
export function TestAnalysisSection({ testId, submitted }: { testId: string; submitted: number }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading } = useLoad(() => analysisApi.test(testId), [testId, version, submitted], { enabled: submitted > 0 });

  if (!submitted) {
    return (
      <>
        <SectionTitle title="Analysis" />
        <Muted>Topic understanding and the hardest questions show once students submit.</Muted>
      </>
    );
  }
  if (loading) return <LoadingView label="Analysing…" />;
  if (error && !data) return <ErrorText message={error} />;
  if (!data) return null;

  const most = Math.max(1, ...data.bands.map((b) => b.students));
  return (
    <>
      <SectionTitle title="Score spread" />
      <Card>
        <Muted>
          Average {data.average} · highest {data.highest} · lowest {data.lowest} (of {data.maxScore})
        </Muted>
        {data.bands.map((b) => (
          <View key={b.from} style={styles.band}>
            <Text style={[styles.bandLabel, { color: palette.mutedForeground }]}>
              {b.from}–{b.to}
            </Text>
            <View style={[styles.bandTrack, { backgroundColor: palette.secondary }]}>
              {b.students ? <View style={[styles.bandFill, { width: `${(b.students / most) * 100}%`, backgroundColor: palette.primary }]} /> : null}
            </View>
            <Text style={[styles.bandCount, { color: palette.foreground }]}>{b.students}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle title="Topic understanding" />
      <Card>
        {data.topics.length ? (
          data.topics.map((t) => (
            <AccuracyRow key={`${t.chapter}|${t.topic}`} label={t.topic || t.chapter} detail={t.topic ? t.chapter : undefined} stat={t} tone={t.accuracy < 40 ? 'danger' : t.accuracy >= 70 ? 'success' : undefined} />
          ))
        ) : (
          <Muted>The questions have no topics to group by.</Muted>
        )}
      </Card>

      <SectionTitle title="Hardest questions" />
      {data.hardest.map((q) => (
        <Card key={q.index}>
          <View style={styles.qTop}>
            <Text style={[styles.qNum, { color: palette.primary }]}>
              Q{q.index + 1} · {q.topic || q.chapter}
            </Text>
            <Text style={[styles.qPct, { color: (q.accuracy ?? 0) < 40 ? palette.dangerInk : palette.foreground }]}>{q.accuracy}% right</Text>
          </View>
          <MathText text={q.questionText} fontSize={14} color={palette.foreground} />
          <Muted>
            Answer {q.correctAnswer || '–'} · picked{' '}
            {Object.entries(q.choices)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k}: ${n}`)
              .join(', ') || 'nothing'}
            {q.skipped ? ` · ${q.skipped} skipped` : ''}
          </Muted>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bandLabel: { width: 64, fontSize: 12, fontVariant: ['tabular-nums'] },
  bandTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  bandFill: { height: 12, borderRadius: 6 },
  bandCount: { width: 24, fontSize: 13, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  qTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  qNum: { fontSize: 13, fontWeight: '800', flex: 1 },
  qPct: { fontSize: 13, fontWeight: '800' },
});
