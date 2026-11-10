import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Icon, SectionTitle, useLoad, usePalette, type IconName } from '@/components/kit';
import { programOf, programSubjects, questionBankOf, type SchoolStandard } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useTabDataVersion } from '@/context/data-version';
import { loadLastPractised } from '@/screens/student/practice/practice-links';
import { summaryLine } from '@/screens/student/self-assessment';
import { SelfAssessmentFlow } from '@/screens/student/self-assessment-flow';
import { TopicPracticeSheet } from '@/screens/student/topic-practice-sheet';
import { ALL_CHAPTER_QUESTIONS, statsAt, type PracticeNode } from '@/screens/student/topic-practice';
import { studentApi, type AssessmentSummary } from '@/services/student-api';

// "Continue where you left off" (Zeigarnik): one card, the most useful
// unfinished thing. An unfinished self-assessment comes first (its clock may be
// running); otherwise the topic practised last, while it still has questions
// left. One tap opens it straight away. Nothing shows when there's nothing to
// continue, or for programs without a question bank.

type Item = { kind: 'assessment'; a: AssessmentSummary } | { kind: 'topic'; node: PracticeNode; answered: number; questions: number };

export function ContinueCard({ title = 'Continue' }: { title?: string }) {
  const palette = usePalette();
  const user = useSignedInUser();
  const program = programOf(user);
  const hasBank = questionBankOf(program) !== null;
  const version = useTabDataVersion('practice');
  const assessments = useLoad(() => studentApi.assessments(), [version], { enabled: hasBank, cacheKey: 'self-assessments' });
  const last = useLoad(() => loadLastPractised(user.id), [user.id, version], { enabled: hasBank });
  const lastPlace = last.data && programSubjects(program).includes(last.data.subject) ? last.data : null;
  const tree = useLoad(() => (lastPlace ? studentApi.practiceTree(lastPlace.subject) : Promise.resolve(null)), [lastPlace?.subject, version], {
    enabled: hasBank && !!lastPlace,
    cacheKey: lastPlace ? `practice-tree:${lastPlace.subject}` : undefined,
  });
  const [open, setOpen] = useState<Item | null>(null);

  const unfinished = (assessments.data ?? []).find((a) => a.state === 'in-progress') ?? null;
  let item: Item | null = unfinished ? { kind: 'assessment', a: unfinished } : null;
  if (!item && lastPlace && tree.data?.subject === lastPlace.subject) {
    const stats = statsAt(tree.data.chapters, lastPlace);
    if (stats && stats.questions > 0 && stats.remaining > 0) {
      item = {
        kind: 'topic',
        node: { subject: lastPlace.subject, standard: lastPlace.standard as SchoolStandard, chapter: lastPlace.chapter, topic: lastPlace.topic },
        answered: stats.answered,
        questions: stats.questions,
      };
    }
  }
  if (!hasBank || (!item && !open)) return null;

  const icon: IconName = item?.kind === 'assessment' ? { ios: 'pause.circle', android: 'pause_circle' } : { ios: 'book', android: 'menu_book' };
  const name = item ? (item.kind === 'assessment' ? item.a.title : item.node.topic ?? `${item.node.chapter} · ${ALL_CHAPTER_QUESTIONS}`) : '';
  const meta = item
    ? item.kind === 'assessment'
      ? `Self-assessment · ${summaryLine(item.a)}`
      : `${item.node.subject}${item.node.topic ? ` · ${item.node.chapter}` : ''} · ${item.answered} of ${item.questions} done`
    : '';

  return (
    <>
      {item ? (
        <>
          <SectionTitle title={title} />
          <Card style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continue ${name}. ${meta}`}
              onPress={() => setOpen(item)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.muted }]}
            >
              <View style={[styles.tile, { backgroundColor: palette.primarySoft }]}>
                <Icon name={icon} color={palette.primary} size={20} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: palette.foreground }]} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
                  {meta}
                </Text>
              </View>
              <Text style={[styles.action, { color: palette.primaryInk }]}>Continue</Text>
              <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
            </Pressable>
          </Card>
        </>
      ) : null}
      {open?.kind === 'topic' ? (
        <TopicPracticeSheet
          node={open.node}
          mode="continue"
          onClose={(changed) => {
            setOpen(null);
            if (changed) bumpDataVersion();
          }}
        />
      ) : null}
      {open?.kind === 'assessment' ? <SelfAssessmentFlow subject={open.a.subject} start={{ kind: 'session', id: open.a.id }} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  action: { fontSize: 15, fontWeight: '700' },
});
