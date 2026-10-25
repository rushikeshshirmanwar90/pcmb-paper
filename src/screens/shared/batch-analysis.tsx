import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Badge, Card, ErrorText, ListRow, LoadingView, Muted, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import { AccuracyRow, StudentInsightSheet } from '@/screens/teacher/student-insight';
import { analysisApi } from '@/services/school-api';

/**
 * Student profile analysis, batch-wise: each student's average score and
 * weak topics (tap for their full analysis), and the batch's weakest topics.
 */
export function BatchAnalysisSection({ batchId }: { batchId: string }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, loading } = useLoad(() => analysisApi.batch(batchId), [batchId, version]);
  const [studentId, setStudentId] = useState<string | null>(null);

  if (loading) return <LoadingView label="Loading students…" />;
  if (error && !data) return <ErrorText message={error} />;
  if (!data) return null;

  return (
    <>
      <SectionTitle title={`Students (${data.students.length})`} />
      {data.students.length ? (
        <Card style={styles.listCard}>
          {data.students.map((s, i) => (
            <ListRow
              key={s.student.id}
              icon={{ ios: 'person.fill', android: 'person' }}
              title={s.student.name}
              subtitle={
                s.testsTaken || s.accuracy !== null
                  ? [
                      `${s.testsTaken} test${s.testsTaken === 1 ? '' : 's'}`,
                      s.accuracy !== null ? `${s.accuracy}% right` : null,
                      s.weakest.length ? `Weak: ${s.weakest.join(', ')}` : s.strongTopics ? `${s.strongTopics} strong topic${s.strongTopics === 1 ? '' : 's'}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'No tests or practice yet'
              }
              right={
                s.averagePercent !== null ? (
                  <Badge label={`${s.averagePercent}%`} tone={s.averagePercent >= 70 ? 'success' : s.averagePercent < 40 ? 'danger' : 'warning'} />
                ) : undefined
              }
              onPress={() => setStudentId(s.student.id)}
              last={i === data.students.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Muted>No students in this batch yet.</Muted>
      )}

      {data.weakTopics.length ? (
        <>
          <SectionTitle title="The batch's weakest topics" />
          <Card>
            {data.weakTopics.map((t) => (
              <AccuracyRow key={`${t.subject}|${t.chapter}|${t.topic}`} label={t.topic || t.chapter} detail={`${t.subject} · ${t.chapter}`} stat={t} tone="danger" />
            ))}
          </Card>
        </>
      ) : data.students.some((s) => s.testsTaken) ? (
        <Text style={[styles.note, { color: palette.mutedForeground }]}>No topic is weak across the batch.</Text>
      ) : null}

      {studentId ? <StudentInsightSheet studentId={studentId} onClose={() => setStudentId(null)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  note: { fontSize: 13 },
});
