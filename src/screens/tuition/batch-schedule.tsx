import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Muted, usePalette } from '@/components/kit';
import { DAY_NAMES, label12, sortClasses, WEEK } from './timetable-draft';
import type { TimetableEntry } from '@/services/school-api';

/** Admin-only batch view; shared student and teacher timetables stay unchanged. */
export function BatchSchedule({ entries }: { entries: TimetableEntry[] }) {
  const palette = usePalette();
  const sorted = sortClasses(entries);
  const today = new Date().getDay();
  const todayEntries = sorted.filter((entry) => entry.day === today);
  return (
    <Card>
      <Text style={[styles.heading, { color: palette.primary }]}>Today · {DAY_NAMES[today]}</Text>
      <Muted>{todayEntries.length ? todayEntries.map((entry) => `${entry.subject} ${label12(entry.start)} – ${label12(entry.end)}`).join('\n') : 'No sessions today'}</Muted>
      {WEEK.map((day) => {
        const sessions = sorted.filter((entry) => entry.day === day);
        return (
          <View key={day} style={[styles.day, { borderTopColor: palette.border }]}>
            <Text style={[styles.heading, { color: palette.primary }]}>{DAY_NAMES[day]}</Text>
            {sessions.length ? sessions.map((entry) => (
              <View key={entry.id} style={styles.session}>
                <Text style={[styles.subject, { color: palette.foreground }]}>{entry.subject}</Text>
                <Text style={{ color: palette.foreground }}>{label12(entry.start)} – {label12(entry.end)}</Text>
                {entry.teacher.name || entry.note ? <Muted>{[entry.teacher.name, entry.note].filter(Boolean).join(' · ')}</Muted> : null}
              </View>
            )) : <Muted>No sessions</Muted>}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 14, fontWeight: '700' },
  day: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  session: { gap: 3, paddingVertical: 4 },
  subject: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
});
