import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Chips, DetailRow, EmptyView, ErrorView, Field, ListRow, LoadingView, Muted, ProgressBar, SectionTitle, StatGrid, StatTile, useLoad, usePalette } from '@/components/kit';
import { MathText } from '@/components/math-text';
import { useDataVersion } from '@/context/data-version';
import {
  QUESTION_VIEWS,
  QUESTION_VIEW_LABELS,
  RANK_FILTERS,
  RANK_FILTER_LABELS,
  extremes,
  filterCounts,
  filterNotAttempted,
  filterRankings,
  namesLabel,
  numberLabel,
  percentLabel,
  questionCounts,
  questionHeading,
  questionsForView,
  rankingLine,
  rankingSpoken,
  scoreOfLabel,
  toneOfPercent,
  type QuestionView as QuestionViewKind,
  type RankFilter,
} from '@/screens/shared/result-format';
import { TopicPerformanceList, WeakTopicsSection } from '@/screens/shared/topic-performance';
import { QuestionView } from '@/screens/student/question-view';
import { StudentPerformanceSheet } from '@/screens/teacher/student-performance-sheet';
import { STATE_WORDS } from '@/screens/teacher/test-monitor';
import { schoolApi, type QuestionStatistic, type RankingRow, type TestQuestionCopy, type TestResults, type TestSummary } from '@/services/school-api';

/**
 * The results of a completed test: how the batch did, the ranking, which questions
 * and topics were hard, and who needs help. Every figure comes from the server.
 */
export function TestResultsSection({ test, questions }: { test: TestSummary; questions: TestQuestionCopy[] }) {
  const version = useDataVersion();
  const { data, error, loading, reload } = useLoad(() => schoolApi.testResults(test.id), [test.id, version]);
  const [studentId, setStudentId] = useState<string | null>(null);

  if (loading) return <LoadingView label="Loading results…" />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <Summary data={data} test={test} />
      <Rankings data={data} test={test} onOpen={setStudentId} />
      <QuestionAnalysis data={data} questions={questions} />
      <SectionTitle title="Topic performance" />
      {data.summary.attempted ? <TopicPerformanceList topics={data.topics} audience="batch" /> : <Muted>Topic performance shows once students have submitted.</Muted>}
      {data.summary.attempted ? <WeakTopicsSection weak={data.weakTopics} audience="batch" /> : null}
      {studentId ? <StudentPerformanceSheet test={test} studentId={studentId} onClose={() => setStudentId(null)} /> : null}
    </>
  );
}

function Summary({ data, test }: { data: TestResults; test: TestSummary }) {
  const s = data.summary;
  const max = test.maxScore;
  return (
    <>
      <SectionTitle title="Results" />
      <StatGrid>
        <StatTile label="TOTAL STUDENTS" value={s.total} icon={{ ios: 'person.2', android: 'groups' }} tone="violet" />
        <StatTile label="ATTEMPTED" value={s.attempted} icon={{ ios: 'checkmark.circle', android: 'check_circle' }} tone="success" />
      </StatGrid>
      <StatGrid>
        <StatTile label="NOT ATTEMPTED" value={s.notAttempted} icon={{ ios: 'clock', android: 'schedule' }} tone="neutral" />
        <StatTile label="AVERAGE SCORE" value={s.averageScore === null ? '–' : numberLabel(s.averageScore)} icon={{ ios: 'chart.bar', android: 'bar_chart' }} />
      </StatGrid>
      <StatGrid>
        <StatTile label="HIGHEST SCORE" value={s.highest === null ? '–' : numberLabel(s.highest)} icon={{ ios: 'arrow.up', android: 'arrow_upward' }} tone="success" />
        <StatTile label="LOWEST SCORE" value={s.lowest === null ? '–' : numberLabel(s.lowest)} icon={{ ios: 'arrow.down', android: 'arrow_downward' }} tone="danger" />
      </StatGrid>
      <StatGrid>
        <StatTile label="AVERAGE %" value={percentLabel(s.averagePercentage)} icon={{ ios: 'percent', android: 'percent' }} tone="violet" />
        <StatTile label="AVERAGE ACCURACY" value={percentLabel(s.averageAccuracy)} icon={{ ios: 'scope', android: 'target' }} tone="success" />
      </StatGrid>
      <Card>
        <DetailRow label="Submission rate" value={s.submissionRate === null ? '–' : `${percentLabel(s.submissionRate)} (${s.attempted} of ${s.total})`} />
        <DetailRow label="Normal submissions" value={String(s.normal)} />
        <DetailRow label="Auto-submissions" value={String(s.autoSubmitted)} />
        <DetailRow label="Security violations" value={String(s.violations)} />
        {s.inProgress ? <DetailRow label="Still answering" value={String(s.inProgress)} /> : null}
      </Card>
      {s.former ? (
        <Muted>
          Total is the batch today plus {s.former} former student{s.former === 1 ? '' : 's'} who finished this test and have since left the batch. Their results are kept.
        </Muted>
      ) : null}
      <Muted>
        {s.attempted
          ? `Averages are over the ${s.attempted} student${s.attempted === 1 ? '' : 's'} who attempted it, out of ${numberLabel(max)} marks. Accuracy is right answers out of answered questions.`
          : 'No student attempted this test, so there are no scores to average.'}
      </Muted>
    </>
  );
}

