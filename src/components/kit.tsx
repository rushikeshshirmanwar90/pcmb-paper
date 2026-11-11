import React, { useCallback, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@/components/app-text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { AppHeader } from '@/components/app-header';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { confirmAction } from '@/components/confirm-action';
import { KeyboardAwareScrollView, KeyboardSafeView, useKeyboardVisible, useScrollIntoView } from '@/components/keyboard-safe-view';
import { getPalette, MaxContentWidth } from '@/constants/theme';
import { cachedLoad, loadShared } from '@/services/load-cache';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import type { ArtName } from '@/design/illustrations';
import { useLook } from '@/design/look';
import { neoAppPalette } from '@/design/palette';
import { useDesign, useIsDark } from '@/design/scope';
import { hardShadow, Neo } from '@/design/tokens';
import { statusWord, type StatusKind } from '@/design/status';
import {
  NeoBadge,
  NeoButton,
  NeoCard,
  NeoChipRow,
  NeoEmptyView,
  NeoErrorView,
  NeoIconButton,
  NeoText,
  NeoListRow,
  NeoMuted,
  NeoNotice,
  NeoProgressBar,
  NeoSectionTitle,
  NeoSegmented,
  NeoStatTile,
  NeoStatusChip,
} from '@/design/neo-kit';

// Building blocks for the tuition, teacher and student screens, so they share
// one look: a screen with a header, cards, form fields, buttons, chips and
// list rows, in the app's palette (light and dark).
//
// Two looks, one kit: inside the student design scope (design/scope.tsx) each
// component below renders its neobrutalism version from design/neo-kit.tsx;
// everywhere else it renders the classic version, unchanged.

export type Palette = ReturnType<typeof getPalette>;

export function usePalette(): Palette {
  const neo = useDesign() === 'neo';
  const dark = useIsDark();
  return neo ? neoAppPalette(dark) : getPalette(dark);
}

/** Picks the look for this part of the app (classic, or neo in the student scope). */
function useNeo() {
  return useDesign() === 'neo';
}

export type IconName = { ios: SFSymbol; android: AndroidSymbol };

const ICON_ACCENTS = ['primary', 'success', 'warning', 'danger', 'violet', 'info', 'highlight', 'primaryHover', 'brand', 'tabSelected'] as const;

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  const neo = useNeo();
  const dark = useIsDark();
  // Student look: an accent-coloured icon on a light surface fails contrast; icons are ink there.
  const p = neo ? neoAppPalette(dark) : null;
  const tint = p && ICON_ACCENTS.some((k) => p[k] === color) ? p.ink : color;
  return <SymbolView name={{ ios: name.ios, android: name.android, web: name.android }} tintColor={tint} size={size} />;
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
  headerRight,
  headerArt,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  /** Shown at the right of the header, e.g. the notifications bell (the workspace selector, when the account has one, follows it). */
  headerRight?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  /** Pinned under the content, above the tab bar. */
  footer?: ReactNode;
  /** Student look only: decorative art behind the header (a faint pattern). Hidden from screen readers. */
  headerArt?: ReactNode;
}>) {
  const palette = usePalette();
  const tabBarHeight = useTabBarHeight();
  const neo = useNeo();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.background }]}>
      {neo ? (
        <NeoHeader title={title} subtitle={subtitle} art={headerArt} right={<View style={styles.headerRight}>{headerRight}<WorkspaceSwitcher /></View>} />
      ) : (
      <AppHeader
        title={title}
        subtitle={subtitle}
        right={
          <View style={styles.headerRight}>
            {headerRight}
            <WorkspaceSwitcher />
          </View>
        }
      />
      )}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, neo && styles.neoContent, { paddingBottom: tabBarHeight + 24 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={neo ? palette.ink : palette.primary} colors={neo ? [palette.ink] : undefined} /> : undefined
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

/** The student look's tab header: big bold title on the cream page, one plain line under it, no rule. */
function NeoHeader({ title, subtitle, right, art }: { title: string; subtitle: string; right?: ReactNode; art?: ReactNode }) {
  return (
    <View style={styles.neoHeader}>
      {art ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          {art}
        </View>
      ) : null}
      <View style={styles.flexShrink}>
        <NeoText variant="title" accessibilityRole="header" numberOfLines={2}>
          {title}
        </NeoText>
        <NeoText variant="bodySm" soft numberOfLines={2}>
          {subtitle}
        </NeoText>
      </View>
      {right}
    </View>
  );
}

