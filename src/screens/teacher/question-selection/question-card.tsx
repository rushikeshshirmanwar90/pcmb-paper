import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, usePalette } from '@/components/kit';
import { MathText } from '@/components/math-text';
import { QuestionPreview, questionMeta } from '@/screens/teacher/make-pdf/question-preview';
import { answerOf } from './answer';
import type { Question } from '@/types/pcmb';
import type { MenuAnchor } from './action-menu';

export const SelectionCard = memo(function SelectionCard({ question, picked, disabled, onToggle, onDetails }: {
  question: Question; picked: boolean; disabled: boolean;
  onToggle: (question: Question) => void; onDetails: (question: Question) => void;
}) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.card, borderColor: picked ? p.primary : p.border }]}>
    <View style={styles.top}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: picked, disabled }}
        accessibilityLabel={`${picked ? 'Remove' : 'Select'} question ${question.questionNumber}`}
        disabled={disabled} onPress={() => onToggle(question)} style={styles.touch}>
        <View style={[styles.checkbox, { borderColor: picked ? p.primary : p.borderStrong, backgroundColor: picked ? p.primary : p.card }]}>
          {picked ? <Icon name={{ ios: 'checkmark', android: 'check' }} color={p.onPrimary} size={16} /> : null}
        </View>
      </Pressable>
      <Text numberOfLines={2} style={[styles.meta, { color: p.mutedForeground }]}>{questionMeta(question)}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Question Details: question ${question.questionNumber}`}
      onPress={() => onDetails(question)} style={styles.content}>
      <QuestionPreview question={question} showAnswers />
    </Pressable>
  </View>;
});

/** Identical compact review row for every subject; actions stay behind the menu. */
export const SelectedQuestionRow = memo(function SelectedQuestionRow({ question, index, onDetails, onMenu, drag, active, onMove, count }: {
  question: Question; index: number; onDetails: (question: Question) => void;
  onMenu?: (question: Question, anchor: MenuAnchor) => void;
  drag?: () => void; active?: boolean; onMove?: (offset: number) => void; count?: number;
}) {
  const p = usePalette();
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const answer = answerOf(question);
  return <View style={[styles.row, { borderBottomColor: p.border, backgroundColor: active ? p.primarySoft : p.background }]}>
    <Text style={{ color: p.mutedForeground, paddingTop: 12 }}>{index + 1}.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Question ${index + 1}, View Details`}
      disabled={!!drag} onPress={() => onDetails(question)} style={styles.summary}>
      <View style={{ maxHeight: 60, overflow: 'hidden' }}><MathText text={question.questionText} fontSize={14} color={p.foreground} /></View>
      <MathText text={answer.summary} fontSize={13} color={answer.summary === 'Answer unavailable' ? p.mutedForeground : p.successInk} />
      <Text numberOfLines={1} style={[styles.meta, { color: p.mutedForeground }]}>{questionMeta(question)}</Text>
    </Pressable>
    {drag ? <Pressable accessibilityRole="adjustable" accessibilityLabel={`Reorder question ${index + 1}`}
      accessibilityHint="Hold and drag to reorder, or use Move Up and Move Down accessibility actions."
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityActions={[...(index > 0 ? [{ name: 'decrement', label: 'Move Up' }] : []),
        ...(index < (count ?? 0) - 1 ? [{ name: 'increment', label: 'Move Down' }] : [])]}
      onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'decrement') onMove?.(-1); else if (e.nativeEvent.actionName === 'increment') onMove?.(1); }}
      delayLongPress={250} onLongPress={drag} style={styles.touch}>
      <Icon name={{ ios: 'line.3.horizontal', android: 'drag_handle' }} color={p.foreground} size={22} />
    </Pressable> : <Pressable ref={anchor} accessibilityRole="button" accessibilityLabel={`Actions for question ${index + 1}`}
      onPress={() => anchor.current?.measureInWindow((x, y, width, height) => onMenu?.(question, { x, y, width, height }))} style={styles.touch}>
      <Icon name={{ ios: 'ellipsis', android: 'more_vert' }} color={p.foreground} size={20} />
    </Pressable>}
  </View>;
});

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 8, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  touch: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 24, height: 24, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 4, paddingBottom: 4 },
  meta: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderBottomWidth: 1 },
  summary: { flex: 1, minWidth: 0, paddingVertical: 12, gap: 4 },
});
