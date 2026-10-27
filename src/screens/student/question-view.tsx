import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Diagrams } from '@/components/diagrams';
import { Explanation } from '@/components/explanation';
import { Icon, usePalette } from '@/components/kit';
import { MathText } from '@/components/math-text';

const KEYS = ['A', 'B', 'C', 'D'] as const;

export interface QuestionLike {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answerType: string;
  diagramUrls?: string[];
  optionDiagramUrls?: { A: string[]; B: string[]; C: string[]; D: string[] };
  correctAnswer?: string;
  explanation?: string;
  explanationDiagramUrls?: string[];
}

/**
 * A question to answer or review: its text and figures, then options to tap
 * (or a box for a numerical answer). With `reveal`, the right answer is marked
 * and the solution shown. Marks are never shown by colour alone: a selected
 * option gets a check, and revealed options say "Your answer" / "Correct answer".
 */
export function QuestionView({
  question,
  selected,
  onSelect,
  reveal = false,
  numberLabel,
  solutionOpen = false,
  answerCorrect,
}: {
  question: QuestionLike;
  selected: string | null;
  /** Leave out to show the question read-only. */
  onSelect?: (value: string | null) => void;
  reveal?: boolean;
  numberLabel?: string;
  /** With `reveal`: show the solution open instead of behind its toggle. */
  solutionOpen?: boolean;
  /** With `reveal`: the server's verdict on the answer, when known (numerical answers are graded there). */
  answerCorrect?: boolean | null;
}) {
  const palette = usePalette();
  const numerical = question.answerType === 'Numerical';
  const key = (question.correctAnswer ?? '').trim().toUpperCase();
  const interactive = !!onSelect && !reveal;

  return (
    <View style={styles.wrap}>
      {numberLabel ? <Text style={[styles.number, { color: palette.primary }]}>{numberLabel}</Text> : null}
      <MathText text={question.questionText} fontSize={16} color={palette.foreground} />
      <Diagrams urls={question.diagramUrls} />

      {numerical ? (
        <NumericalAnswer question={question} selected={selected} onSelect={interactive ? onSelect : undefined} reveal={reveal} verdict={answerCorrect} />
      ) : (
        <View style={styles.options} accessibilityRole={interactive ? 'radiogroup' : undefined}>
          {KEYS.map((k) => {
            const text = question[`option${k}`];
            const figures = question.optionDiagramUrls?.[k] ?? [];
            if (!text && !figures.length) return null;
            const isSelected = selected === k;
            const isRight = reveal && key === k;
            const isWrong = reveal && isSelected && key !== k;
            const border = isRight ? palette.success : isWrong ? palette.danger : isSelected ? palette.primary : palette.border;
            const bg = isRight ? palette.successSoft : isWrong ? palette.dangerSoft : isSelected ? palette.primarySoft : palette.card;
            const filled = isSelected || isRight;
            const tag = isRight ? (isSelected ? 'Your answer · correct' : 'Correct answer') : isWrong ? 'Your answer' : null;
            const body = (
              <>
                <View style={[styles.key, { borderColor: border, backgroundColor: filled ? border : 'transparent' }]}>
                  <Text style={[styles.keyText, { color: filled ? palette.onPrimary : palette.foreground }]}>{k}</Text>
                </View>
                <View style={styles.optionBody}>
                  <MathText text={text} fontSize={15} color={palette.foreground} />
                  <Diagrams urls={figures} maxHeight={160} />
                  {tag ? <Text style={[styles.tag, { color: isRight ? palette.successInk : palette.dangerInk }]}>{tag}</Text> : null}
                </View>
                {isRight ? (
                  <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} color={palette.success} size={22} />
                ) : isWrong ? (
                  <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} color={palette.danger} size={22} />
                ) : isSelected ? (
                  <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.primary} size={18} />
                ) : null}
              </>
            );
            const style = [styles.option, { borderColor: border, backgroundColor: bg, borderWidth: isSelected || isRight ? 2 : 1 }];
            return interactive ? (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Option ${k}`}
                accessibilityHint={isSelected ? 'Tap again to clear your answer' : undefined}
                // Tapping the chosen option again clears it.
                onPress={() => onSelect(isSelected ? null : k)}
                style={({ pressed }) => [...style, pressed && styles.pressed]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={k} accessible accessibilityLabel={`Option ${k}${tag ? `, ${tag}` : ''}`} style={style}>
                {body}
              </View>
            );
          })}
        </View>
      )}

      {reveal && question.explanation ? (
        <Explanation
          text={question.explanation}
          correctAnswer={numerical ? undefined : question.correctAnswer}
          diagramUrls={question.explanationDiagramUrls}
          defaultCollapsed={!solutionOpen}
        />
      ) : null}
    </View>
  );
}

function NumericalAnswer({
  question,
  selected,
  onSelect,
  reveal,
  verdict,
}: {
  question: QuestionLike;
  selected: string | null;
  onSelect?: (value: string | null) => void;
  reveal: boolean;
  verdict?: boolean | null;
}) {
  const palette = usePalette();
  const answer = (question.correctAnswer ?? '').trim();
  const right = reveal && selected !== null && (typeof verdict === 'boolean' ? verdict : sameNumber(selected, answer));
  const wrong = reveal && selected !== null && !right;
  const border = right ? palette.success : wrong ? palette.danger : palette.border;
  return (
    <View style={styles.numerical}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>Your answer</Text>
      <TextInput
        value={selected ?? ''}
        onChangeText={(v) => onSelect?.(v.trim() ? v : null)}
        editable={!!onSelect}
        placeholder={onSelect ? 'Type a number' : 'Not answered'}
        placeholderTextColor={palette.mutedForeground}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Your answer"
        maxLength={20}
        style={[styles.input, { color: palette.foreground, borderColor: border, backgroundColor: palette.card, borderWidth: right || wrong ? 2 : 1.5 }]}
      />
      {reveal && answer ? (
        <View style={styles.numericalResult}>
          <Icon
            name={right ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'info.circle', android: 'info' }}
            color={right ? palette.success : palette.mutedForeground}
            size={16}
          />
          <Text style={[styles.label, { color: right ? palette.successInk : palette.foreground }]}>
            {right ? 'Correct' : `Correct answer: ${question.correctAnswer}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** "2", "2.0" and " 2 " are the same answer; text answers compare as written. */
function sameNumber(a: string, b: string) {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  return x === y || (Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && Number(x) === Number(y));
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  number: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, minHeight: 56 },
  optionBody: { flex: 1, gap: 6 },
  key: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 14, fontWeight: '800' },
  tag: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pressed: { opacity: 0.8 },
  numerical: { gap: 8 },
  numericalResult: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, minHeight: 50 },
});
