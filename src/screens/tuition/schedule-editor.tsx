import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Field, Icon, MultiChips, usePalette } from '@/components/kit';
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/constants/school';
import { formatTime, type BatchSlot } from '@/services/tuition-api';

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '0'] as const; // Monday first
const DAY_LABELS = Object.fromEntries(DAY_KEYS.map((d) => [d, WEEKDAY_SHORT[Number(d)]]));

/** "7:00", "07:00", "7.00" or "700" → "07:00"; null if it isn't a time. */
export function parseTime(text: string): string | null {
  const cleaned = text.trim().replace('.', ':');
  const match = /^(\d{1,2}):?(\d{2})$/.exec(cleaned);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** The batch's weekly class times: a list to remove from, and a row to add days at one time. */
export function ScheduleEditor({ value, onChange }: { value: BatchSlot[]; onChange: (next: BatchSlot[]) => void }) {
  const palette = usePalette();
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (!days.length) return setError('Pick the days.');
    if (!s || !e) return setError('Enter times in 24-hour form, like 16:00 and 18:30.');
    if (minutes(e) <= minutes(s)) return setError('The class must end after it starts.');
    const added = days.map((d) => ({ day: Number(d), start: s, end: e }));
    const next = [...value.filter((slot) => !added.some((a) => a.day === slot.day && a.start === slot.start)), ...added];
    onChange(next.sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start)));
    setDays([]);
    setError(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>Class timings</Text>
      {value.length === 0 ? (
        <Text style={[styles.empty, { color: palette.mutedForeground }]}>No timings yet. Add the days and times below.</Text>
      ) : (
        <View style={[styles.list, { borderColor: palette.border }]}>
          {value.map((slot, i) => (
            <View key={`${slot.day}-${slot.start}`} style={[styles.slot, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }]}>
              <Text style={[styles.slotDay, { color: palette.foreground }]}>{WEEKDAY_NAMES[slot.day]}</Text>
              <Text style={[styles.slotTime, { color: palette.mutedForeground }]}>
                {formatTime(slot.start)} – {formatTime(slot.end)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${WEEKDAY_NAMES[slot.day]} ${formatTime(slot.start)}`}
                onPress={() => onChange(value.filter((_, j) => j !== i))}
                hitSlop={8}
              >
                <Icon name={{ ios: 'minus.circle', android: 'remove_circle_outline' }} color={palette.danger} size={18} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.adder, { backgroundColor: palette.secondary }]}>
        <MultiChips label="Days" choices={DAY_KEYS} selected={days} onChange={setDays} labels={DAY_LABELS} />
        <View style={styles.times}>
          <View style={styles.time}>
            <Field label="Starts" value={start} onChangeText={setStart} placeholder="16:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={styles.time}>
            <Field label="Ends" value={end} onChangeText={setEnd} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </View>
        <ErrorText message={error} />
        <Button label="Add timing" variant="secondary" icon={{ ios: 'plus', android: 'add' }} onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  empty: { fontSize: 13 },
  list: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  slotDay: { fontSize: 14, fontWeight: '600', width: 96 },
  slotTime: { fontSize: 14, flex: 1, fontVariant: ['tabular-nums'] },
  adder: { borderRadius: 12, padding: 12, gap: 12 },
  times: { flexDirection: 'row', gap: 10 },
  time: { flex: 1 },
});