/** The header of a sheet or pushed page in the student look: title and a round close button. */
function NeoSheetHeader({ title, onClose, closeIcon = 'close' }: { title: string; onClose: () => void; closeIcon?: 'close' | 'back' }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.neoSheetHeader, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 10 }]}>
      {closeIcon === 'back' ? <NeoIconButton icon={{ ios: 'chevron.left', android: 'arrow_back' }} label="Back" shape="square" onPress={onClose} /> : null}
      <NeoText variant="heading" accessibilityRole="header" numberOfLines={2} style={styles.flexShrink}>
        {title}
      </NeoText>
      {closeIcon === 'close' ? <NeoIconButton icon={{ ios: 'xmark', android: 'close' }} label="Close" onPress={onClose} /> : null}
    </View>
  );
}
export { NeoSheetHeader };

// ─── Layout pieces ─────────────────────────────────────────────────────────

export function Card(props: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return useNeo() ? <NeoCard {...props} /> : <ClassicCard {...props} />;
}
export function SectionTitle(props: { title: string; action?: ReactNode }) {
  return useNeo() ? <NeoSectionTitle {...props} /> : <ClassicSectionTitle {...props} />;
}
export function Muted(props: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return useNeo() ? <NeoMuted {...props} /> : <ClassicMuted {...props} />;
}
export function StatTile(props: React.ComponentProps<typeof ClassicStatTile>) {
  return useNeo() ? <NeoStatTile {...props} /> : <ClassicStatTile {...props} />;
}
export function ListRow(props: React.ComponentProps<typeof ClassicListRow>) {
  return useNeo() ? <NeoListRow {...props} /> : <ClassicListRow {...props} />;
}
export function Badge(props: React.ComponentProps<typeof ClassicBadge>) {
  return useNeo() ? <NeoBadge {...props} /> : <ClassicBadge {...props} />;
}
export function ProgressBar(props: React.ComponentProps<typeof ClassicProgressBar>) {
  return useNeo() ? <NeoProgressBar {...props} /> : <ClassicProgressBar {...props} />;
}

/**
 * A status on a card ("Due today", "Done", "Missed"): colour + word + icon,
 * never colour alone, and the same everywhere (design/status.ts).
 */
export function StatusChip(props: { kind: StatusKind; word?: string }) {
  return useNeo() ? <NeoStatusChip {...props} /> : <ClassicStatusChip {...props} />;
}

const CLASSIC_STATUS_TONE: Record<StatusKind, 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'violet'> = {
  live: 'success',
  due: 'warning',
  new: 'primary',
  upcoming: 'neutral',
  done: 'success',
  missed: 'danger',
  locked: 'neutral',
};

function ClassicStatusChip({ kind, word }: { kind: StatusKind; word?: string }) {
  return <ClassicBadge label={statusWord(kind, word)} tone={CLASSIC_STATUS_TONE[kind]} />;
}

function ClassicCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }, style]}>{children}</View>;
}

function ClassicSectionTitle({ title, action }: { title: string; action?: ReactNode }) {
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

function ClassicMuted({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const palette = usePalette();
  return <Text style={[styles.muted, { color: palette.mutedForeground }, style as object]}>{children}</Text>;
}

/** A number with its label, for dashboards. */
function ClassicStatTile({
  label,
  value,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  icon: IconName;
  tone?: 'primary' | 'success' | 'violet' | 'warning' | 'danger' | 'neutral';
}) {
  const palette = usePalette();
  const colors = {
    primary: [palette.primarySoft, palette.primary],
    success: [palette.successSoft, palette.success],
    violet: [palette.violetSoft, palette.violet],
    warning: [palette.warningSoft, palette.warning],
    danger: [palette.dangerSoft, palette.danger],
    neutral: [palette.secondary, palette.mutedForeground],
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
function ClassicListRow({
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
function ClassicBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'violet' }) {
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
function ClassicProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'success' | 'danger' }) {
  const palette = usePalette();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.progressTrack, { backgroundColor: palette.secondary }]}
    >
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tone === 'success' ? palette.success : tone === 'danger' ? palette.danger : palette.primary }]} />
    </View>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

