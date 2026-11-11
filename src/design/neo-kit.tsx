import React, { createContext, useContext, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import type { IconName } from '@/components/kit';
import { haptic as hx } from '@/design/haptics';
import { neoAppPalette, type NeoPalette } from '@/design/palette';
import { useIsDark } from '@/design/scope';
import { STATUS, statusWord, type StatusKind } from '@/design/status';
import { hardShadow, Neo, textStyles, type TextVariant } from '@/design/tokens';
import { chipsFor, subjectsLabel, subjectsOf } from '@/shared/subjects';

// The student look (neobrutalism): 2px ink outlines, hard zero-blur shadows,
// flat fills, press-into-shadow buttons. Each component takes the same props
// as the classic kit component it stands in for; kit.tsx picks one or the
// other from the design scope. Only rendered in the student scope.

export function useNeoPalette(): NeoPalette {
  return neoAppPalette(useIsDark());
}

const PRESS_SPRING = { damping: 22, stiffness: 600, mass: 0.6 };

// ─── Ink: readable text on any fill ────────────────────────────────────────

export type Tone =
  | 'surface' | 'subtle' | 'ink' | 'highlight'
  | 'primary' | 'primarySoft' | 'success' | 'successSoft' | 'danger' | 'dangerSoft'
  | 'warning' | 'warningSoft' | 'violet' | 'violetSoft' | 'info' | 'infoSoft';

const InkContext = createContext<string | null>(null);

/** Text and icon colour for the surface underneath. */
export function useInk() {
  const p = useNeoPalette();
  return useContext(InkContext) ?? p.ink;
}

export const toneFill = (p: NeoPalette, t: Tone) => p[t];
/** Surfaces and soft tints → ink; ink → canvas; accents → onAccent (dark in both modes). */
export const onFill = (p: NeoPalette, t: Tone) => (t === 'surface' || t === 'subtle' || t.endsWith('Soft') ? p.ink : t === 'ink' ? p.canvas : p.onAccent);

export function NeoIcon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const ink = useInk();
  return <SymbolView name={{ ios: name.ios, android: name.android, web: name.android }} tintColor={color ?? ink} size={size} />;
}

// ─── NeoText ───────────────────────────────────────────────────────────────

export function NeoText({ variant = 'body', soft, style, ...rest }: TextProps & { variant?: TextVariant; soft?: boolean }) {
  const p = useNeoPalette();
  const ink = useInk();
  const plain = ink === p.ink;
  const quiet = variant === 'overline' || soft;
  const big = variant === 'display' || variant === 'title' || variant === 'overline';
  return (
    <Text
      maxFontSizeMultiplier={big ? 1.3 : 1.6}
      {...rest}
      style={[textStyles[variant], styles.noPad, { color: quiet && plain ? p.inkSoft : ink }, quiet && !plain && styles.softOnFill, style]}
    />
  );
}

// ─── PressableNeo ──────────────────────────────────────────────────────────

type PressableNeoProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  tone?: Tone;
  radius?: number;
  /** The visible shadow (0 = flat). */
  offset?: number;
  /** Space always kept for the shadow, so nothing shifts when it changes. */
  reserve?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  /** Fires on commit (onPress), never on press-in. */
  haptic?: 'select' | 'tap' | false;
  busy?: boolean;
};

/** The core pressable: the face slides into its hard shadow, like a physical key. */
export function PressableNeo({
  children,
  tone = 'surface',
  radius = Neo.radius.md,
  offset = Neo.shadow.md,
  reserve,
  borderColor,
  style,
  faceStyle,
  haptic = false,
  busy,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableNeoProps) {
  const p = useNeoPalette();
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0);
  const inactive = !!disabled || !!busy;
  const space = reserve ?? offset;
  const face = useAnimatedStyle(() => ({ transform: [{ translateX: pressed.value * offset }, { translateY: pressed.value * offset }] }));
  // Reduce Motion: the shift still happens (it is feedback), just without the spring.
  const to = (v: number) => (reduce ? withTiming(v, { duration: 0 }) : withSpring(v, PRESS_SPRING));
  return (
    <Pressable
      {...rest}
      disabled={inactive}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ ...rest.accessibilityState, disabled: !!disabled, busy: !!busy }}
      onPressIn={(e) => {
        if (!inactive) pressed.set(to(1));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(to(0));
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (haptic === 'tap') hx.tap();
        else if (haptic === 'select') hx.select();
        onPress?.(e);
      }}
      style={[{ paddingRight: space, paddingBottom: space, opacity: disabled ? 0.5 : 1 }, Platform.OS === 'web' && ({ cursor: inactive ? 'default' : 'pointer' } as ViewStyle), style]}
    >
      {offset > 0 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: offset, top: offset, right: space - offset, bottom: space - offset, borderRadius: radius, backgroundColor: p.ink }} />
      ) : null}
      <Animated.View style={[{ backgroundColor: toneFill(p, tone), borderRadius: radius, borderWidth: Neo.border.width, borderColor: borderColor ?? p.ink }, faceStyle, face]}>
        <InkContext.Provider value={onFill(p, tone)}>{children}</InkContext.Provider>
      </Animated.View>
    </Pressable>
  );
}

