import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, ErrorView, Icon, ListRow, LoadingView, Muted, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { SearchBox } from '@/screens/tuition/admin-ui';
import { schoolApi } from '@/services/school-api';

export function AudiencePicker({ batchIds, subject, mode, onMode, selected, onChange, onReady }: {
  batchIds: string[]; subject: string; mode: 'all' | 'selected'; onMode: (v: 'all' | 'selected') => void;
  selected: string[]; onChange: (v: string[]) => void; onReady: (v: boolean) => void;
}) {
  const palette = usePalette();
  const key = [...batchIds].sort().join(',');
  const { data, loading, error, reload } = useLoad(() => schoolApi.testAudience(key.split(','), subject), [key, subject]);
  const [query, setQuery] = useState('');
  useEffect(() => { onReady(!!data && !loading && !error); }, [data, loading, error, onReady]);
  const students = data?.students ?? [];
  const shown = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  return <>
    <SectionTitle title="Who can take this test?" />
    <View accessibilityRole="radiogroup" accessibilityLabel="Test audience" style={styles.choices}>{(['all', 'selected'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} onPress={() => onMode(value)} style={({ pressed }) => [styles.choice, { backgroundColor: mode === value ? palette.primarySoft : palette.card, borderColor: mode === value ? palette.primary : palette.border, opacity: pressed ? 0.75 : 1 }]}>
      <Icon name={mode === value ? { ios: 'largecircle.fill.circle', android: 'radio_button_checked' } : { ios: 'circle', android: 'radio_button_unchecked' }} color={mode === value ? palette.primary : palette.mutedForeground} size={22} />
      <Text style={[styles.title, { color: palette.foreground }]}>{value === 'all' ? 'All students in selected batches' : 'Selected students only'}</Text>
    </Pressable>)}</View>
    <Muted>{mode === 'all' ? 'All eligible students can take this test. You can restrict individual students.' : 'Choose which students can take this test. Others can request access.'}</Muted>
    {loading ? <LoadingView /> : error ? <ErrorView message={error} onRetry={reload} /> : <>
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search students" label="Search eligible students" />
      <SectionTitle title={mode === 'all' ? 'Restrict individual students' : 'Choose students'} />
      <Muted>{mode === 'all' ? 'Tick students who should not be allowed to start.' : 'Tick students who should be allowed to start.'}</Muted>
      {shown.length ? <StudentSelectionList students={shown} selected={selected} onChange={onChange} /> : students.length ? <Muted>No students match your search.</Muted> : null}
      <Muted>{students.length ? `${selected.length} ${mode === 'all' ? 'restricted' : 'selected'}` : 'No activated students enrolled in these batches.'}</Muted>
    </>}
  </>;
}


/** Checkbox rows preserve selections hidden by the current search. */
export function StudentSelectionList({ students, selected, onChange, disabled = false }: {
  students: { id: string; name: string; subtitle?: string; disabled?: boolean }[];
  selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const palette = usePalette();
  return <Card style={styles.list}>{students.map((student, index) => {
    const checked = selected.includes(student.id);
    return <Pressable key={student.id} accessibilityRole="checkbox" accessibilityLabel={student.name} accessibilityState={{ checked, disabled: disabled || student.disabled }} disabled={disabled || student.disabled} onPress={() => onChange(checked ? selected.filter(id => id !== student.id) : [...selected, student.id])}>
      <ListRow title={student.name} subtitle={student.subtitle} last={index === students.length - 1} right={<Icon name={checked ? { ios: 'checkmark.square.fill', android: 'check_box' } : { ios: 'square', android: 'check_box_outline_blank' }} color={checked ? palette.primary : palette.mutedForeground} size={24} />} />
    </Pressable>;
  })}</Card>;
}
const styles = StyleSheet.create({
  list: { paddingVertical: 0 }, choices: { gap: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: 1, borderRadius: 12 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
});
