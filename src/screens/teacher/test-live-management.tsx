import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionTitle, usePalette } from '@/components/kit';
import { SearchBox } from '@/screens/tuition/admin-ui';
import { availableParticipationGroups, participationCounts, type ParticipationGroup } from './test-management';
import type { TestMonitor } from '@/services/school-api';

/** Presentation only: the page owns selection, search, actions and the existing poller. */
export function TestLiveManagement({ monitor, group, onGroup, query, onQuery }: {
  monitor: TestMonitor; group: ParticipationGroup; onGroup: (value: ParticipationGroup) => void;
  query: string; onQuery: (value: string) => void;
}) {
  const palette = usePalette();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Partial<Record<ParticipationGroup, { x: number; width: number }>>>({});
  const viewport = useRef(0);
  const offset = useRef(0);
  const counts = participationCounts(monitor);
  return <>
    <SectionTitle title="Student Participation" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={scroll} style={styles.scroll}
      onLayout={event => { viewport.current = event.nativeEvent.layout.width; }}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16}>
      <View accessibilityRole="tablist" accessibilityLabel="Student participation" style={styles.row}>
        {availableParticipationGroups(monitor).map(item => {
          const selected = item.key === group;
          return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }}
            accessibilityLabel={`${item.label}, ${counts[item.key]}`}
            onLayout={event => { positions.current[item.key] = event.nativeEvent.layout; }}
            onPress={() => {
              onGroup(item.key);
              const position = positions.current[item.key];
              if (position) {
                const x = position.x < offset.current ? position.x : position.x + position.width > offset.current + viewport.current ? position.x + position.width - viewport.current : offset.current;
                scroll.current?.scrollTo({ x, animated: true });
              }
            }}
            style={({ pressed }) => [styles.chip, { backgroundColor: selected ? palette.primarySoft : palette.card, borderColor: selected ? palette.primary : palette.border }, pressed && { opacity: 0.8 }]}>
            <Text style={[styles.label, { color: selected ? palette.primaryInk : palette.foreground, fontWeight: selected ? '700' : '500' }]}>{item.label} ({counts[item.key]})</Text>
          </Pressable>;
        })}
      </View>
    </ScrollView>
    <SearchBox label="Search students" placeholder="Search students" value={query} onChangeText={onQuery} />
  </>;
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { flexShrink: 0, minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.2 },
  label: { flexShrink: 0, fontSize: 14 },
});

