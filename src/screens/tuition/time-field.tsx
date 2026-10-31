import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { Chips, Icon, Segmented, usePalette } from '@/components/kit';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { dateToTime, from12, label12, MINUTE_STEPS, timeToDate, to12 } from '@/screens/tuition/timetable-draft';

// A time of day, shown as "4:30 PM" and kept as "16:30".
//
// With the native Expo UI module (development and release builds), it's the
// platform's own picker: Android's time dialog, iOS's compact time picker.
// Without it (Expo Go, web) it opens a small chooser here: hour, minutes, AM/PM.

const NATIVE = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoUI');

type PickerProps = {
  value: Date;
  mode: 'time';
  display?: 'default' | 'compact';
  presentation?: 'dialog' | 'inline';
  is24Hour?: boolean;
  accentColor?: string;
  themeVariant?: 'light' | 'dark';
  onValueChange: (event: unknown, date: Date) => void;
  onDismiss?: () => void;
};

/** Loaded only when the native module is there, so Expo Go never loads it. */
const NativePicker: React.ComponentType<PickerProps> | null = NATIVE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@expo/ui/community/datetime-picker').DateTimePicker
  : null;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const dark = useColorScheme() === 'dark';

  // iOS: the system's compact time picker sits in the field itself.
  if (NativePicker && Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: palette.mutedForeground }]}>{label}</Text>
        <View style={[styles.field, { borderColor: palette.border, backgroundColor: palette.card }]} accessible accessibilityLabel={`${label}: ${label12(value)}`}>
          <Icon name={{ ios: 'clock', android: 'schedule' }} color={palette.mutedForeground} size={16} />
          <NativePicker
            value={timeToDate(value)}
            mode="time"
            display="compact"
            accentColor={palette.primary}
            themeVariant={dark ? 'dark' : 'light'}
            onValueChange={(_, date) => onChange(dateToTime(date))}
          />
        </View>
      </View>
    );
  }

  const parts = to12(value);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${label12(value)}. Change`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.field, { borderColor: open ? palette.primary : palette.border, backgroundColor: palette.card }, pressed && styles.pressed]}
      >
        <Icon name={{ ios: 'clock', android: 'schedule' }} color={palette.mutedForeground} size={16} />
        <Text style={[styles.value, { color: palette.foreground }]}>{label12(value)}</Text>
      </Pressable>

      {/* Android: the system time dialog, in 12-hour AM/PM. */}
      {NativePicker && open ? (
        <NativePicker
          value={timeToDate(value)}
          mode="time"
          presentation="dialog"
          is24Hour={false}
          accentColor={palette.primary}
          themeVariant={dark ? 'dark' : 'light'}
          onValueChange={(_, date) => {
            setOpen(false);
            onChange(dateToTime(date));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {/* No native picker here: choose hour, minutes and AM/PM. */}
      {!NATIVE && open ? (
        <View style={[styles.chooser, { backgroundColor: palette.secondary }]}>
          <Chips label="Hour" choices={HOURS} selected={String(parts.hour)} onChange={(h) => onChange(from12(Number(h), parts.minute, parts.pm))} />
          <Chips
            label="Minutes"
            choices={[...new Set([...MINUTE_STEPS, parts.minute])].sort((a, b) => a - b).map((m) => String(m).padStart(2, '0'))}
            selected={String(parts.minute).padStart(2, '0')}
            onChange={(m) => onChange(from12(parts.hour, Number(m), parts.pm))}
          />
          <Segmented
            label="AM or PM"
            options={[
              { value: 'am', label: 'AM' },
              { value: 'pm', label: 'PM' },
            ]}
            value={parts.pm ? 'pm' : 'am'}
            onChange={(v) => onChange(from12(parts.hour, parts.minute, v === 'pm'))}
          />
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
            <Text style={[styles.doneText, { color: palette.primary }]}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6, minWidth: 0 },
  label: { fontSize: 13, fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  value: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.75 },
  chooser: { borderRadius: 12, padding: 12, gap: 10 },
  done: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  doneText: { fontSize: 14, fontWeight: '700' },
});
