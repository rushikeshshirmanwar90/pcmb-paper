import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Chips, DetailSheet, EmptyView, ErrorText, ErrorView, ListRow, LoadingView, Muted, ProgressBar, Screen, useLoad, usePalette } from '@/components/kit';
import { SUBJECTS_BY_TRACK, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { QuestionView } from '@/screens/student/question-view';
import { studentApi, type PyqQuestion } from '@/services/student-api';

const ALL = '__all__';

/** Past-year questions: pick a subject and chapter, then practise one at a time. */
export function StudentPyqScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const subjects = SUBJECTS_BY_TRACK[user.track ?? 'General'];
  const [subject, setSubject] = useState<SchoolSubject>(subjects[0]);
  const [practising, setPractising] = useState<string | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.pyqChapters(subject), [subject, version]);

  return (
    <Screen title="PYQs" subtitle="Practise past-year exam questions" onRefresh={refresh} refreshing={refreshing}>
      <Chips choices={subjects} selected={subject} onChange={setSubject} />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.chapters.length ? (
        <Card>
          <EmptyView icon={{ ios: 'clock.arrow.circlepath', android: 'history' }} title="No past-year questions yet" text={`There are no ${subject} past-year questions for your exam in the question bank yet.`} />
        </Card>
      ) : (
        <>
          <Button label={`Practise all ${data.total} ${subject} PYQs`} icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={() => setPractising(ALL)} />
          <Card style={styles.listCard}>
            {data.chapters.map((c, i) => (
              <View key={`${c.standard}|${c.chapter}`}>
                <ListRow
                  title={c.chapter}
                  subtitle={`${c.standard} · ${c.questions} questions · ${c.practised ? `${c.practised} done, ${c.correct} right` : 'not started'}`}
                  onPress={() => setPractising(c.chapter)}
                  last={i === data.chapters.length - 1}
                />
              </View>
            ))}
          </Card>
          <Muted>AI-made questions based on PYQs are coming later.</Muted>
        </>
      )}
      {practising ? (
        <PracticeSheet subject={subject} chapter={practising === ALL ? null : practising} onClose={() => { setPractising(null); bumpDataVersion(); }} />
      ) : null}
    </Screen>
  );
}

function PracticeSheet({ subject, chapter, onClose }: { subject: SchoolSubject; chapter: string | null; onClose: () => void }) {
  const palette = usePalette();
  const [skip, setSkip] = useState(0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, { correct: boolean; selected: string }>>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(() => studentApi.pyq(subject, chapter, skip), [subject, chapter, skip]);

  const q: PyqQuestion | undefined = data?.questions[index];
  const done = q ? checked[q._id] : undefined;

  const check = async () => {
    if (!q || !selected) return setCheckError(q?.answerType === 'Numerical' ? 'Enter your answer.' : 'Pick an option.');
    setChecking(true);
    setCheckError(null);
    try {
      const r = await studentApi.answerPyq(q._id, selected);
      setChecked((prev) => ({ ...prev, [q._id]: { correct: r.correct, selected: r.selected } }));
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Couldn't check that.");
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    setSelected(null);
    setCheckError(null);
    if (data && index < data.questions.length - 1) setIndex((i) => i + 1);
    else if (data?.nextSkip !== null && data?.nextSkip !== undefined) {
      setIndex(0);
      setSkip(data.nextSkip);
    }
  };

  const position = skip + index + 1;
  const score = Object.values(checked);
  const right = score.filter((s) => s.correct).length;
  const atEnd = !!data && index >= data.questions.length - 1 && data.nextSkip === null;

  return (
    <DetailSheet
      visible
      title={chapter ?? `${subject} PYQs`}
      onClose={onClose}
      footer={
        q ? (
          <>
            <ErrorText message={checkError} />
            {done ? (
              <Button label={atEnd ? 'Finish' : 'Next question'} onPress={atEnd ? onClose : next} />
            ) : (
              <View style={styles.row}>
                <Button label="Skip" variant="secondary" onPress={next} disabled={atEnd} style={styles.flex} />
                <Button label="Check answer" onPress={check} loading={checking} disabled={!selected} style={styles.flex2} />
              </View>
            )}
          </>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !q ? (
        <Muted>No questions here.</Muted>
      ) : (
        <>
          <View style={styles.top}>
            <Text style={[styles.count, { color: palette.mutedForeground }]}>
              {position} of {data!.total}
            </Text>
            {score.length ? <Badge label={`${right}/${score.length} right this session`} tone="primary" /> : null}
          </View>
          <ProgressBar value={(position / data!.total) * 100} />
          <View style={styles.badges}>
            {q.source ? <Badge label={q.source} tone="violet" /> : null}
            {q.mine && !done ? <Badge label={q.mine.correct ? 'You got this right before' : 'You got this wrong before'} tone={q.mine.correct ? 'success' : 'warning'} /> : null}
          </View>
          <Card>
            <QuestionView
              question={q}
              selected={done ? done.selected : selected}
              onSelect={done ? undefined : setSelected}
              reveal={!!done}
              numberLabel={q.topic ? `${q.chapter} · ${q.topic}` : q.chapter}
            />
          </Card>
          {done ? (
            <Text style={[styles.verdict, { color: done.correct ? palette.successInk : palette.dangerInk }]}>
              {done.correct ? 'Correct!' : `Not quite — the answer is ${q.correctAnswer}.`}
            </Text>
          ) : null}
        </>
      )}
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  verdict: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