function Rankings({ data, test, onOpen }: { data: TestResults; test: TestSummary; onOpen: (studentId: string) => void }) {
  const palette = usePalette();
  const [filter, setFilter] = useState<RankFilter>('all');
  const [query, setQuery] = useState('');
  const counts = filterCounts(data);
  const rows = filterRankings(data.rankings, filter, query);
  const absent = filterNotAttempted(data.notAttempted, query);
  const { highest, lowest } = extremes(data.rankings);
  const max = test.maxScore;

  return (
    <>
      <SectionTitle title="Rankings" />
      {highest.length ? (
        <Card>
          <Text style={[styles.lead, { color: palette.successInk }]}>
            Highest · {namesLabel(highest)} · {scoreOfLabel(highest[0].score, max)}
          </Text>
          {lowest.length ? (
            <Text style={[styles.lead, { color: palette.dangerInk }]}>
              Lowest · {namesLabel(lowest)} · {scoreOfLabel(lowest[0].score, max)}
            </Text>
          ) : null}
        </Card>
      ) : null}
      <Chips
        label="Show"
        choices={RANK_FILTERS}
        selected={filter}
        onChange={setFilter}
        labels={Object.fromEntries(RANK_FILTERS.map((f) => [f, `${RANK_FILTER_LABELS[f]} (${counts[f]})`]))}
      />
      <Field label="Search students" value={query} onChangeText={setQuery} placeholder="Name" autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />

      {filter === 'not-attempted' ? (
        absent.length ? (
          <Card style={styles.listCard}>
            {absent.map((s, i) => (
              <ListRow key={s.id} title={s.name} subtitle="Did not attempt this test" right={<Badge label="NOT ATTEMPTED" />} last={i === absent.length - 1} />
            ))}
          </Card>
        ) : (
          <Empty all={!data.notAttempted.length} searching={!!query.trim()} filter={filter} />
        )
      ) : rows.length ? (
        <Card style={styles.listCard}>
          {rows.map((r, i) => (
            <RankRow key={r.student.id} row={r} max={max} last={i === rows.length - 1} onPress={() => onOpen(r.student.id)} />
          ))}
        </Card>
      ) : (
        <Empty all={!data.rankings.length} searching={!!query.trim()} filter={filter} />
      )}
      {filter === 'all' && !query.trim() && data.notAttempted.length ? (
        <Muted>
          {data.notAttempted.length} student{data.notAttempted.length === 1 ? '' : 's'} did not attempt the test and {data.notAttempted.length === 1 ? 'is' : 'are'} not ranked. See Not Attempted.
        </Muted>
      ) : null}
      <Muted>Equal scores share a rank; the quicker attempt is listed first. Top performers scored 70% or more; needs improvement is under 40%.</Muted>
    </>
  );
}

