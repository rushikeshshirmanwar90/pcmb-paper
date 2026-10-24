import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { getPalette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface DropdownSelectProps {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  icon?: any;
  searchable?: boolean;
  /** Shown, greyed out and not tappable, when there are no options to pick. */
  emptyText?: string;
  /** How many questions each option holds, shown beside it; "All" shows the total. */
  counts?: Record<string, number>;
}

const formatCount = (n: number) => n.toLocaleString();

export function DropdownSelect({
  label,
  options,
  selected,
  onSelect,
  placeholder = 'Select option',
  icon,
  searchable = false,
  emptyText,
  counts,
}: DropdownSelectProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const palette = getPalette(dark);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isSelected = selected && selected !== 'All';
  const isEmpty = !!emptyText && !isSelected && options.filter((o) => o !== 'All').length === 0;

  const total = useMemo(
    () => (counts ? options.reduce((sum, o) => sum + (counts[o] ?? 0), 0) : undefined),
    [counts, options]
  );
  const countOf = (opt: string) => (opt === 'All' ? (options.length > 0 ? total : undefined) : counts?.[opt]);
  const selectedCount = countOf(isSelected ? selected : 'All');

  // All options including 'All'
  const allOptions = useMemo(() => {
    const opts = ['All', ...options.filter((o) => o !== 'All')];
    if (!searchQuery.trim()) return opts;
    const q = searchQuery.toLowerCase();
    return opts.filter((o) => o.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const handleSelect = (val: string) => {
    onSelect(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: any) => {
    e.stopPropagation?.();
    onSelect('All');
  };

  const modalWidth = Math.min(isTablet ? 480 : width - 32, 540);
  const maxListHeight = Math.min(height * 0.55, 380);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: palette.mutedForeground }]}>{label}</Text>

      {/* Trigger Button */}
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`${label}: ${selected || 'All'}`}
        accessibilityState={{ disabled: isEmpty }}
        disabled={isEmpty}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: isSelected ? (dark ? palette.primarySoft : '#FFF8F4') : palette.card,
            borderColor: isSelected ? palette.primary : palette.border,
            opacity: isEmpty ? 0.55 : pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={styles.triggerContent}>
          {icon && (
            <View style={styles.iconWrap}>
              <SymbolView
                name={icon}
                tintColor={isSelected ? palette.primary : palette.mutedForeground}
                size={16}
              />
            </View>
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.triggerText,
              {
                color: isSelected ? (dark ? palette.primaryInk : palette.primary) : palette.foreground,
                fontWeight: isSelected ? '700' : '500',
              },
            ]}
          >
            {isEmpty ? emptyText : selected || placeholder}
          </Text>
        </View>

        <View style={styles.triggerRight}>
          {!isEmpty && selectedCount !== undefined && (
            <Text style={[styles.countText, { color: palette.mutedForeground }]}>{formatCount(selectedCount)}</Text>
          )}
          {isSelected && (
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              style={[styles.clearBtn, { backgroundColor: dark ? palette.secondary : '#EFE8E2' }]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor={palette.mutedForeground}
                size={11}
              />
            </Pressable>
          )}
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
            tintColor={isSelected ? palette.primary : palette.mutedForeground}
            size={15}
          />
        </View>
      </Pressable>

      {/* Selection Modal Dropdown */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsOpen(false);
          setSearchQuery('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setIsOpen(false);
            setSearchQuery('');
          }}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                width: modalWidth,
                backgroundColor: palette.card,
                borderColor: palette.border,
                maxHeight: height * 0.8,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
              <View style={styles.modalTitleRow}>
                {icon && (
                  <SymbolView name={icon} tintColor={palette.primary} size={18} />
                )}
                <Text style={[styles.modalTitle, { color: palette.foreground }]}>
                  Select {label}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: palette.secondary }]}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={palette.mutedForeground}
                  size={14}
                />
              </Pressable>
            </View>

            {/* Optional Search */}
            {(searchable || options.length > 8) && (
              <View style={[styles.searchWrap, { borderBottomColor: palette.border }]}>
                <SymbolView
                  name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                  tintColor={palette.mutedForeground}
                  size={15}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  placeholderTextColor={palette.mutedForeground}
                  style={[styles.searchInput, { color: palette.foreground }]}
                  autoFocus={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                    <SymbolView
                      name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                      tintColor={palette.mutedForeground}
                      size={15}
                    />
                  </Pressable>
                )}
              </View>
            )}

            {/* Options List */}
            <ScrollView
              style={{ maxHeight: maxListHeight }}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {allOptions.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: palette.mutedForeground }]}>
                    No matching options
                  </Text>
                </View>
              ) : (
                allOptions.map((opt) => {
                  const active = selected === opt || (!selected && opt === 'All');
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => handleSelect(opt)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        {
                          backgroundColor: active
                            ? (dark ? palette.primarySoft : '#F8ECE5')
                            : pressed
                            ? palette.secondary
                            : 'transparent',
                          borderColor: active ? palette.primaryBorder : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.optionText,
                          {
                            color: active
                              ? (dark ? palette.primaryInk : palette.primary)
                              : palette.foreground,
                            fontWeight: active ? '700' : '500',
                          },
                        ]}
                      >
                        {opt === 'All' ? `All (${label})` : opt}
                      </Text>
                      {countOf(opt) !== undefined && (
                        <Text style={[styles.countText, { color: palette.mutedForeground }]}>
                          {formatCount(countOf(opt)!)}
                        </Text>
                      )}
                      {active && (
                        <SymbolView
                          name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                          tintColor={palette.primary}
                          size={18}
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.2,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  iconWrap: {
    width: 20,
    alignItems: 'center',
  },
  triggerText: {
    fontSize: 14,
    flex: 1,
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  listContainer: {
    padding: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginRight: 6,
  },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
