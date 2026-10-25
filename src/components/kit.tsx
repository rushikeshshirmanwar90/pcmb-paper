import React, { useCallback, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { getPalette, MaxContentWidth } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';

// Building blocks for the tuition, teacher and student screens, so they share
// one look: a screen with a header, cards, form fields, buttons, chips and
// list rows, in the app's palette (light and dark).

export type Palette = ReturnType<typeof getPalette>;

export function usePalette(): Palette {
  return getPalette(useColorScheme() === 'dark');
}

export type IconName = { ios: SFSymbol; android: AndroidSymbol };

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  return <SymbolView name={{ ios: name.ios, android: name.android, web: name.android }} tintColor={color} size={size} />;
}

// ─── Screen ────────────────────────────────────────────────────────────────

/**
 * A tab's screen: the app header, then scrolling content kept clear of the
 * tab bar. Pull to refresh when onRefresh is given.
 */
export function Screen({
  title,
  subtitle,
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
  footer,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  /** Pinned under the content, above the tab bar. */
  footer?: ReactNode;
}>) {
  const palette = usePalette();
  const tabBarHeight = useTabBarHeight();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.background }]}>
      <AppHeader title={title} subtitle={subtitle} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, { paddingBottom: footer ? 0 : tabBarHeight }]}>{children}</View>
      )}
      {footer ? <View style={{ marginBottom: tabBarHeight }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

// ─── Layout pieces ─────────────────────────────────────────────────────────

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={styles.sectionTitleRow}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      {action}
    </View>
  );
}

export function Muted({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const palette = usePalette();
  return <Text style={[styles.muted, { color: palette.mutedForeground }, style as object]}>{children}</Text>;
}

/** A number with its label, for dashboards. */
export function StatTile({ label, value, icon, tone = 'primary' }: { label: string; value: string | number; icon: IconName; tone?: 'primary' | 'success' | 'violet' | 'warning' }) {
  const palette = usePalette();
  const colors = {
    primary: [palette.primarySoft, palette.primary],
    success: [palette.successSoft, palette.success],
    violet: [palette.violetSoft, palette.violet],
    warning: [palette.warningSoft, palette.warning],
  }[tone];
  return (
    <View style={[styles.stat, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={[styles.statIcon, { backgroundColor: colors[0] }]}>
        <Icon name={icon} color={colors[1]} size={18} />
      </View>
      <Text style={[styles.statValue, { color: palette.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: palette.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatGrid({ children }: PropsWithChildren) {
  return <View style={styles.statGrid}>{children}</View>;
}

/** A tappable row: icon, title, details and a chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  last = false,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const body = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: palette.primarySoft }]}>
          <Icon name={icon} color={palette.primary} size={17} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: palette.mutedForeground }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} /> : null}
    </>
  );
  const style = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** A small coloured label, e.g. "NEET" or "Weak". */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'violet' }) {
  const palette = usePalette();
  const [bg, fg] = {
    neutral: [palette.secondary, palette.foreground],
    primary: [palette.primarySoft, palette.primaryInk],
    success: [palette.successSoft, palette.successInk],
    warning: [palette.warningSoft, palette.warningInk],
    danger: [palette.dangerSoft, palette.dangerInk],
    violet: [palette.violetSoft, palette.violet],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** A thin bar for "x% covered". */
export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'success' }) {
  const palette = usePalette();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.progressTrack, { backgroundColor: palette.secondary }]}
    >
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tone === 'success' ? palette.success : palette.primary }]} />
    </View>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={palette.primary} />
      <Text style={[styles.muted, { color: palette.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const palette = usePalette();
  return (
    <View style={styles.centered}>
      <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: palette.dangerInk, textAlign: 'center' }]}>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}>
        <Icon name={icon} color={palette.primary} size={26} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.foreground }]}>{title}</Text>
      <Text style={[styles.muted, { color: palette.mutedForeground, textAlign: 'center' }]}>{text}</Text>
      {action}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  const palette = usePalette();
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: palette.dangerInk }]}>
      {message}
    </Text>
  );
}

// ─── Inputs ────────────────────────────────────────────────────────────────

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string | null; ref?: React.Ref<TextInput> };

