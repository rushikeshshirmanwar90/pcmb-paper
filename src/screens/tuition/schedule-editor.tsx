import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Field, Icon, MultiChips, usePalette } from '@/components/kit';
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/constants/school';
import { formatTime, type BatchSlot } from '@/services/tuition-api';

const DAY_KEYS = ['1', '2', '3', '4', '5', '6', '0'] as const; // Monday first
const DAY_LABELS = Object.fromEntries(DAY_KEYS.map((d) => [d, WEEKDAY_SHORT[Number(d)]]));

/**
 * A time as typed → "HH:MM" (24-hour), or null if it isn't one. Takes
 * "16:00", "7:00", "7.00", "700", "4 pm", "4:30pm", "4.30 PM", "12 am".
 */
export function parseTime(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const ampm = /^(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)$/.exec(t);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? 0);
    if (h < 1 || h > 12 || m > 59) return null;
    const pm = ampm[3].startsWith('p');
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(t);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** What's typed in the "add timing" row but not added yet. */
export interface ScheduleDraft {
  days: string[];
  start: string;
  end: string;
}

export const EMPTY_DRAFT: ScheduleDraft = { days: [], start: '', end: '' };

const isEmpty = (d: ScheduleDraft) => !d.days.length && !d.start.trim() && !d.end.trim();

/**
 * Adds the draft's days and times to the schedule. An empty draft changes
 * nothing; a half-filled one returns what's missing.
 */
export function applyDraft(value: BatchSlot[], draft: ScheduleDraft): { schedule: BatchSlot[]; error: string | null } {
  if (isEmpty(draft)) return { schedule: value, error: null };
  const s = parseTime(draft.start);
  const e = parseTime(draft.end);
  if (!draft.days.length) return { schedule: value, error: 'Pick the days for the timing.' };
  if (!draft.start.trim() || !draft.end.trim()) return { schedule: value, error: 'Enter when the class starts and ends.' };
  if (!s || !e) return { schedule: value, error: 'Enter times like 16:00 or 4:00 pm.' };
  if (minutes(e) <= minutes(s)) return { schedule: value, error: 'The class must end after it starts.' };
  const added = draft.days.map((d) => ({ day: Number(d), start: s, end: e }));
  const next = [...value.filter((slot) => !added.some((a) => a.day === slot.day && a.start === slot.start)), ...added];
  return { schedule: next.sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start)), error: null };
}

/**
 * The batch's weekly class times: a list to remove from, and a row to add
 * days at one time. The row's contents (draft) belong to the form, so saving
 * the form can add a timing that wasn't added yet.
 */
export function ScheduleEditor({
  value,
  onChange,
  draft,
  onDraftChange,
}: {
  value: BatchSlot[];
  onChange: (next: BatchSlot[]) => void;
  draft: ScheduleDraft;
  onDraftChange: (next: ScheduleDraft) => void;
}) {
  const palette = usePalette();
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ScheduleDraft>) => {
    setError(null);
    onDraftChange({ ...draft, ...patch });
  };

  const add = () => {
    const result = applyDraft(value, isEmpty(draft) ? { ...draft, days: ['_'] } : draft);
    if (isEmpty(draft)) return setError('Pick the days and enter the times.');
    if (result.error) return setError(result.error);
    onChange(result.schedule);
    // Keep the times: the next days often share them.
    onDraftChange({ ...draft, days: [] });
    setError(null);
  };

  const preview = (() => {
    const s = parseTime(draft.start);
    const e = parseTime(draft.end);
    return s && e && minutes(e) > minutes(s) ? `${formatTime(s)} – ${formatTime(e)}` : null;
  })();

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
        <MultiChips label="Days" choices={DAY_KEYS} selected={draft.days} onChange={(days) => set({ days })} labels={DAY_LABELS} />
        <View style={styles.times}>
          <View style={styles.time}>
            <Field label="Starts" value={draft.start} onChangeText={(start) => set({ start })} placeholder="4:00 pm" autoCapitalize="none" maxLength={9} />
          </View>
          <View style={styles.time}>
            <Field label="Ends" value={draft.end} onChangeText={(end) => set({ end })} placeholder="6:00 pm" autoCapitalize="none" maxLength={9} />
          </View>
        </View>
        {preview && draft.days.length ? (
          <Text style={[styles.empty, { color: palette.mutedForeground }]}>
            {draft.days.map((d) => WEEKDAY_SHORT[Number(d)]).join(', ')}, {preview}. Tap Add timing, or it&apos;s added when you save.
          </Text>
        ) : (
          <Text style={[styles.empty, { color: palette.mutedForeground }]}>Times like 16:00 or 4:00 pm.</Text>
        )}
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
