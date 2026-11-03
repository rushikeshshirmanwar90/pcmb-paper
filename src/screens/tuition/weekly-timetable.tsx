import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Muted, SectionTitle, usePalette } from '@/components/kit';
import { DAY_NAMES, label12, sortClasses, WEEK, weeklyMinutes } from '@/screens/tuition/timetable-draft';
import type { TimetableEntry } from '@/services/school-api';
import { formatMinutes } from '@/services/tuition-api';

/** A batch's classes grouped by weekday, Monday first. Each class opens through `onPressEntry`. */
export function WeeklyTimetable({ entries, onPressEntry }: { entries: TimetableEntry[]; onPressEntry: (entry: TimetableEntry) => void }) {
  const palette = usePalette();
  const classes = sortClasses(entries);
  const byDay = WEEK.map((day) => ({ day, list: classes.filter((c) => c.day === day) })).filter((d) => d.list.length);
  const noTeacher = classes.filter((c) => !c.teacher.id).length;

  return (
    <>
      <SectionTitle title={`The week · ${classes.length} ${classes.length === 1 ? 'class' : 'classes'} · ${formatMinutes(weeklyMinutes(classes))}`} />
      {noTeacher ? <Muted>{noTeacher === 1 ? '1 class has' : `${noTeacher} classes have`} no teacher yet. Tap a class to assign one.</Muted> : null}
      {byDay.map(({ day, list }) => (
        <Card key={day} style={styles.listCard}>
          <Text accessibilityRole="header" style={[styles.dayName, { color: palette.primary }]}>
            {DAY_NAMES[day]}
          </Text>
          {list.map((c, i) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.subject}, ${label12(c.start)} to ${label12(c.end)}, ${c.teacher.name || 'no teacher'}${c.note ? `, ${c.note}` : ''}`}
              accessibilityHint="Opens the class to change or remove it"
              onPress={() => onPressEntry(c)}
              style={({ pressed }) => [
                styles.classRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.timeCol, { borderRightColor: palette.primary }]}>
                <Text style={[styles.time, { color: palette.foreground }]}>{label12(c.start)}</Text>
                <Text style={[styles.timeEnd, { color: palette.mutedForeground }]}>{label12(c.end)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.subject, { color: palette.foreground }]}>{c.subject}</Text>
                <Text style={[styles.meta, { color: c.teacher.id ? palette.mutedForeground : palette.warningInk }]} numberOfLines={1}>
                  {c.teacher.name || 'No teacher yet'}
                </Text>
              </View>
              {c.note ? <Badge label={c.note} tone="violet" /> : null}
            </Pressable>
          ))}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  listCard: { paddingVertical: 4 },
  dayName: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, paddingTop: 8, paddingBottom: 4 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 8 },
  timeCol: { width: 82, borderRightWidth: 2, paddingRight: 10 },
  time: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeEnd: { fontSize: 12, fontVariant: ['tabular-nums'] },
  subject: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 1 },
});
