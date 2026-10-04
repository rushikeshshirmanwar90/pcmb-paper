import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MultiSelectDropdownProps = {
  label: string;
  options: string[];
  selected: string[];
  onSelect: (values: string[]) => void;
  placeholder: string;
  icon?: React.ComponentProps<typeof SymbolView>['name'];
  emptyText?: string;
};

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onSelect,
  placeholder,
  icon,
  emptyText,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const palette = getPalette(useColorScheme() === 'dark');
  const disabled = options.length === 0;
  const selectionSummary = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;
  }, [placeholder, selected]);

  const toggleOption = (option: string) => {
    onSelect(selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>{label}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`${label}: ${selected.join(', ') || placeholder}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: selected.length ? palette.primarySoft : palette.card,
            borderColor: selected.length ? palette.primary : palette.border,
            opacity: disabled ? 0.55 : pressed ? 0.78 : 1,
          },
        ]}>
        <View style={styles.triggerCopy}>
          {icon ? <SymbolView name={icon} tintColor={selected.length ? palette.primary : palette.mutedForeground} size={16} /> : null}
          <Text numberOfLines={1} style={[
            styles.triggerText,
            { color: selected.length ? palette.primary : palette.foreground, fontWeight: selected.length ? '700' : '500' },
          ]}>
            {disabled ? emptyText ?? placeholder : selectionSummary}
          </Text>
        </View>
        <SymbolView
          name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
          tintColor={palette.mutedForeground}
          size={16}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <Pressable
            style={[
              styles.modal,
              {
                width: Math.min(width - 32, 480),
                maxHeight: height * 0.75,
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}
            onPress={(event) => event.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
              <View style={styles.modalHeadingCopy}>
                <Text style={[styles.modalTitle, { color: palette.foreground }]}>{label}</Text>
                <Text style={[styles.modalSubtitle, { color: palette.mutedForeground }]}>Select one or more options</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close selection"
                onPress={() => setIsOpen(false)}
                style={[styles.closeButton, { backgroundColor: palette.secondary }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={palette.mutedForeground}
                  size={15}
                />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.options} showsVerticalScrollIndicator>
              {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => toggleOption(option)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: isSelected ? palette.primarySoft : palette.card,
                        borderColor: isSelected ? palette.primaryBorder : palette.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <Text style={[styles.optionText, { color: palette.foreground }]}>{option}</Text>
                    <View style={[
                      styles.checkbox,
                      { backgroundColor: isSelected ? palette.primary : 'transparent', borderColor: isSelected ? palette.primary : palette.borderStrong },
                    ]}>
                      {isSelected ? (
                        <SymbolView
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          tintColor={palette.onPrimary}
                          size={12}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.footer, { borderTopColor: palette.border }]}>
              <Text style={[styles.selectionCount, { color: palette.mutedForeground }]}>
                {selected.length} selected
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsOpen(false)}
                style={({ pressed }) => [styles.doneButton, { backgroundColor: palette.primary }, pressed && styles.pressed]}>
                <Text style={[styles.doneText, { color: palette.onPrimary }]}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  label: { fontSize: 12, fontWeight: '600' },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  triggerCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  triggerText: { flex: 1, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(20, 18, 16, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  modalHeader: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  modalHeadingCopy: { flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, marginTop: 3 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  options: { padding: 12, gap: 8 },
  option: { minHeight: 46, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 13, fontWeight: '500' },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  footer: { minHeight: 62, paddingHorizontal: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionCount: { fontSize: 12 },
  doneButton: { minWidth: 78, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 14 },
  doneText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
