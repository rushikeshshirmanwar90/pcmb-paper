import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Chips, DetailRow, DetailSheet, EmptyView, ErrorView, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import {
  OUTCOME_WORDS,
  marksLabel,
  numberLabel,
  percentLabel,
  durationLabel,
  scoreOfLabel,
  type OutcomeFilter,
} from '@/screens/shared/result-format';
import { TopicPerformanceList, WeakTopicsSection } from '@/screens/shared/topic-performance';
import { QuestionView } from '@/screens/student/question-view';
import { STATE_WORDS } from '@/screens/teacher/test-monitor';
import { schoolApi, type StudentPerformance, type TestSummary } from '@/services/school-api';

const FILTERS: readonly OutcomeFilter[] = ['all', 'correct', 'incorrect', 'unanswered'];

/** One student's attempt for a teacher: the figures, every question with the answer given, and their topics. */
export function StudentPerformanceSheet({ test, studentId, onClose }: { test: TestSummary; studentId: string; onClose: () => void }) {
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.studentResult(test.id, studentId), [test.id, studentId]);
  return (
    <DetailSheet visible title={data?.student.name ?? 'Student'} onClose={onClose} onRefresh={refresh} refreshing={refreshing}>
      {loading ? <LoadingView /> : error && !data ? <ErrorView message={error} onRetry={reload} /> : data ? <Body data={data} test={test} /> : null}
    </DetailSheet>
  );
}

function Body({ data, test }: { data: StudentPerformance; test: TestSummary }) {
  const palette = usePalette();
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [open, setOpen] = useState<number[]>([]);
  const counts = (f: OutcomeFilter) => (f === 'all' ? data.questions.length : data.questions.filter((q) => q.status === f).length);
  const shown = filter === 'all' ? data.questions : data.questions.filter((q) => q.status === filter);
  const state = STATE_WORDS[data.state];

  return (
    <>
      {data.state === 'violation' ? (
        <Notice tone="danger" icon={{ ios: 'exclamationmark.shield', android: 'gpp_maybe' }} title="Ended by a violation" text="The student left the app during the examination, so the test was submitted with the answers saved up to then." />
      ) : null}
      <Card>
        <View style={styles.head}>
          <Text style={[styles.score, { color: palette.foreground }]}>
            {numberLabel(data.score)}
            <Text style={[styles.of, { color: palette.mutedForeground }]}> / {numberLabel(data.maxScore)}</Text>
          </Text>
          <Badge label={state.label} tone={state.tone} />
        </View>
        <DetailRow label="Test" value={test.title} />
        <DetailRow label="Rank" value={`${data.rank} of ${data.ranked}`} />
        <DetailRow label="Marks obtained" value={scoreOfLabel(data.score, data.maxScore)} />
        <DetailRow label="Percentage" value={percentLabel(data.percentage)} />
        <DetailRow label="Accuracy" value={data.accuracy === null ? 'None answered' : `${percentLabel(data.accuracy)} of answered`} />
        <DetailRow label="Correct answers" value={String(data.correct)} />
        <DetailRow label="Incorrect answers" value={String(data.incorrect)} />
        <DetailRow label="Unanswered" value={String(data.unanswered)} />
        <DetailRow label="Negative marks deducted" value={data.negativeDeducted ? `−${numberLabel(data.negativeDeducted)}` : '0'} />
        <DetailRow label="Time taken" value={`${durationLabel(data.timeTakenSeconds)} of ${test.durationMinutes} min`} />
        <DetailRow label="Submission status" value={state.label.charAt(0) + state.label.slice(1).toLowerCase()} />
      </Card>

      <SectionTitle title="Question breakdown" />
      <Chips
        label="Show questions"
        choices={FILTERS}
        selected={filter}
        onChange={setFilter}
        labels={Object.fromEntries(FILTERS.map((f) => [f, `${f === 'all' ? 'All' : OUTCOME_WORDS[f].label} (${counts(f)})`]))}
      />
      {shown.length ? (
        <Card>
          {shown.map((q) => {
            const word = OUTCOME_WORDS[q.status];
            const expanded = open.includes(q.index);
            return (
              <View key={q.index} style={[styles.question, { borderBottomColor: palette.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`Question ${q.index + 1}, ${word.label}, ${marksLabel(q.marks)} marks`}
                  onPress={() => setOpen((cur) => (expanded ? cur.filter((i) => i !== q.index) : [...cur, q.index]))}
                  style={({ pressed }) => [styles.questionHead, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <Text style={[styles.qTitle, { color: palette.foreground }]}>
                      Q{q.index + 1} — {word.label}
                    </Text>
                    <Text style={[styles.qMeta, { color: palette.mutedForeground }]} numberOfLines={1}>
                      {[q.question.chapter, q.question.topic].filter(Boolean).join(' · ') || 'Unclassified'}
                    </Text>
                  </View>
                  <Text style={[styles.marks, { color: q.marks > 0 ? palette.successInk : q.marks < 0 ? palette.dangerInk : palette.mutedForeground }]}>{marksLabel(q.marks)}</Text>
                  <Badge label={word.label} tone={word.tone} />
                </Pressable>
                {expanded ? (
                  <View style={styles.questionBody}>
                    {q.status === 'unmarked' ? <Muted>This question has no answer key, so the answer was not marked.</Muted> : null}
                    <QuestionView
                      question={q.question}
                      selected={q.selected}
                      reveal
                      solutionOpen
                      answerCorrect={q.status === 'correct' ? true : q.status === 'incorrect' ? false : null}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : (
        <Card>
          <EmptyView icon={{ ios: 'checkmark.seal', android: 'verified' }} title="None here" text="No question of this student falls in this group." />
        </Card>
      )}

      <SectionTitle title="Topic performance" />
      <TopicPerformanceList topics={data.topics} audience="student" />
      <WeakTopicsSection weak={data.weakTopics} audience="student" />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  score: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  of: { fontSize: 18, fontWeight: '600' },
  question: { borderBottomWidth: StyleSheet.hairlineWidth },
  questionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  qTitle: { fontSize: 14, fontWeight: '700' },
  qMeta: { fontSize: 12 },
  marks: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  questionBody: { gap: 8, paddingBottom: 12 },
});
