import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Diagrams } from '@/components/diagrams';
import { MathText } from '@/components/math-text';
import { usePalette } from '@/components/kit';
import type { Question } from '@/types/pcmb';
import { answerOf } from '@/screens/teacher/question-selection/answer';

const LEVEL_NAMES: Record<string, string> = { Easy: 'Easy', Mid: 'Medium', Hard: 'Hard' };

/** "Kinematics · Velocity · Medium · JEE MAIN 2020": where a question sits, without its answer. */
export const questionMeta = (question: Question) =>
  [question.chapter, question.topic, LEVEL_NAMES[question.difficulty] ?? question.difficulty, question.source].filter(Boolean).join(' · ');

/**
 * A question as it will read in the PDF: its text and figures, then its options.
 * Answers stay hidden by default. Teacher selection can opt into stored answer
 * highlights; worked solutions are shown separately in Question Details.
 */
export const QuestionPreview = memo(function QuestionPreview({ question, showAnswers = false }: { question: Question; showAnswers?: boolean }) {
  const palette = usePalette();
  const answer = showAnswers ? answerOf(question) : null;
  const options = (['A', 'B', 'C', 'D'] as const).map((key) => [key, question[`option${key}` as const]] as const);
  return (
    <View style={styles.wrap}>
      <MathText text={question.questionText} fontSize={14} color={palette.foreground} />
      <Diagrams urls={question.diagramUrls} maxHeight={180} />
      {question.answerType === 'Numerical' ? (
        <Text style={[styles.note, { color: palette.mutedForeground }]}>Numerical question: the answer is a value.</Text>
      ) : (
        <View style={styles.options}>
          {options.map(([key, text]) => {
            const figures = question.optionDiagramUrls?.[key];
            if (!text && !figures?.length) return null;
            return (
              <View key={key} style={[styles.option, { backgroundColor: answer?.options.includes(key) ? palette.successSoft : palette.background, borderColor: answer?.options.includes(key) ? palette.successBorder : palette.border }]}>
                <Text accessibilityLabel={answer?.options.includes(key) ? `${key}, correct option` : key} style={[styles.key, { color: answer?.options.includes(key) ? palette.successInk : palette.mutedForeground }]}>{key}.</Text>
                <View style={styles.optionBody}>
                  <MathText text={text} fontSize={13} color={palette.foreground} />
                  <Diagrams urls={figures} maxHeight={100} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      {answer ? <MathText text={answer.summary} fontSize={13} color={answer.summary === 'Answer unavailable' ? palette.mutedForeground : palette.successInk} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  note: { fontSize: 12, fontStyle: 'italic' },
  options: { gap: 6 },
  option: { flexDirection: 'row', gap: 8, padding: 8, borderWidth: 1, borderRadius: 8 },
  key: { fontSize: 12, fontWeight: '700', minWidth: 16, marginTop: 1 },
  optionBody: { flex: 1, minWidth: 0 },
});
