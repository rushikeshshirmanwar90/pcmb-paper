import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  /** How many questions each option holds, shown beside it. */
  counts?: Record<string, number>;
  /** Shows the options under headings (e.g. topics under their chapter), each with its own select-all. */
  sections?: { title: string; options: string[] }[];
  /** Adds a search box; on by default for long lists. */
  searchable?: boolean;
  /** Picking nothing means "all of them" (a filter), rather than a required choice. */
  allWhenNone?: boolean;
};

const formatCount = (n: number) => n.toLocaleString();

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onSelect,
  placeholder,
  icon,
  emptyText,
  counts,
  sections,
  searchable,
  allWhenNone = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { width, height } = useWindowDimensions();
  const palette = getPalette(useColorScheme() === 'dark');
  const disabled = options.length === 0;
  const showSearch = searchable ?? options.length > 8;

  const selectionSummary = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;
  }, [placeholder, selected]);

  // When nothing picked means "all of them", the total covers every option.
  const total = useMemo(() => {
    if (!counts || disabled || (!selected.length && !allWhenNone)) return undefined;
    return (selected.length ? selected : options).reduce((sum, option) => sum + (counts[option] ?? 0), 0);
  }, [allWhenNone, counts, disabled, options, selected]);

  const visibleSections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (option: string) => !needle || option.toLowerCase().includes(needle);
    const groups = sections ?? [{ title: '', options }];
    return groups
      .map((section) => ({ ...section, options: section.options.filter(matches) }))
      .filter((section) => section.options.length > 0);
  }, [options, query, sections]);

  const toggleOption = (option: string) => {
    onSelect(selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]);
  };

  const toggleSection = (sectionOptions: string[]) => {
    const allPicked = sectionOptions.every((option) => selected.includes(option));
    onSelect(allPicked
      ? selected.filter((item) => !sectionOptions.includes(item))
      : [...selected, ...sectionOptions.filter((option) => !selected.includes(option))]);
  };

  const close = () => {
    setIsOpen(false);
    setQuery('');
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
            { color: selected.length ? palette.primaryInk : palette.foreground, fontWeight: selected.length ? '700' : '500' },
          ]}>
            {disabled ? emptyText ?? placeholder : selectionSummary}
          </Text>
        </View>
        {total !== undefined ? (
          <Text style={[styles.countText, { color: palette.mutedForeground }]}>{formatCount(total)}</Text>
        ) : null}
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
        onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable
            style={[
              styles.modal,
              {
                width: Math.min(width - 32, 480),
                maxHeight: height * 0.8,
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}
            onPress={(event) => event.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
              <View style={styles.modalHeadingCopy}>
                <Text style={[styles.modalTitle, { color: palette.foreground }]}>{label}</Text>
                <Text style={[styles.modalSubtitle, { color: palette.mutedForeground }]}>
                  {allWhenNone ? 'Select one or more, or none for all' : 'Select one or more options'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close selection"
                onPress={close}
                style={[styles.closeButton, { backgroundColor: palette.secondary }]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={palette.mutedForeground}
                  size={15}
                />
              </Pressable>
            </View>

            {showSearch ? (
              <View style={[styles.searchWrap, { borderBottomColor: palette.border }]}>
                <SymbolView
                  name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                  tintColor={palette.mutedForeground}
                  size={15}
                />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  placeholderTextColor={palette.mutedForeground}
                  accessibilityLabel={`Search ${label.toLowerCase()}`}
                  style={[styles.searchInput, { color: palette.foreground }]}
                />
                {query.length > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
                    <SymbolView
                      name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                      tintColor={palette.mutedForeground}
                      size={15}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.options} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              {visibleSections.length === 0 ? (
                <Text style={[styles.emptyText, { color: palette.mutedForeground }]}>No matching options</Text>
              ) : null}
              {visibleSections.map((section) => {
                const allPicked = section.options.every((option) => selected.includes(option));
                return (
                  <View key={section.title || 'options'} style={styles.section}>
                    {section.title ? (
                      <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: palette.foreground }]}>{section.title}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${allPicked ? 'Clear' : 'Select all'} in ${section.title}`}
                          onPress={() => toggleSection(section.options)}
                          hitSlop={8}
                          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
                          <Text style={[styles.sectionActionText, { color: palette.primary }]}>
                            {allPicked ? 'Clear' : 'Select all'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {section.options.map((option) => {
                      const isSelected = selected.includes(option);
                      const count = counts?.[option];
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
                          {count !== undefined ? (
                            <Text style={[styles.countText, { color: palette.mutedForeground }]}>{formatCount(count)}</Text>
                          ) : null}
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
                  </View>
                );
              })}
            </ScrollView>
            <View style={[styles.footer, { borderTopColor: palette.border }]}>
              <Text style={[styles.selectionCount, { color: palette.mutedForeground }]}>
                {selected.length || !allWhenNone ? `${selected.length} selected` : 'All'}
              </Text>
              <View style={styles.footerActions}>
                {selected.length ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelect([])}
                    style={({ pressed }) => [styles.clearButton, { borderColor: palette.border }, pressed && styles.pressed]}>
                    <Text style={[styles.clearText, { color: palette.foreground }]}>Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={close}
                  style={({ pressed }) => [styles.doneButton, { backgroundColor: palette.primary }, pressed && styles.pressed]}>
                  <Text style={[styles.doneText, { color: palette.onPrimary }]}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
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
  triggerText: { flex: 1, fontSize: 14 },
  countText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  overlay: { flex: 1, backgroundColor: 'rgba(20, 18, 16, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  modalHeader: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  modalHeadingCopy: { flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, marginTop: 3 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 48, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  options: { padding: 12, gap: 14 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  sectionAction: { minHeight: 32, justifyContent: 'center' },
  sectionActionText: { fontSize: 13, fontWeight: '700' },
  option: { minHeight: 46, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { flex: 1, fontSize: 13, fontWeight: '500', paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  footer: { minHeight: 62, paddingHorizontal: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionCount: { fontSize: 12 },
  clearButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 14 },
  clearText: { fontSize: 13, fontWeight: '600' },
  doneButton: { minWidth: 78, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 14 },
  doneText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