export function Field({ label, hint, error, style, ...input }: FieldProps) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.mutedForeground}
        {...input}
        style={[
          styles.input,
          { backgroundColor: palette.background, borderColor: error ? palette.danger : palette.border, color: palette.foreground },
          style,
        ]}
      />
      {error ? <ErrorText message={error} /> : hint ? <Text style={[styles.hint, { color: palette.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function PasswordField(props: FieldProps) {
  const palette = usePalette();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Field {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={styles.passwordInput} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.eye}
      >
        <Icon
          name={visible ? { ios: 'eye.slash', android: 'visibility_off' } : { ios: 'eye', android: 'visibility' }}
          color={palette.mutedForeground}
          size={18}
        />
      </Pressable>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const off = disabled || loading;
  const [bg, fg, border] =
    variant === 'primary'
      ? [palette.primary, palette.onPrimary, palette.primary]
      : variant === 'danger'
      ? [palette.dangerSoft, palette.dangerInk, palette.dangerBorder]
      : [palette.card, palette.foreground, palette.border];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={17} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Pick one of a few choices. */
export function Chips<T extends string>({
  label,
  choices,
  selected,
  onChange,
  labels,
}: {
  label?: string;
  choices: readonly T[];
  selected: T | null;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <ChipRow label={label} choices={choices} selected={selected ? [selected] : []} onPress={onChange} labels={labels} role="radio" />
  );
}

/** Pick any number of a few choices. */

export function MultiChips<T extends string>({
  label,
  choices,
  selected,
  onChange,
  labels,
}: {
  label?: string;
  choices: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  labels?: Partial<Record<T, string>>;
}) {
  const toggle = (value: T) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    onChange(choices.filter((c) => next.includes(c)));
  };
  return <ChipRow label={label} choices={choices} selected={selected} onPress={toggle} labels={labels} role="checkbox" />;
}

function ChipRow<T extends string>({
  label,
  choices,
  selected,
  onPress,
  labels,
  role,
}: {
  label?: string;
  choices: readonly T[];
  selected: T[];
  onPress: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  role: 'radio' | 'checkbox';
}) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: palette.mutedForeground }]}>{label}</Text> : null}
      <View style={styles.chipRow} accessibilityRole={role === 'radio' ? 'radiogroup' : undefined} accessibilityLabel={label}>
        {choices.map((choice) => {
          const on = selected.includes(choice);
          return (
            <Pressable
              key={choice}
              accessibilityRole={role}
              accessibilityState={{ checked: on }}
              onPress={() => onPress(choice)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: on ? palette.primarySoft : palette.card, borderColor: on ? palette.primary : palette.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: on ? palette.primaryInk : palette.foreground, fontWeight: on ? '700' : '500' }]}>
                {labels?.[choice] ?? choice}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Form sheet ────────────────────────────────────────────────────────────

/** A full-screen form: title, close, scrolling fields and a pinned save button. */
export function FormSheet({
  visible,
  title,
  onClose,
  children,
  submitLabel,
  onSubmit,
  submitting = false,
  error,
  extraAction,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
  /** e.g. a Delete button under the save button. */
  extraAction?: ReactNode;
}>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: palette.background }]}>
        <View style={[styles.sheetHeader, { borderBottomColor: palette.border, backgroundColor: palette.card, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }]}>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={18} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={[styles.sheetFooter, { borderTopColor: palette.border, backgroundColor: palette.card, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <ErrorText message={error} />
          <Button label={submitLabel} onPress={onSubmit} loading={submitting} />
          {extraAction}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A full-screen page over the tab, e.g. a batch's details: title, close, scrolling body. */
export function DetailSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  onRefresh,
  refreshing = false,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: palette.background }]}>
        <View style={[styles.sheetHeader, { borderBottomColor: palette.border, backgroundColor: palette.card, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }]}>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={18} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.sheetBody, { paddingBottom: footer ? 16 : Math.max(insets.bottom, 16) + 8 }]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} /> : undefined}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.sheetFooter, { borderTopColor: palette.border, backgroundColor: palette.card, paddingBottom: Math.max(insets.bottom, 12) }]}>
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** A row of label and value, for details. */
export function DetailRow({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: palette.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Data loading ──────────────────────────────────────────────────────────

/**
 * Loads data when the screen shows, when `deps` change and on reload; keeps
 * the last data while reloading, so pull-to-refresh doesn't blank the screen.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], { enabled = true }: { enabled?: boolean } = {}) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [round, setRound] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const key = `${JSON.stringify(deps)}#${round}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null }>({ key: '', data: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (cancelled) return;
        setResult({ key, data, error: null });
        setRefreshing(false);
      },
      (e: unknown) => {
        if (cancelled) return;
        setResult((prev) => ({ key, data: prev.data, error: e instanceof Error ? e.message : 'Something went wrong.' }));
        setRefreshing(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  const setData = useCallback((update: (prev: T | null) => T | null) => {
    setResult((prev) => ({ ...prev, data: update(prev.data) }));
  }, []);

  const pending = enabled && result.key !== key;
  return {
    data: result.data,
    setData,
    error: pending ? null : result.error,
    /** First load only; later reloads keep showing the last data. */
    loading: pending && result.data === null,
    refreshing,
    reload: () => setRound((n) => n + 1),
    refresh: () => {
      setRefreshing(true);
      setRound((n) => n + 1);
    },
  };
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 16, gap: 14 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  muted: { fontSize: 13, lineHeight: 18 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 52 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, minHeight: 200 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  errorText: { fontSize: 13, lineHeight: 18 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 16 },
  input: { borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: Platform.select({ ios: 12, default: 10 }), fontSize: 15, minHeight: 46 },
  passwordInput: { paddingRight: 44 },
  eye: { position: 'absolute', right: 12, top: 34, height: 28, justifyContent: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 18 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.2, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  chipText: { fontSize: 14 },
  pressed: { opacity: 0.75 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  sheetClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 16, gap: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sheetFooter: { padding: 16, gap: 10, borderTopWidth: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 4 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
