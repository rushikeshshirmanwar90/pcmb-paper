import { memo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyView, Icon, Muted, Notice, usePalette, type IconName } from '@/components/kit';
import { QuestionEditModal } from '@/components/create-exam-modal';
import { MARKS_PER_QUESTION, MAX_QUESTIONS, questionCount } from '@/screens/teacher/make-pdf/model';
import { QuestionPreview, questionMeta } from '@/screens/teacher/make-pdf/question-preview';
import { Footer } from '@/screens/teacher/make-pdf/ui';
import type { Question } from '@/types/pcmb';

const SmallButton = memo(function SmallButton({
  label,
  icon,
  onPress,
  disabled = false,
  tone = 'plain',
  accessibilityLabel,
}: {
  label?: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'danger';
  accessibilityLabel: string;
}) {
  const palette = usePalette();
  const color = tone === 'danger' ? palette.dangerInk : palette.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.small,
        { borderColor: tone === 'danger' ? palette.dangerBorder : palette.border, backgroundColor: tone === 'danger' ? palette.dangerSoft : palette.card },
        label ? styles.smallWide : null,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} color={color} size={16} />
      {label ? <Text style={[styles.smallText, { color }]}>{label}</Text> : null}
    </Pressable>
  );
});

const ReviewCard = memo(function ReviewCard({
  question,
  index,
  last,
  onMove,
  onRemove,
  onReplace,
  onEdit,
}: {
  question: Question;
  index: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onReplace: (question: Question) => void;
  onEdit: (question: Question) => void;
}) {
  const palette = usePalette();
  const n = index + 1;
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.number, { backgroundColor: palette.primarySoft }]}>
          <Text style={[styles.numberText, { color: palette.primaryInk }]}>Q{n}</Text>
        </View>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
          {questionMeta(question)}
        </Text>
      </View>
      <QuestionPreview question={question} />
      <View style={styles.actions}>
        <SmallButton accessibilityLabel={`Move question ${n} up`} icon={{ ios: 'arrow.up', android: 'arrow_upward' }} disabled={index === 0} onPress={() => onMove(index, index - 1)} />
        <SmallButton accessibilityLabel={`Move question ${n} down`} icon={{ ios: 'arrow.down', android: 'arrow_downward' }} disabled={last} onPress={() => onMove(index, index + 1)} />
        <SmallButton label="Replace" accessibilityLabel={`Replace question ${n}`} icon={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew' }} onPress={() => onReplace(question)} />
        <SmallButton label="Edit" accessibilityLabel={`Edit question ${n} for this PDF`} icon={{ ios: 'pencil', android: 'edit' }} onPress={() => onEdit(question)} />
        <View style={styles.spacer} />
        <SmallButton tone="danger" accessibilityLabel={`Remove question ${n}`} icon={{ ios: 'trash', android: 'delete' }} onPress={() => onRemove(question._id)} />
      </View>
    </View>
  );
});

/**
 * The questions chosen, whichever way they were chosen: read each one, take
 * it out, replace it with another, change its place, add more, or edit its
 * wording for this PDF (the question bank itself is never changed). Questions
 * keep their ids throughout. Answers aren't shown here.
 */
export function ReviewStep({
  selected,
  message,
  kindLabel,
  onMove,
  onRemove,
  onReplace,
  onEdit,
  onAdd,
  onNext,
  bottomInset,
}: {
  selected: Question[];
  /** Something the teacher should know, e.g. fewer questions were found than asked for. */
  message: { tone: 'warning' | 'info' | 'success'; text: string } | null;
  kindLabel: string;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onReplace: (question: Question) => void;
  onEdit: (question: Question) => void;
  onAdd: () => void;
  onNext: () => void;
  bottomInset: number;
}) {
  const palette = usePalette();
  const full = selected.length >= MAX_QUESTIONS;
  const [editing, setEditing] = useState<Question | null>(null);

  return (
    <>
      <FlatList
        data={selected}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <ReviewCard
            question={item}
            index={index}
            last={index === selected.length - 1}
            onMove={onMove}
            onRemove={onRemove}
            onReplace={onReplace}
            onEdit={setEditing}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
              Review your questions
            </Text>
            <Text accessibilityLiveRegion="polite" style={[styles.count, { color: palette.mutedForeground }]}>
              {questionCount(selected.length)} · {selected.length * MARKS_PER_QUESTION} marks at {MARKS_PER_QUESTION} each
            </Text>
            {message ? <Notice tone={message.tone} text={message.text} live /> : null}
            <Muted>Use the arrows to change the order. Edit changes a question&apos;s wording in this PDF only.</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyView
            icon={{ ios: 'doc.questionmark', android: 'quiz' }}
            title="No questions chosen"
            text="Add questions to make a PDF."
            action={<Button label="Add questions" onPress={onAdd} />}
          />
        }
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <Footer inset={bottomInset}>
        {full ? <Muted>A PDF holds up to {MAX_QUESTIONS} questions, so no more can be added.</Muted> : null}
        <Button label="Add questions" variant="secondary" icon={{ ios: 'plus', android: 'add' }} disabled={full} onPress={onAdd} />
        <Button label={`Next: ${kindLabel} settings`} icon={{ ios: 'arrow.right', android: 'arrow_forward' }} disabled={selected.length === 0} onPress={onNext} />
      </Footer>
      {editing ? (
        <QuestionEditModal
          question={editing}
          onSave={(updated) => {
            onEdit(updated);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { gap: 8, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800' },
  count: { fontSize: 14, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  numberText: { fontSize: 13, fontWeight: '800' },
  meta: { flex: 1, fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  spacer: { flex: 1 },
  small: { minHeight: 40, minWidth: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  smallWide: { paddingHorizontal: 12 },
  smallText: { fontSize: 13, fontWeight: '600' },
});