export function ErrorView(props: { message: string; onRetry?: () => void }) {
  return useNeo() ? <NeoErrorView {...props} /> : <ClassicErrorView {...props} />;
}
/** `art` (student look only): one of design/illustrations' stills instead of the icon sticker. */
export function EmptyView(props: { icon: IconName; title: string; text: string; action?: ReactNode; art?: ArtName }) {
  return useNeo() ? <NeoEmptyView {...props} /> : <ClassicEmptyView icon={props.icon} title={props.title} text={props.text} action={props.action} />;
}

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={useNeo() ? palette.ink : palette.primary} />
      <Text style={[styles.muted, { color: palette.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ClassicErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
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

function ClassicEmptyView({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
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
  // Android reads it through the live region; VoiceOver needs telling.
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: palette.dangerInk }]}>
      {message}
    </Text>
  );
}

// ─── Inputs ────────────────────────────────────────────────────────────────

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  /** A small control at the trailing end of the box, e.g. show password. */
  accessory?: ReactNode;
  ref?: React.Ref<TextInputInstance>;
};

export function Field({ label, hint, error, accessory, style, onFocus, onBlur, ...input }: FieldProps) {
  const palette = usePalette();
  const scrollIntoView = useScrollIntoView();
  const group = useRef<ViewInstance>(null);
  const [focused, setFocused] = useState(false);
  const look = useLook();
  const borderColor = error ? palette.danger : focused ? palette.primary : palette.input;
  const box = (
    <TextInput
      accessibilityLabel={label}
      accessibilityHint={error || hint}
      placeholderTextColor={palette.mutedForeground}
      {...input}
      onFocus={(e) => {
        setFocused(true);
        // The whole group (label, input, helper or error), not just the input, is brought into view.
        scrollIntoView?.(group.current);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        { backgroundColor: palette.background, borderColor, color: palette.foreground },
        look.neo && { borderWidth: 0, borderRadius: Neo.radius.md - 2, backgroundColor: focused ? palette.primarySoft : palette.card, minHeight: 48 },
        style,
      ]}
    />
  );
  // Student look: the outline and hard shadow sit on a wrapper (a shadow on TextInput is unreliable on Android).
  const edge = error ? palette.dangerInk : palette.ink;
  const framed = look.neo ? <View style={[look.frame('md', 'md'), { borderColor: edge, backgroundColor: palette.card }, hardShadow(Neo.shadow.md, edge)]}>{box}</View> : box;
  return (
    <View ref={group} style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.mutedForeground }, look.neo && styles.neoFieldLabel]}>{label}</Text>
      {accessory ? (
        <View>
          {framed}
          <View style={[styles.accessory, look.neo && styles.neoAccessory]}>{accessory}</View>
        </View>
      ) : (
        framed
      )}
      {error ? <ErrorText message={error} /> : hint ? <Text style={[styles.hint, { color: palette.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function PasswordField({ style, ...props }: FieldProps) {
  const palette = usePalette();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      style={[style, styles.passwordInput]}
      accessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((v) => !v)}
          style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
        >
          <Icon
            name={visible ? { ios: 'eye.slash', android: 'visibility_off' } : { ios: 'eye', android: 'visibility' }}
            color={palette.mutedForeground}
            size={20}
          />
        </Pressable>
      }
    />
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** primary: the one main action of a view; tonal: a quieter accent action; ghost: a text-only tertiary action (student look; classic shows it as secondary). */
  variant?: 'primary' | 'tonal' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Student look only: lg is the full-width button pinned at the bottom of a screen (classic ignores it). */
  size?: 'sm' | 'md' | 'lg';
};

export function Button({ size, ...props }: ButtonProps) {
  const neo = useNeo();
  if (neo) return <NeoButton {...props} size={size} />;
  return <ClassicButton {...props} variant={props.variant === 'ghost' ? 'secondary' : props.variant} />;
}

function ClassicButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  /** primary: the one main action of a view; tonal: a quieter accent action, e.g. one of several in a list. */
  variant?: 'primary' | 'tonal' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const off = disabled || loading;
  const [bg, fg, border] =
    variant === 'primary'
      ? [palette.primary, palette.onPrimary, palette.primary]
      : variant === 'tonal'
      ? [palette.primarySoft, palette.primaryInk, palette.primaryBorder]
      : variant === 'danger'
      ? [palette.dangerSoft, palette.dangerInk, palette.dangerBorder]
      : [palette.card, palette.foreground, palette.border];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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

function ChipRow<T extends string>(props: {
  label?: string;
  choices: readonly T[];
  selected: T[];
  onPress: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  role: 'radio' | 'checkbox';
}) {
  return useNeo() ? <NeoChipRow {...props} /> : <ClassicChipRow {...props} />;
}

function ClassicChipRow<T extends string>({
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

/**
 * Switches between closely related views of the same content, e.g. All /
 * Wrong / Skipped answers. Each segment can show a count.
 */
export function Segmented<T extends string>(props: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return useNeo() ? <NeoSegmented {...props} /> : <ClassicSegmented {...props} />;
}

function ClassicSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers, e.g. "Show answers". */
  label?: string;
}) {
  const palette = usePalette();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: palette.secondary }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.count === undefined ? o.label : `${o.label}, ${o.count}`}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segment,
              on && { backgroundColor: palette.card, borderColor: palette.border },
              pressed && !on && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, { color: on ? palette.foreground : palette.inkSoft, fontWeight: on ? '700' : '600' }]}>
              {o.label}
            </Text>
            {o.count !== undefined ? (
              <Text style={[styles.segmentCount, { color: on ? palette.primaryInk : palette.inkSoft }]}>{o.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const NOTICE_ICONS: Record<'info' | 'success' | 'warning' | 'danger', IconName> = {
  info: { ios: 'info.circle', android: 'info' },
  success: { ios: 'checkmark.circle', android: 'check_circle' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  danger: { ios: 'exclamationmark.octagon', android: 'error' },
};

/** A short inline message in the flow of the screen: info, success, a warning or a problem. */
export function Notice(props: React.ComponentProps<typeof ClassicNotice>) {
  return useNeo() ? <NeoNotice {...props} /> : <ClassicNotice {...props} />;
}

function ClassicNotice({
  tone = 'info',
  title,
  text,
  icon,
  onDismiss,
  live = false,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  text?: string;
  icon?: IconName;
  onDismiss?: () => void;
  /** Announce it to screen readers when it appears. */
  live?: boolean;
}) {
  const palette = usePalette();
  const message = [title, text].filter(Boolean).join('. ');
  // accessibilityLiveRegion below is Android-only; VoiceOver needs telling.
  useEffect(() => {
    if (live && Platform.OS === 'ios' && message) AccessibilityInfo.announceForAccessibility(message);
  }, [live, message]);
  const [bg, fg, border] = {
    info: [palette.secondary, palette.foreground, palette.border],
    success: [palette.successSoft, palette.successInk, palette.successBorder],
    warning: [palette.warningSoft, palette.warningInk, palette.warningBorder],
    danger: [palette.dangerSoft, palette.dangerInk, palette.dangerBorder],
  }[tone];
  return (
    <View accessibilityLiveRegion={live ? 'polite' : undefined} style={[styles.notice, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.noticeIcon}>
        <Icon name={icon ?? NOTICE_ICONS[tone]} color={fg} size={18} />
      </View>
      <View style={styles.flex}>
        {title ? <Text style={[styles.noticeTitle, { color: fg }]}>{title}</Text> : null}
        {text ? <Text style={[styles.noticeText, { color: tone === 'info' ? palette.mutedForeground : fg }]}>{text}</Text> : null}
      </View>
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} style={({ pressed }) => [styles.noticeClose, pressed && styles.pressed]}>
          <Icon name={{ ios: 'xmark', android: 'close' }} color={fg} size={15} />
        </Pressable>
      ) : null}
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
  dirty = false,
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
  /** There are unsaved changes: closing (the X, Android's Back or the swipe) asks first. */
  dirty?: boolean;
}>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const close = () => (dirty && !submitting ? confirmAction('Discard changes?', 'Your unsaved changes will be lost.', 'Discard', onClose) : onClose());
  const neo = useNeo();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardSafeView style={{ backgroundColor: palette.background }}>
        {neo ? <NeoSheetHeader title={title} onClose={close} /> : (
        <View style={[styles.sheetHeader, { borderBottomColor: palette.border, backgroundColor: palette.card, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }]}>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={10} style={styles.sheetClose}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={18} />
          </Pressable>
        </View>
        )}
        <KeyboardAwareScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </KeyboardAwareScrollView>
        <View style={[styles.sheetFooter, { borderTopColor: palette.border, backgroundColor: palette.card, paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) }, neo && styles.neoSheetFooter, neo && { backgroundColor: palette.background }]}>
          <ErrorText message={error} />
          <Button label={submitLabel} onPress={onSubmit} loading={submitting} />
          {extraAction}
        </View>
      </KeyboardSafeView>
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
  scrollRef,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const neo = useNeo();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: palette.background }]}>
        {neo ? <NeoSheetHeader title={title} onClose={onClose} /> : (
        <View style={[styles.sheetHeader, { borderBottomColor: palette.border, backgroundColor: palette.card, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }]}>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <Icon name={{ ios: 'xmark', android: 'close' }} color={palette.foreground} size={18} />
          </Pressable>
        </View>
        )}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.sheetBody, { paddingBottom: footer ? 16 : Math.max(insets.bottom, 16) + 8 }]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={neo ? palette.ink : palette.primary} /> : undefined}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.sheetFooter, { borderTopColor: palette.border, backgroundColor: palette.card, paddingBottom: Math.max(insets.bottom, 12) }, neo && styles.neoSheetFooter, neo && { backgroundColor: palette.background }]}>
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
 *
 * With a `cacheKey` the screen starts from the last answer for that key (if
 * any, see load-cache.ts) and refreshes it quietly, and a request for the same
 * key already under way is shared. The key names the request, so it must not
 * change while the screen is open, and must include everything `deps` does.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], { enabled = true, cacheKey }: { enabled?: boolean; cacheKey?: string } = {}) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [round, setRound] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const key = `${JSON.stringify(deps)}#${round}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null }>(() => ({
    key: '',
    data: (cacheKey ? cachedLoad<T>(cacheKey) : undefined) ?? null,
    error: null,
  }));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // A reload or refresh (round > 0) sends its own request rather than joining one under way.
    (cacheKey ? loadShared(cacheKey, loadRef.current, { fresh: round > 0 }) : loadRef.current()).then(
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
  }, [key, round, enabled, cacheKey]);

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
  flexShrink: { flex: 1, minWidth: 0 },
  // Student look
  neoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Neo.screenPadding, paddingTop: 12, paddingBottom: 8, minHeight: 72, width: '100%', maxWidth: 900, alignSelf: 'center' },
  neoContent: { gap: 16, paddingTop: 8 },
  neoSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Neo.screenPadding, paddingBottom: 10 },
  neoSheetFooter: { borderTopWidth: Neo.border.width },
  neoFieldLabel: { fontSize: 14, fontWeight: '600' },
  neoAccessory: { right: 4 + Neo.shadow.md, bottom: Neo.shadow.md },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 16, gap: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  passwordInput: { paddingRight: 52 },
  // Centred on the box itself, so it stays put when a larger text size makes the label taller.
  accessory: { position: 'absolute', top: 0, bottom: 0, right: 4, justifyContent: 'center' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 18 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.2, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  chipText: { fontSize: 14 },
  pressed: { opacity: 0.75 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: { fontSize: 14, flexShrink: 1 },
  segmentCount: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 4 },
  noticeIcon: { paddingTop: 1 },
  noticeTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  noticeText: { fontSize: 13, lineHeight: 18 },
  noticeClose: { width: 44, height: 44, marginVertical: -10, alignItems: 'center', justifyContent: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  sheetClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 16, gap: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sheetFooter: { padding: 16, gap: 10, borderTopWidth: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 4 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});

// ─── One-time code ─────────────────────────────────────────────────────────

/**
 * Six boxes for a 6-digit code. One hidden input takes the typing, so paste
 * and the phone's "code from Messages/Gmail" autofill work.
 */
export function CodeInput({ value, onChange, onComplete, autoFocus = true }: { value: string; onChange: (code: string) => void; onComplete?: (code: string) => void; autoFocus?: boolean }) {
  const palette = usePalette();
  const look = useLook();
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');
  return (
    <Pressable accessibilityLabel={`Code, ${value.length} of 6 digits entered`} onPress={() => ref.current?.focus()} style={codeStyles.row}>
      {Array.from({ length: 6 }, (_, i) => {
        const active = focused && (i === value.length || (value.length === 6 && i === 5));
        return (
          <View
            key={i}
            style={[
              codeStyles.box,
              { borderColor: active ? palette.primary : digits[i] ? palette.borderStrong : palette.input, backgroundColor: palette.card },
              look.frame('sm', 'sm'),
              look.neo && active && { backgroundColor: palette.primarySoft },
            ]}
          >
            <Text style={[codeStyles.digit, { color: palette.foreground }]}>{digits[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const code = t.replace(/\D/g, '').slice(0, 6);
          onChange(code);
          if (code.length === 6) onComplete?.(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        caretHidden
        style={codeStyles.hidden}
      />
    </Pressable>
  );
}

const codeStyles = StyleSheet.create({
  // The boxes share the width, so six of them fit on the narrowest phones.
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignSelf: 'stretch' },
  box: { flex: 1, maxWidth: 52, height: 56, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
