import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, DetailSheet, ErrorText, Field, Icon, Muted, Notice, usePalette } from '@/components/kit';
import { confirmAction } from '@/components/confirm-action';
import { SpringPressable } from '@/components/spring-pressable';
import { haptic } from '@/design/haptics';
import { QuestionPreview } from '@/screens/teacher/make-pdf/question-preview';
import type { Question } from '@/types/pcmb';
import { applyEdit, draftOf, editProblem, isChanged, OPTION_KEYS, type OptionKey, type QuestionDraft } from './question-edit';

/**
 * Edit a question's text, options and correct answer for this paper or test only.
 * The shared question bank is never changed; the edited copy is what the PDF
 * prints and what the test's students see. Figures stay as they are.
 */
export function QuestionEditor({ question, picked, onSave, onClose }: {
  question: Question;
  /** Already in the selection: Save changes it in place; otherwise Save also selects it. */
  picked: boolean;
  onSave: (edited: Question) => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const [draft, setDraft] = useState<QuestionDraft>(() => draftOf(question));
  const [showProblem, setShowProblem] = useState(false);
  const numerical = question.answerType === 'Numerical';
  const problem = editProblem(question, draft);
  const changed = isChanged(question, draft);
  const set = (patch: Partial<QuestionDraft>) => { setDraft((d) => ({ ...d, ...patch })); setShowProblem(false); };
  const chosen = new Set((draft.correctAnswer.toUpperCase().match(/[ABCD]/g) ?? []) as OptionKey[]);

  const close = () => {
    if (changed) confirmAction('Discard your changes?', 'The question will stay as it was.', 'Discard', onClose);
    else onClose();
  };
  const save = () => {
    if (problem) { setShowProblem(true); haptic.warning(); return; }
    haptic.success();
    onSave(applyEdit(question, draft));
  };
  // What the paper or test will show, as the draft reads now.
  const preview: Question = { ...question, ...draft, answerType: question.answerType };

  return <DetailSheet visible title="Edit question" onClose={close} footer={<View style={{ gap: 8 }}>
    {showProblem ? <ErrorText message={problem} /> : null}
    <Button label={picked ? 'Save changes' : 'Save and select'} disabled={!changed && picked} onPress={save} />
    <Button label="Cancel" variant="secondary" onPress={close} />
  </View>}>
    <Notice text={`Changes apply to this ${picked ? 'selection' : 'paper or test'} only. The shared question bank is not changed.`} />
    <Field label="Question" value={draft.questionText} onChangeText={(questionText) => set({ questionText })}
      multiline numberOfLines={5} textAlignVertical="top" style={styles.multiline} maxLength={20000}
      hint="Write maths between $ signs, like $x^2 + 1$." autoCapitalize="sentences" />
    {numerical ? <Field label="Correct answer" value={draft.correctAnswer} onChangeText={(correctAnswer) => set({ correctAnswer })}
      maxLength={100} placeholder="e.g. 12.5" returnKeyType="done" /> : <>
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>Options</Text>
        <Muted>Tap a letter to make it the correct answer.</Muted>
        {OPTION_KEYS.map((key) => {
          const correct = chosen.has(key);
          return <View key={key} style={styles.optionRow}>
            <SpringPressable accessibilityRole="radio" accessibilityState={{ checked: correct }} accessibilityLabel={`Option ${key}${correct ? ', correct answer' : ', tap to make this the correct answer'}`}
              pressedScale={0.92} onPress={() => { if (!correct || chosen.size > 1) { haptic.select(); set({ correctAnswer: key }); } }}
              style={[styles.badge, { backgroundColor: correct ? palette.success : palette.card, borderColor: correct ? palette.success : palette.borderStrong }]}>
              {correct ? <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.onPrimary} size={18} />
                : <Text style={[styles.badgeText, { color: palette.foreground }]}>{key}</Text>}
            </SpringPressable>
            <View style={{ flex: 1 }}>
              <Field label={`Option ${key}`} value={draft[`option${key}` as const]} onChangeText={(text) => set({ [`option${key}`]: text } as Partial<QuestionDraft>)}
                multiline textAlignVertical="top" maxLength={5000} />
            </View>
          </View>;
        })}
      </View>
      {chosen.size > 1 ? <Muted>This question has more than one correct answer ({[...chosen].join(', ')}). Tap a letter to keep only that one.</Muted> : null}
    </>}
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.foreground }]}>How it will look</Text>
      <View style={[styles.previewBox, { borderColor: palette.border, backgroundColor: palette.card }]}>
        <QuestionPreview question={preview} showAnswers />
      </View>
    </View>
  </DetailSheet>;
}

const styles = StyleSheet.create({
  multiline: { minHeight: 120 },
  heading: { fontSize: 16, fontWeight: '700', letterSpacing: -0.15 },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  badgeText: { fontSize: 16, fontWeight: '700' },
  previewBox: { borderWidth: 1, borderRadius: 14, padding: 12 },
});