// ─── Card, section title, muted ────────────────────────────────────────────

export function NeoCard({ children, style, tone = 'surface', elevation = 'md' }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; tone?: Tone; elevation?: 'none' | 'sm' | 'md' }>) {
  const p = useNeoPalette();
  const s = elevation === 'none' ? 0 : Neo.shadow[elevation];
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: toneFill(p, tone), borderColor: p.ink, marginRight: s, marginBottom: s, ...hardShadow(s, p.ink) },
        style,
      ]}
    >
      <InkContext.Provider value={onFill(p, tone)}>{children}</InkContext.Provider>
    </View>
  );
}

/** A section heading with an ink rule running to the edge. */
export function NeoSectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const p = useNeoPalette();
  return (
    <View style={styles.sectionRow}>
      <NeoText variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.shrink}>
        {title}
      </NeoText>
      <View style={[styles.rule, { backgroundColor: p.ink }]} />
      {action}
    </View>
  );
}

export function NeoMuted({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <NeoText variant="bodySm" soft style={style as object}>
      {children}
    </NeoText>
  );
}

// ─── Buttons ───────────────────────────────────────────────────────────────

export type NeoButtonVariant = 'primary' | 'tonal' | 'secondary' | 'danger' | 'ghost';

const BUTTON_TONE: Record<Exclude<NeoButtonVariant, 'ghost'>, Tone> = {
  primary: 'primary',
  tonal: 'primarySoft',
  secondary: 'surface',
  danger: 'dangerSoft',
};

export function NeoButton({
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
  variant?: NeoButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = useNeoPalette();
  if (variant === 'ghost') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled || loading}
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [styles.ghost, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }, style]}
      >
        {loading ? <ActivityIndicator color={p.ink} /> : null}
        <NeoText variant="label" style={styles.ghostText}>
          {label}
        </NeoText>
      </Pressable>
    );
  }
  return (
    <PressableNeo
      tone={BUTTON_TONE[variant]}
      onPress={onPress}
      disabled={disabled}
      busy={loading}
      haptic={variant === 'primary' ? 'tap' : false}
      radius={Neo.radius.button}
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
      faceStyle={styles.buttonFace}
    >
      <ButtonContent label={label} icon={icon} loading={loading} danger={variant === 'danger'} />
    </PressableNeo>
  );
}

function ButtonContent({ label, icon, loading, danger }: { label: string; icon?: IconName; loading?: boolean; danger?: boolean }) {
  const p = useNeoPalette();
  const ink = useInk();
  const color = danger ? p.dangerInk : ink;
  return (
    <>
      {loading ? <ActivityIndicator color={color} /> : icon ? <NeoIcon name={icon} size={18} color={color} /> : null}
      <NeoText variant="subheading" numberOfLines={1} style={[styles.buttonLabel, { color }]}>
        {label}
      </NeoText>
    </>
  );
}

// ─── Badges, status, subjects, chips ───────────────────────────────────────

const BADGE_TONE: Record<'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'violet', Tone> = {
  neutral: 'subtle',
  primary: 'primarySoft',
  success: 'successSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  violet: 'violetSoft',
};

/** A small label ("NEET", "Weak"): bordered, flat (it isn't tappable). */
export function NeoBadge({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof BADGE_TONE }) {
  const p = useNeoPalette();
  const t = BADGE_TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneFill(p, t), borderColor: p.ink }]}>
      <Text maxFontSizeMultiplier={1.3} style={[textStyles.caption, styles.noPad, styles.badgeText, { color: onFill(p, t) }]}>
        {label}
      </Text>
    </View>
  );
}

/** "Due today", "Done", "Missed": colour + word + icon, the same on every screen. */
export function NeoStatusChip({ kind, word }: { kind: StatusKind; word?: string }) {
  const p = useNeoPalette();
  const look = STATUS[kind];
  const ink = onFill(p, look.tone);
  return (
    <View accessible accessibilityLabel={statusWord(kind, word)} style={[styles.status, { backgroundColor: toneFill(p, look.tone), borderColor: p.ink }]}>
      <NeoIcon name={look.icon as IconName} size={13} color={ink} />
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[textStyles.caption, styles.noPad, styles.badgeText, { color: ink }]}>
        {statusWord(kind, word)}
      </Text>
    </View>
  );
}

