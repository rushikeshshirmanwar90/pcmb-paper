import React, { useEffect, useState, type PropsWithChildren } from 'react';
import { BackHandler, Clipboard, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Chips, Icon, Notice, usePalette, type IconName } from '@/components/kit';
import type { Program } from '@/constants/school';
import { MaxContentWidth } from '@/constants/theme';
import { useTabNavigation } from '@/context/tab-context';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { initials, matchesText } from '@/screens/tuition/admin-filters';

// Small pieces shared by the tuition's Batches, Students, Teachers, Home and
// Profile tabs, built on the kit so they keep its look in light and dark.

/** A colour per program, so JEE, NEET and MHT-CET batches are easy to tell apart (HSC and General stay plain). */
export function programTone(program: Program | null | undefined): 'primary' | 'success' | 'violet' | 'neutral' {
  if (program === 'JEE') return 'primary';
  if (program === 'NEET') return 'success';
  if (program === 'MHT_CET_PCM' || program === 'MHT_CET_PCB') return 'violet';
  return 'neutral';
}

// ─── Layout and navigation ─────────────────────────────────────────────────

/**
 * The scrolling body of a panel inside a tab that has its own header, e.g.
 * People's Students and Teachers: the kit Screen's spacing, clear of the tab
 * bar, with pull to refresh.
 */
export function PanelScroll({ children, onRefresh, refreshing }: PropsWithChildren<{ onRefresh: () => void; refreshing: boolean }>) {
  const palette = usePalette();
  const tabBarHeight = useTabBarHeight();
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.panel, { paddingBottom: tabBarHeight + 24 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Android's back button on any tab but Home goes to Home first; on Home it
 * leaves the app as usual. Open sheets close on back by themselves.
 */
export function useBackToHome() {
  const { activeKey, goToTab } = useTabNavigation();
  useEffect(() => {
    if (Platform.OS !== 'android' || activeKey === 'home') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goToTab('home');
      return true;
    });
    return () => subscription.remove();
  }, [activeKey, goToTab]);
}

// ─── Feedback ──────────────────────────────────────────────────────────────

type Flash = { text: string; tone: 'success' | 'danger'; at: number };

/**
 * A short message after an action, e.g. "Batch saved.". Successes fade after
 * a few seconds; problems stay until dismissed or the next action.
 */
export function useFlash(initial?: string) {
  const [flash, setFlash] = useState<Flash | null>(() => (initial ? { text: initial, tone: 'success', at: Date.now() } : null));
  useEffect(() => {
    if (!flash || flash.tone !== 'success') return;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);
  return {
    flash,
    show: (text: string, tone: Flash['tone'] = 'success') => setFlash({ text, tone, at: Date.now() }),
    clear: () => setFlash(null),
  };
}

export function FlashNotice({ flash, onDismiss }: { flash: Flash | null; onDismiss: () => void }) {
  if (!flash) return null;
  return <Notice key={flash.at} tone={flash.tone} title={flash.text} onDismiss={onDismiss} live />;
}

/** Copies text. False when this device doesn't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
    if (Platform.OS === 'web' && nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
    // React Native's own clipboard: no extra native module needed.
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Search and filters ────────────────────────────────────────────────────

export function SearchBox({ value, onChangeText, placeholder, label }: { value: string; onChangeText: (t: string) => void; placeholder: string; label: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.search, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Icon name={{ ios: 'magnifyingglass', android: 'search' }} color={palette.mutedForeground} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedForeground}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.searchInput, { color: palette.foreground }]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={10} style={styles.searchClear}>
          <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} color={palette.mutedForeground} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A "Clear filters" text button beside a list's count. */
export function ClearFilters({ onPress }: { onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={onPress} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.clearText, { color: palette.primary }]}>Clear filters</Text>
    </Pressable>
  );
}

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** One filter as a sideways-scrolling row of small chips: "Program  All  JEE  NEET  …". */
export function FilterRow<T extends string>({ label, options, value, onChange }: { label: string; options: FilterOption<T>[]; value: T; onChange: (v: T) => void }) {
  const palette = usePalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.filterRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      <Text style={[styles.filterLabel, { color: palette.mutedForeground }]}>{label}</Text>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.count === undefined ? `${label}: ${o.label}` : `${label}: ${o.label}, ${o.count}`}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.filterChip,
              { backgroundColor: on ? palette.primarySoft : palette.card, borderColor: on ? palette.primary : palette.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.filterChipText, { color: on ? palette.primaryInk : palette.foreground, fontWeight: on ? '700' : '500' }]}>{o.label}</Text>
            {o.count !== undefined ? <Text style={[styles.filterCount, { color: on ? palette.primaryInk : palette.mutedForeground }]}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Picking one of many ───────────────────────────────────────────────────

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
  /** Always listed, whatever the search, e.g. "No teacher". */
  pinned?: boolean;
}

