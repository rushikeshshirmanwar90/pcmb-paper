import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/components/kit';
import { chipsFor, subjectsLabel, subjectsOf } from '@/shared/subjects';

/**
 * A test's or paper's subjects as small chips ([Physics] [Chemistry] +1)
 * instead of one joined name that gets cut off. Takes the server's text
 * ("Physics, Chemistry") or a list. Read out as one label.
 */
export function SubjectChips({ subjects, max = 3 }: { subjects: string | string[] | null | undefined; max?: number }) {
  const palette = usePalette();
  const list = Array.isArray(subjects) ? subjects : subjectsOf(subjects);
  if (!list.length) return null;
  const { shown, more } = chipsFor(list, max);
  return (
    <View accessible accessibilityLabel={subjectsLabel(list)} style={styles.row}>
      {shown.map((s) => (
        <View key={s} style={[styles.chip, { backgroundColor: palette.violetSoft, borderColor: palette.violetBorder }]}>
          <Text style={[styles.text, { color: palette.violet }]} numberOfLines={1}>
            {s}
          </Text>
        </View>
      ))}
      {more ? <Text style={[styles.more, { color: palette.mutedForeground }]}>+{more}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, maxWidth: 160 },
  text: { fontSize: 12, fontWeight: '700' },
  more: { fontSize: 12, fontWeight: '700' },
});