export function NeoSubjectChips({ subjects, max = 3 }: { subjects: string | string[] | null | undefined; max?: number }) {
  const p = useNeoPalette();
  const list = Array.isArray(subjects) ? subjects : subjectsOf(subjects);
  if (!list.length) return null;
  const { shown, more } = chipsFor(list, max);
  return (
    <View accessible accessibilityLabel={subjectsLabel(list)} style={styles.subjectRow}>
      {shown.map((s) => (
        <View key={s} style={[styles.subject, { backgroundColor: p.violetSoft, borderColor: p.ink }]}>
          <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[textStyles.caption, styles.noPad, { color: p.ink, fontFamily: textStyles.label.fontFamily }]}>
            {s}
          </Text>
        </View>
      ))}
      {more ? <NeoText variant="caption" soft>+{more}</NeoText> : null}
    </View>
  );
}

/** One choice in a filter row: selected → primary fill. The shadow space is always kept. */
export function NeoChip({ label, selected, onPress, role }: { label: string; selected: boolean; onPress: () => void; role: 'radio' | 'checkbox' }) {
  return (
    <PressableNeo
      tone={selected ? 'primary' : 'surface'}
      radius={Neo.radius.full}
      offset={Neo.shadow.sm}
      haptic="select"
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      faceStyle={styles.chipFace}
    >
      <NeoText variant="label">{label}</NeoText>
    </PressableNeo>
  );
}

export function NeoChipRow<T extends string>({
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
  return (
    <View style={styles.field}>
      {label ? <NeoText variant="label">{label}</NeoText> : null}
      <View style={styles.chipRow} accessibilityRole={role === 'radio' ? 'radiogroup' : undefined} accessibilityLabel={label}>
        {choices.map((c) => (
          <NeoChip key={c} label={labels?.[c] ?? c} selected={selected.includes(c)} onPress={() => onPress(c)} role={role} />
        ))}
      </View>
    </View>
  );
}

/** Related views of one thing. Where you are → highlight (not primary, which means "chosen"). */
export function NeoSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  const p = useNeoPalette();
  return (
    <View style={[styles.segmentedOuter, { borderRadius: Neo.radius.md, ...hardShadow(Neo.shadow.md, p.ink) }]}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.segmented, { borderColor: p.ink, backgroundColor: p.surface }]}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.count === undefined ? o.label : `${o.label}, ${o.count}`}
              onPress={() => onChange(o.value)}
              style={[styles.segment, i > 0 && { borderLeftWidth: Neo.border.width, borderLeftColor: p.ink }, { backgroundColor: on ? p.highlight : 'transparent' }]}
            >
              <InkContext.Provider value={on ? p.onAccent : p.ink}>
                <NeoText variant="label" numberOfLines={1} style={styles.shrink}>
                  {o.label}
                </NeoText>
                {o.count !== undefined ? (
                  <NeoText variant="label" style={styles.tabular}>
                    {o.count}
                  </NeoText>
                ) : null}
              </InkContext.Provider>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Progress, stats ───────────────────────────────────────────────────────

/** A paper strip: bordered track, fill with an ink edge. `value` is 0–100, like the classic bar. */
export function NeoProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'success' | 'danger' }) {
  const p = useNeoPalette();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const fill = tone === 'success' ? p.success : tone === 'danger' ? p.danger : p.primary;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={[styles.trackOuter, hardShadow(Neo.shadow.sm, p.ink)]}>
      <View style={[styles.track, { borderColor: p.ink, backgroundColor: p.surface }]}>
        <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: fill, borderRightWidth: pct > 0 && pct < 100 ? 2 : 0, borderColor: p.ink }]} />
      </View>
    </View>
  );
}

const STAT_TONE: Record<'primary' | 'success' | 'violet' | 'warning' | 'danger' | 'neutral', Tone> = {
  primary: 'primarySoft',
  success: 'successSoft',
  violet: 'violetSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  neutral: 'surface',
};

/** A big number with its label. */
export function NeoStatTile({ label, value, icon, tone = 'primary' }: { label: string; value: string | number; icon: IconName; tone?: keyof typeof STAT_TONE }) {
  return (
    <NeoCard tone={STAT_TONE[tone]} style={styles.stat}>
      <View style={styles.statTop}>
        <NeoIcon name={icon} size={16} />
        <NeoText variant="overline" numberOfLines={1} style={styles.shrink}>
          {label}
        </NeoText>
      </View>
      <NeoText variant="number" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </NeoText>
    </NeoCard>
  );
}

// ─── Rows ──────────────────────────────────────────────────────────────────