function RankRow({ row: r, max, last, onPress }: { row: RankingRow; max: number; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const state = STATE_WORDS[r.state];
  return (
    <ListRow
      title={`${r.rank}. ${r.student.name}`}
      subtitle={rankingLine(r)}
      accessibilityLabel={rankingSpoken(r, max)}
      onPress={onPress}
      last={last}
      right={
        <View style={styles.rankRight}>
          <Text style={[styles.score, { color: toneOfPercent(r.percentage) === 'danger' ? palette.dangerInk : palette.foreground }]}>
            {numberLabel(r.score)}/{numberLabel(max)}
          </Text>
          <Badge label={state.label} tone={state.tone} />
        </View>
      }
    />
  );
}

function Empty({ all, searching, filter }: { all: boolean; searching: boolean; filter: RankFilter }) {
  return (
    <Card>
      <EmptyView
        icon={{ ios: 'person.2', android: 'groups' }}
        title={searching ? 'No student found' : all ? (filter === 'not-attempted' ? 'Everyone attempted it' : 'Nobody attempted it') : 'No students here'}
        text={searching ? 'No name matches your search in this list.' : all ? (filter === 'not-attempted' ? 'Every student of the batch took the test.' : 'Rankings show once students have submitted.') : 'No student falls in this group.'}
      />
    </Card>
  );
}

function QuestionAnalysis({ data, questions }: { data: TestResults; questions: TestQuestionCopy[] }) {
  const [view, setView] = useState<QuestionViewKind>('all');
  const shown = questionsForView(data, view);
  return (
    <>
      <SectionTitle title="Question analysis" />
      {!data.summary.attempted ? (
        <Muted>Question statistics show once students have submitted.</Muted>
      ) : (
        <>
          <Chips choices={QUESTION_VIEWS} selected={view} onChange={setView} labels={QUESTION_VIEW_LABELS} label="Show questions" />
          {shown.length ? (
            shown.map((q) => <QuestionCard key={q.index} stat={q} copy={questions[q.index]} />)
          ) : (
            <Card>
              <EmptyView icon={{ ios: 'checkmark.seal', android: 'verified' }} title="None to show" text="No question fits this view for this test." />
            </Card>
          )}
          <Muted>Rates are out of those who answered the question; skipped is out of everyone who attempted the test. Option counts are the answers students actually saved.</Muted>
        </>
      )}
    </>
  );
}

function QuestionCard({ stat: q, copy }: { stat: QuestionStatistic; copy: TestQuestionCopy | undefined }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const most = Math.max(1, ...Object.values(q.options ?? {}));
  return (
    <Card>
      <View style={styles.qTop}>
        <Text style={[styles.qHeading, { color: palette.primary }]} numberOfLines={2}>
          {questionHeading(q)}
        </Text>
        <Text style={[styles.qRate, { color: palette.foreground }]}>{q.correctRate === null ? '–' : percentLabel(q.correctRate)}</Text>
      </View>
      <ProgressBar value={q.correctRate ?? 0} tone={q.correctRate !== null && q.correctRate >= 70 ? 'success' : q.correctRate !== null && q.correctRate < 40 ? 'danger' : 'primary'} />
      <Text style={[styles.qCounts, { color: palette.foreground }]}>{questionCounts(q)}</Text>
      <Muted>
        {q.bonus
          ? 'Bonus question: full marks to everyone.'
          : !q.hasKey
          ? 'No answer key, so answers could not be marked.'
          : q.correctRate === null
          ? 'Nobody answered this question.'
          : `Correct rate ${percentLabel(q.correctRate)} · incorrect ${percentLabel(q.incorrectRate)} · skipped ${percentLabel(q.skipRate)}`}
      </Muted>
      {q.options ? (
        <View style={styles.options} accessibilityLabel="Answers chosen by option">
          {Object.entries(q.options).map(([key, n]) => {
            const right = q.correctAnswer.trim().toUpperCase() === key;
            return (
              <View key={key} style={styles.optionRow} accessible accessibilityLabel={`Option ${key}${right ? ', correct answer' : ''}: ${n} student${n === 1 ? '' : 's'}`}>
                <Text style={[styles.optionKey, { color: right ? palette.successInk : palette.foreground }]}>{right ? `${key} ✓` : key}</Text>
                <View style={[styles.track, { backgroundColor: palette.secondary }]}>
                  {n ? <View style={[styles.fill, { width: `${(n / most) * 100}%`, backgroundColor: right ? palette.success : palette.borderStrong }]} /> : null}
                </View>
                <Text style={[styles.optionCount, { color: palette.foreground }]}>{n}</Text>
              </View>
            );
          })}
        </View>
      ) : q.answerType === 'Numerical' ? (
        <Muted>Numerical answer: there are no options to count. Answer {q.correctAnswer || '–'}.</Muted>
      ) : null}
      {copy ? (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} hitSlop={8} style={styles.toggle}>
            <Text style={[styles.toggleText, { color: palette.primary }]}>{open ? 'Hide question' : 'Show question and solution'}</Text>
          </Pressable>
          {open ? <QuestionView question={{ ...copy, answerType: copy.answerType ?? q.answerType, optionDiagramUrls: { A: [], B: [], C: [], D: [], ...copy.optionDiagramUrls } }} selected={null} reveal solutionOpen /> : <MathText text={copy.questionText} fontSize={13} color={palette.mutedForeground} />}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: 0 },
  lead: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  rankRight: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  qTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  qHeading: { flex: 1, fontSize: 14, fontWeight: '800' },
  qRate: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  qCounts: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  options: { gap: 6, marginTop: 4 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionKey: { width: 30, fontSize: 13, fontWeight: '800' },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  optionCount: { width: 28, fontSize: 13, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  toggle: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  toggleText: { fontSize: 13, fontWeight: '700' },
});
