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
 * and the solution shown.
 */
export function QuestionView({
  question,
  selected,
  onSelect,
  reveal = false,
  numberLabel,
}: {
  question: QuestionLike;
  selected: string | null;
  /** Leave out to show the question read-only. */
  onSelect?: (value: string | null) => void;
  reveal?: boolean;
  numberLabel?: string;
}) {
  const palette = usePalette();
  const numerical = question.answerType === 'Numerical';
  const key = (question.correctAnswer ?? '').trim().toUpperCase();

  return (
    <View style={styles.wrap}>
      {numberLabel ? <Text style={[styles.number, { color: palette.primary }]}>{numberLabel}</Text> : null}
      <MathText text={question.questionText} fontSize={16} color={palette.foreground} />
      <Diagrams urls={question.diagramUrls} />

      {numerical ? (
        <View style={styles.numerical}>
          <Text style={[styles.label, { color: palette.mutedForeground }]}>Your answer</Text>
          <TextInput
            value={selected ?? ''}
            onChangeText={(v) => onSelect?.(v.trim() ? v : null)}
            editable={!!onSelect && !reveal}
            placeholder="Type a number"
            placeholderTextColor={palette.mutedForeground}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Your answer"
            maxLength={20}
            style={[styles.input, { color: palette.foreground, borderColor: palette.border, backgroundColor: palette.background }]}
          />
          {reveal && key ? (
            <Text style={[styles.label, { color: palette.successInk }]}>Correct answer: {question.correctAnswer}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.options}>
          {KEYS.map((k) => {
            const text = question[`option${k}`];
            const figures = question.optionDiagramUrls?.[k] ?? [];
            if (!text && !figures.length) return null;
            const isSelected = selected === k;
            const isRight = reveal && key === k;
            const isWrong = reveal && isSelected && key !== k;
            const border = isRight ? palette.success : isWrong ? palette.danger : isSelected ? palette.primary : palette.border;
            const bg = isRight ? palette.successSoft : isWrong ? palette.dangerSoft : isSelected ? palette.primarySoft : palette.card;
            const body = (
              <>
                <View style={[styles.key, { borderColor: border, backgroundColor: isSelected || isRight ? border : 'transparent' }]}>
                  <Text style={[styles.keyText, { color: isSelected || isRight ? palette.onPrimary : palette.foreground }]}>{k}</Text>
                </View>
                <View style={styles.optionBody}>
                  <MathText text={text} fontSize={15} color={palette.foreground} />
                  <Diagrams urls={figures} maxHeight={160} />
                </View>
                {isRight ? <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} color={palette.success} size={20} /> : null}
                {isWrong ? <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} color={palette.danger} size={20} /> : null}
              </>
            );
            return onSelect && !reveal ? (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Option ${k}`}
                // Tapping the chosen option again clears it.
                onPress={() => onSelect(isSelected ? null : k)}
                style={({ pressed }) => [styles.option, { borderColor: border, backgroundColor: bg }, pressed && styles.pressed]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={k} style={[styles.option, { borderColor: border, backgroundColor: bg }]}>
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
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  number: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 12, padding: 12, minHeight: 52 },
  optionBody: { flex: 1, gap: 6 },
  key: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  numerical: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
});