/** A row inside a card: icon tile, title, details, a chevron when it opens a page. */
export function NeoListRow({
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
  const p = useNeoPalette();
  const body = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: p.primarySoft, borderColor: p.ink }]}>
          <NeoIcon name={icon} size={17} color={p.ink} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <NeoText variant="subheading" numberOfLines={1}>
          {title}
        </NeoText>
        {subtitle ? (
          <NeoText variant="caption" soft numberOfLines={2}>
            {subtitle}
          </NeoText>
        ) : null}
      </View>
      {right}
      {onPress ? <NeoIcon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} color={p.ink} /> : null}
    </>
  );
  const divider = !last && { borderBottomWidth: Neo.border.width, borderBottomColor: p.ink };
  // Rows navigate: a tinted press, no shift and no haptic.
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.row, divider, pressed && { backgroundColor: p.subtle }]}>
      {body}
    </Pressable>
  ) : (
    <View style={[styles.row, divider]}>{body}</View>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

/** Why it's empty, and the one action that fills it. */
export function NeoEmptyView({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  const p = useNeoPalette();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: p.highlight, borderColor: p.ink, ...hardShadow(Neo.shadow.md, p.ink) }]}>
        <NeoIcon name={icon} size={28} color={p.onAccent} />
      </View>
      <NeoText variant="heading" style={styles.center}>
        {title}
      </NeoText>
      <NeoText variant="bodySm" soft style={[styles.center, styles.emptyText]}>
        {text}
      </NeoText>
      {action}
    </View>
  );
}

/** What went wrong in plain words, and Try again. Calm: no red. */
export function NeoErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <NeoIcon name={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} size={28} />
      <NeoText variant="subheading" accessibilityLiveRegion="polite" style={styles.center}>
        {message}
      </NeoText>
      {onRetry ? <NeoButton label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const NOTICE: Record<'info' | 'success' | 'warning' | 'danger', { tone: Tone; icon: IconName }> = {
  info: { tone: 'infoSoft', icon: { ios: 'info.circle', android: 'info' } },
  success: { tone: 'successSoft', icon: { ios: 'checkmark.circle', android: 'check_circle' } },
  warning: { tone: 'warningSoft', icon: { ios: 'exclamationmark.triangle', android: 'warning' } },
  danger: { tone: 'dangerSoft', icon: { ios: 'exclamationmark.octagon', android: 'error' } },
};

export function NeoNotice({ tone = 'info', title, text, icon, onDismiss, live = false }: { tone?: keyof typeof NOTICE; title?: string; text?: string; icon?: IconName; onDismiss?: () => void; live?: boolean }) {
  const look = NOTICE[tone];
  return (
    <NeoCard tone={look.tone} elevation="sm" style={styles.notice}>
      <View accessibilityLiveRegion={live ? 'polite' : undefined} style={styles.noticeRow}>
        <NeoIcon name={icon ?? look.icon} size={18} />
        <View style={styles.flex}>
          {title ? <NeoText variant="subheading">{title}</NeoText> : null}
          {text ? <NeoText variant="bodySm" soft>{text}</NeoText> : null}
        </View>
        {onDismiss ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={10} style={styles.noticeClose}>
            <NeoIcon name={{ ios: 'xmark', android: 'close' }} size={15} />
          </Pressable>
        ) : null}
      </View>
    </NeoCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  noPad: Platform.OS === 'android' ? { includeFontPadding: false } : {},
  softOnFill: { opacity: 0.8 },
  card: { borderWidth: Neo.border.width, borderRadius: Neo.radius.lg, padding: Neo.space.lg, gap: Neo.space.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  rule: { flex: 1, height: 2, minWidth: 16 },
  buttonFace: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonLabel: { flexShrink: 1 },
  ghost: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4 },
  ghostText: { textDecorationLine: 'underline' },
  badge: { alignSelf: 'flex-start', borderWidth: Neo.border.width, borderRadius: Neo.radius.full, paddingHorizontal: 10, minHeight: 26, justifyContent: 'center' },
  badgeText: { fontFamily: textStyles.label.fontFamily },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: Neo.border.width, borderRadius: Neo.radius.full, paddingHorizontal: 10, minHeight: 28 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  subject: { borderWidth: Neo.border.width, borderRadius: Neo.radius.sm, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 160 },
  field: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipFace: { paddingHorizontal: 14, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentedOuter: { marginRight: Neo.shadow.md, marginBottom: Neo.shadow.md },
  segmented: { flexDirection: 'row', borderWidth: Neo.border.width, borderRadius: Neo.radius.md, overflow: 'hidden' },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8 },
  trackOuter: { borderRadius: Neo.radius.full, marginRight: Neo.shadow.sm, marginBottom: Neo.shadow.sm },
  track: { height: 16, borderRadius: Neo.radius.full, borderWidth: Neo.border.width, padding: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: Neo.radius.full },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, gap: 4, padding: Neo.space.md },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: Neo.radius.sm, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 12 },
  emptyIcon: { width: 60, height: 60, borderRadius: Neo.radius.xl, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyText: { maxWidth: 320 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, minHeight: 200 },
  notice: { padding: Neo.space.md },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
});