const MAX_LISTED = 8;

/**
 * Pick one option from a list with radio rows; a search box appears when
 * there are many. Shows at most a handful of matches, so it never needs its
 * own scrolling inside a form.
 */
export function OptionList({ label, options, selected, onChange, searchAt = 7, searchPlaceholder = 'Search' }: {
  label: string;
  options: PickerOption[];
  selected: string;
  onChange: (value: string) => void;
  searchAt?: number;
  searchPlaceholder?: string;
}) {
  const palette = usePalette();
  const [search, setSearch] = useState('');
  const searchable = options.length >= searchAt;
  const matching = options.filter((o) => o.pinned || matchesText(search, o.label, o.hint));
  const listed = matching.slice(0, MAX_LISTED);
  // Keep the chosen one in view even when it's past the cut-off.
  const chosen = matching.find((o) => o.value === selected);
  if (chosen && !listed.includes(chosen)) listed[listed.length - 1] = chosen;
  const hidden = matching.length - listed.length;

  return (
    <View style={styles.optionWrap}>
      {searchable ? <SearchBox value={search} onChangeText={setSearch} placeholder={searchPlaceholder} label={`Search ${label.toLowerCase()}`} /> : null}
      <View style={[styles.optionList, { borderColor: palette.border, backgroundColor: palette.card }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {listed.map((o, i) => {
          const on = o.value === selected;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.option,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
                on && { backgroundColor: palette.primarySoft },
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={on ? { ios: 'largecircle.fill.circle', android: 'radio_button_checked' } : { ios: 'circle', android: 'radio_button_unchecked' }}
                color={on ? palette.primary : palette.mutedForeground}
                size={20}
              />
              <View style={styles.flex}>
                <Text style={[styles.optionLabel, { color: on ? palette.primaryInk : palette.foreground }]} numberOfLines={1}>
                  {o.label}
                </Text>
                {o.hint ? (
                  <Text style={[styles.optionHint, { color: palette.mutedForeground }]} numberOfLines={1}>
                    {o.hint}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {listed.length === 0 || (listed.every((o) => o.pinned) && search.trim()) ? (
          <Text style={[styles.optionMore, { color: palette.mutedForeground }]}>No match for “{search.trim()}”.</Text>
        ) : null}
      </View>
      {hidden > 0 ? (
        <Text style={[styles.optionMore, { color: palette.mutedForeground }]}>
          {hidden} more. {searchable ? 'Type to narrow the list.' : ''}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Pick one of a few options as chips; with many (e.g. a big teaching staff)
 * it shows the current choice and opens a searchable list in place.
 */
export function OptionPicker({ label, options, selected, onChange, chipsUpTo = 5, searchPlaceholder }: {
  label: string;
  options: PickerOption[];
  selected: string;
  onChange: (value: string) => void;
  /** Up to this many options show as chips. */
  chipsUpTo?: number;
  searchPlaceholder?: string;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);

  if (options.length <= chipsUpTo) {
    return (
      <Chips
        label={label}
        choices={options.map((o) => o.value)}
        selected={selected}
        onChange={onChange}
        labels={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      />
    );
  }

  const current = options.find((o) => o.value === selected);
  return (
    <View style={styles.optionWrap}>
      <Text style={[styles.pickerLabel, { color: palette.mutedForeground }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'Not chosen'}. ${open ? 'Close the list' : 'Change'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.pickerField, { borderColor: open ? palette.primary : palette.border, backgroundColor: palette.background }, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text style={[styles.optionLabel, { color: palette.foreground }]} numberOfLines={1}>
            {current?.label ?? 'Not chosen'}
          </Text>
          {current?.hint ? (
            <Text style={[styles.optionHint, { color: palette.mutedForeground }]} numberOfLines={1}>
              {current.hint}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.pickerAction, { color: palette.primary }]}>{open ? 'Done' : 'Change'}</Text>
      </Pressable>
      {open ? (
        <OptionList
          label={label}
          options={options}
          selected={selected}
          searchAt={0}
          searchPlaceholder={searchPlaceholder}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

// ─── Rows and identity ─────────────────────────────────────────────────────

/** A person's initials in a circle. */
export function Avatar({ name, size = 40, muted = false }: { name: string; size?: number; muted?: boolean }) {
  const palette = usePalette();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: muted ? palette.secondary : palette.primarySoft }]}>
      <Text style={[styles.avatarText, { color: muted ? palette.mutedForeground : palette.primaryInk, fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

/** Who a detail page is about: initials, name, a line under it and badges. */
export function PersonHeader({ name, line, badges }: { name: string; line: string; badges?: React.ReactNode }) {
  const palette = usePalette();
  return (
    <View style={styles.personHeader}>
      <Avatar name={name} size={52} />
      <View style={styles.flex}>
        <Text style={[styles.personName, { color: palette.foreground }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.personLine, { color: palette.mutedForeground }]} numberOfLines={1}>
          {line}
        </Text>
        {badges ? <View style={styles.badges}>{badges}</View> : null}
      </View>
    </View>
  );
}

/** A labelled detail with an icon: "Phone / 98200 12345". Empty values read "Not set". */
export function InfoRow({ icon, label, value, last = false, tone }: { icon: IconName; label: string; value: string; last?: boolean; tone?: 'warning' }) {
  const palette = usePalette();
  const empty = !value.trim();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${empty ? 'Not set' : value}`}
      style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
    >
      <View style={[styles.iconTile, { backgroundColor: tone === 'warning' ? palette.warningSoft : palette.primarySoft }]}>
        <Icon name={icon} color={tone === 'warning' ? palette.warning : palette.primary} size={17} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { color: palette.mutedForeground }]}>{label}</Text>
        <Text selectable style={[styles.infoValue, { color: empty ? palette.mutedForeground : palette.foreground, fontWeight: empty ? '500' : '600' }]}>
          {empty ? 'Not set' : value}
        </Text>
      </View>
    </View>
  );
}

/** A tappable action in a list; `danger` for removing things. */
export function ActionRow({ icon, title, subtitle, onPress, tone = 'default', disabled = false, last = false }: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  last?: boolean;
}) {
  const palette = usePalette();
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: danger ? palette.dangerSoft : palette.primarySoft }]}>
        <Icon name={icon} color={danger ? palette.danger : palette.primary} size={17} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.actionTitle, { color: danger ? palette.dangerInk : palette.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.optionHint, { color: palette.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

/** "Login on · last seen 2 days ago" with a coloured badge. */
export function LoginStatus({ active, lastLoginAt, ago }: { active: boolean; lastLoginAt: string | null; ago: (iso: string) => string }) {
  const palette = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`Login ${active ? 'on' : 'off'}. ${lastLoginAt ? `Last logged in ${ago(lastLoginAt)}` : 'Never logged in'}`}
      style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
    >
      <View style={[styles.iconTile, { backgroundColor: active ? palette.successSoft : palette.dangerSoft }]}>
        <Icon
          name={active ? { ios: 'checkmark.shield', android: 'verified_user' } : { ios: 'lock', android: 'lock' }}
          color={active ? palette.success : palette.danger}
          size={17}
        />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { color: palette.mutedForeground }]}>Account status</Text>
        <Text style={[styles.infoValue, { color: palette.foreground }]}>{active ? 'Can log in' : "Login off — can't log in"}</Text>
        <Text style={[styles.optionHint, { color: palette.mutedForeground }]}>{lastLoginAt ? `Last logged in ${ago(lastLoginAt)}` : 'Never logged in'}</Text>
      </View>
      <Badge label={active ? 'Active' : 'Login off'} tone={active ? 'success' : 'danger'} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  panel: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 16, gap: 14 },
  pressed: { opacity: 0.75 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingLeft: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  searchClear: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  filterLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, minWidth: 44 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  filterChipText: { fontSize: 13 },
  filterCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  optionWrap: { gap: 8 },
  optionList: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionHint: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  optionMore: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 10 },
  pickerLabel: { fontSize: 13, fontWeight: '600' },
  pickerField: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 46 },
  pickerAction: { fontSize: 14, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  personName: { fontSize: 18, fontWeight: '800' },
  personLine: { fontSize: 14, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 56 },
  iconTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, fontWeight: '600' },
  infoValue: { fontSize: 15, marginTop: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600' },
});
