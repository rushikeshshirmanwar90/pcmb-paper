import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { Chips, Icon, usePalette } from '@/components/kit';
import { useColorScheme } from '@/hooks/use-color-scheme';

// A calendar day, shown as "Tue, 3 Nov".
//
// With the native Expo UI module (development and release builds) it's the
// platform's own picker: Android's date dialog, iOS's compact date picker.
// Without it (Expo Go, web) it opens a small chooser of the coming days.
// The time of day is picked with the existing TimeField.

const NATIVE = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoUI');

type PickerProps = {
  value: Date;
  mode: 'date';
  display?: 'default' | 'compact';
  presentation?: 'dialog' | 'inline';
  minimumDate?: Date;
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

const DAYS_OFFERED = 14;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function DateField({ label, value, onChange, minimumDate }: { label: string; value: Date; onChange: (day: Date) => void; minimumDate: Date }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const dark = useColorScheme() === 'dark';

  if (NativePicker && Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: palette.mutedForeground }]}>{label}</Text>
        <View style={[styles.field, { borderColor: palette.border, backgroundColor: palette.card }]} accessible accessibilityLabel={`${label}: ${dayLabel(value)}`}>
          <Icon name={{ ios: 'calendar', android: 'calendar_today' }} color={palette.mutedForeground} size={16} />
          <NativePicker value={value} mode="date" display="compact" minimumDate={minimumDate} accentColor={palette.primary} themeVariant={dark ? 'dark' : 'light'} onValueChange={(_, date) => onChange(date)} />
        </View>
      </View>
    );
  }

  const today = startOfDay(minimumDate);
  const days = Array.from({ length: DAYS_OFFERED }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  // A day further out than the list reaches stays selectable (an edited test).
  const choices = days.some((d) => keyOf(d) === keyOf(value)) ? days : [startOfDay(value), ...days];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${dayLabel(value)}. Change`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.field, { borderColor: open ? palette.primary : palette.border, backgroundColor: palette.card }, pressed && styles.pressed]}
      >
        <Icon name={{ ios: 'calendar', android: 'calendar_today' }} color={palette.mutedForeground} size={16} />
        <Text style={[styles.value, { color: palette.foreground }]}>{dayLabel(value)}</Text>
      </Pressable>

      {NativePicker && open ? (
        <NativePicker
          value={value}
          mode="date"
          presentation="dialog"
          minimumDate={minimumDate}
          accentColor={palette.primary}
          themeVariant={dark ? 'dark' : 'light'}
          onValueChange={(_, date) => {
            setOpen(false);
            onChange(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {!NATIVE && open ? (
        <View style={[styles.chooser, { backgroundColor: palette.secondary }]}>
          <Chips
            choices={choices.map(keyOf)}
            selected={keyOf(value)}
            labels={Object.fromEntries(choices.map((d) => [keyOf(d), dayLabel(d)]))}
            onChange={(key) => {
              onChange(choices.find((d) => keyOf(d) === key) ?? value);
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6, minWidth: 0 },
  label: { fontSize: 13, fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  value: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  chooser: { borderRadius: 12, padding: 12, gap: 10 },
});
