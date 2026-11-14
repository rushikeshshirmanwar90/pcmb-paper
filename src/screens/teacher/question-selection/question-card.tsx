import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, usePalette } from '@/components/kit';
import { MathText } from '@/components/math-text';
import { QuestionPreview, questionMeta } from '@/screens/teacher/make-pdf/question-preview';
import { answerOf } from './answer';
import type { Question } from '@/types/pcmb';
import type { MenuAnchor } from './action-menu';

/** A question's level, as teachers say it: Easy, Medium or Difficult (null when the bank has none). */
export function levelOf(question: Pick<Question, 'difficulty'>): 'Easy' | 'Medium' | 'Difficult' | null {
  const v = String(question.difficulty ?? '').trim().toLowerCase();
  if (!v) return null;
  return v === 'easy' ? 'Easy' : v === 'hard' || v === 'difficult' ? 'Difficult' : 'Medium';
}

/** A small tag with the question's level. */
export function LevelTag({ question }: { question: Pick<Question, 'difficulty'> }) {
  const p = usePalette();
  const level = levelOf(question);
  if (!level) return null;
  const [bg, fg] = level === 'Easy' ? [p.successSoft, p.successInk] : level === 'Difficult' ? [p.dangerSoft, p.dangerInk] : [p.warningSoft, p.warningInk];
  return <View accessible accessibilityLabel={`Level: ${level}`} style={[styles.tag, { backgroundColor: bg }]}>
    <Text style={[styles.tagText, { color: fg }]}>{level}</Text>
  </View>;
}

/** Marks a question the teacher changed for this paper or test. */
export function EditedTag({ question }: { question: Pick<Question, 'edited'> }) {
  const p = usePalette();
  if (!question.edited) return null;
  return <View accessible accessibilityLabel="Edited for this paper" style={[styles.tag, { backgroundColor: p.violetSoft }]}>
    <Text style={[styles.tagText, { color: p.violet }]}>Edited</Text>
  </View>;
}

/**
 * A visible, labelled Edit button, so changing a question never depends on
 * knowing that its text can be tapped: icon plus word, a 44pt target, and the
 * question's number for screen readers.
 */
export function EditButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Change the question, its options or its correct answer, for this paper or test only"
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed }) => [styles.edit, { backgroundColor: p.primarySoft, borderColor: p.primaryBorder, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Icon name={{ ios: 'pencil', android: 'edit' }} color={p.primaryInk} size={15} />
    <Text style={[styles.editText, { color: p.primaryInk }]}>Edit</Text>
  </Pressable>;
}

export const SelectionCard = memo(function SelectionCard({ question, picked, disabled, onToggle, onDetails, onEdit, editDisabled }: {
  question: Question; picked: boolean; disabled: boolean;
  onToggle: (question: Question) => void; onDetails: (question: Question) => void;
  /** Shows the Edit button; left out while replacing a question. */
  onEdit?: (question: Question) => void; editDisabled?: boolean;
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
      <Text numberOfLines={2} style={[styles.meta, styles.flex, { color: p.mutedForeground }]}>{questionMeta(question)}</Text>
      <EditedTag question={question} />
      <LevelTag question={question} />
    </View>
    {/* The question itself is just read here: tapping it opens nothing. Details and Edit have their own buttons. */}
    <View style={styles.content}>
      <QuestionPreview question={question} showAnswers />
    </View>
    {onEdit ? <View style={[styles.actions, { borderTopColor: p.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View details of question ${question.questionNumber}`} onPress={() => onDetails(question)} hitSlop={4}
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
        <Text style={[styles.linkText, { color: p.mutedForeground }]}>Details & solution</Text>
      </Pressable>
      <EditButton label={`Edit question ${question.questionNumber}`} disabled={editDisabled} onPress={() => onEdit(question)} />
    </View> : null}
  </View>;
});

/** Identical compact review row for every subject; actions stay behind the menu. */
export const SelectedQuestionRow = memo(function SelectedQuestionRow({ question, index, onDetails, onMenu, onEdit, editDisabled, drag, active, onMove, count }: {
  question: Question; index: number; onDetails: (question: Question) => void;
  onEdit?: (question: Question) => void; editDisabled?: boolean;
  onMenu?: (question: Question, anchor: MenuAnchor) => void;
  drag?: () => void; active?: boolean; onMove?: (offset: number) => void; count?: number;
}) {
  const p = usePalette();
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const answer = answerOf(question);
  return <View style={[styles.row, { borderBottomColor: p.border, backgroundColor: active ? p.primarySoft : p.background }]}>
    <Text style={{ color: p.mutedForeground, paddingTop: 12 }}>{index + 1}.</Text>
    <View style={styles.summary}>
      <View style={{ maxHeight: 60, overflow: 'hidden' }}><MathText text={question.questionText} fontSize={14} color={p.foreground} /></View>
      <MathText text={answer.summary} fontSize={13} color={answer.summary === 'Answer unavailable' ? p.mutedForeground : p.successInk} />
      <View style={styles.metaRow}>
        <EditedTag question={question} />
        <LevelTag question={question} />
        <Text numberOfLines={1} style={[styles.meta, styles.flex, { color: p.mutedForeground }]}>{questionMeta(question)}</Text>
      </View>
      {onEdit && !drag ? <View style={styles.rowEdit}><EditButton label={`Edit question ${index + 1}`} disabled={editDisabled} onPress={() => onEdit(question)} /></View> : null}
    </View>
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
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 8, paddingHorizontal: 4 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '600' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
  editText: { fontSize: 14, fontWeight: '700' },
  rowEdit: { flexDirection: 'row', marginTop: 4 },
});
