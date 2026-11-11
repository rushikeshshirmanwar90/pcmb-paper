import { Pressable, Text, View } from 'react-native';
import { usePalette } from '@/components/kit';
import type { Question } from '@/types/pcmb';
import { subjectCounts } from './pdf-subjects';

const noun = (count: number) => `${count} ${count === 1 ? 'Question' : 'Questions'}`;

/** A read-only summary of what the PDF will contain, with a way back to change the subjects or questions. */
export function SubjectReview({ questions, onEdit }: { questions: Question[]; onEdit: () => void }) {
  const palette = usePalette();
  const rows = subjectCounts(questions);
  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, padding: 12, gap: 6, borderWidth: 1, borderRadius: 14, borderColor: palette.border, backgroundColor: palette.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ color: palette.foreground, fontSize: 15, fontWeight: '700' }}>Subjects</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit subjects and questions" onPress={onEdit} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ color: palette.primaryInk, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      </View>
      {rows.map(row => <View key={row.subject} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: palette.foreground, flexShrink: 1 }}>{row.subject}</Text>
        <Text style={{ color: palette.mutedForeground }}>{noun(row.count)}</Text>
      </View>)}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: palette.border }}>
        <Text style={{ color: palette.foreground, fontWeight: '700' }}>Total</Text>
        <Text style={{ color: palette.foreground, fontWeight: '700' }}>{noun(questions.length)}</Text>
      </View>
    </View>
  );
}
