import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { SelectedQuestionRow } from './question-card';
import type { Question } from '@/types/pcmb';

export function SelectedReorderList({ questions, onMove }: {
  questions: Question[]; onMove: (from: number, to: number) => void;
}) {
  return <ReorderableList data={questions} keyExtractor={q => q._id} onReorder={({ from, to }) => onMove(from, to)}
    style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12 }}
    shouldUpdateActiveItem autoscrollThreshold={0.12}
    initialNumToRender={8} windowSize={7}
    renderItem={({ item, index }) => <ReorderRow question={item} index={index} count={questions.length} onMove={onMove} />} />;
}

function ReorderRow({ question, index, count, onMove }: {
  question: Question; index: number; count: number; onMove: (from: number, to: number) => void;
}) {
  const drag = useReorderableDrag();
  const active = useIsActive();
  return <SelectedQuestionRow question={question} index={index} count={count} drag={drag} active={active}
    onDetails={() => {}} onMove={offset => onMove(index, index + offset)} />;
}
