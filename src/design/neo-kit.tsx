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
import Svg, { Path } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';
import type { IconName } from '@/components/kit';
import { haptic as hx } from '@/design/haptics';
import { neoAppPalette, type NeoPalette } from '@/design/palette';
import { useFontOption, useIsDark } from '@/design/scope';
import { STATUS, statusWord, type StatusKind } from '@/design/status';
import { FONT_OPTIONS, hardShadow, Neo, typeScale, type FontOption, type TextStyles, type TextVariant } from '@/design/tokens';
import { chipsFor, subjectsLabel, subjectsOf } from '@/shared/subjects';

// The student look (neobrutalism, warm yellow): 2px ink outlines, hard
// zero-blur shadows, flat fills, press-into-shadow buttons, scalloped
// stickers. Components that stand in for a classic kit component take the
// same props; kit.tsx picks one look or the other from the design scope.
// Only rendered in the student scope.

export function useNeoPalette(): NeoPalette {
  return neoAppPalette(useIsDark());
}

const scales: Partial<Record<FontOption, TextStyles>> = {};
/** The type scale in the scope's font. */
export function useType(): TextStyles {
  const option = useFontOption();
  return (scales[option] ??= typeScale(FONT_OPTIONS[option]));
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
/** Surfaces and soft tints → ink; ink → canvas; accents → onAccent (near-black in both modes). */
export const onFill = (p: NeoPalette, t: Tone) => (t === 'surface' || t === 'subtle' || t.endsWith('Soft') ? p.ink : t === 'ink' ? p.canvas : p.onAccent);

export function NeoIcon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const ink = useInk();
  return <SymbolView name={{ ios: name.ios, android: name.android, web: name.android }} tintColor={color ?? ink} size={size} />;
}

/** An icon in a small ink circle (the reference's "↗ Transfer" look). */
function IconCircle({ name, size = 26 }: { name: IconName; size?: number }) {
  const p = useNeoPalette();
  const ink = useInk();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' }}>
      <NeoIcon name={name} size={Math.round(size * 0.55)} color={ink === p.ink ? p.canvas : p.surface} />
    </View>
  );
}

// ─── NeoText ───────────────────────────────────────────────────────────────

export function NeoText({ variant = 'body', soft, style, ...rest }: TextProps & { variant?: TextVariant; soft?: boolean }) {
  const p = useNeoPalette();
  const type = useType();
  const ink = useInk();
  const plain = ink === p.ink;
  const quiet = variant === 'overline' || soft;
  const big = variant === 'display' || variant === 'title' || variant === 'overline' || variant === 'bigNumber';
  return (
    <Text
      maxFontSizeMultiplier={big ? 1.3 : 1.6}
      {...rest}
      style={[type[variant], styles.noPad, { color: quiet && plain ? p.inkSoft : ink }, quiet && !plain && styles.softOnFill, style]}
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

/** The core pressable: the face slides onto its hard shadow, like a physical key. */
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

export function NeoCard({ children, style, tone = 'surface', elevation = 'md' }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; tone?: Tone; elevation?: 'none' | 'sm' | 'md' | 'lg' }>) {
  const p = useNeoPalette();
  const s = elevation === 'none' ? 0 : Neo.shadow[elevation];
  return (
    <View style={[styles.card, { backgroundColor: toneFill(p, tone), borderColor: p.ink, marginRight: s, marginBottom: s, ...hardShadow(s, p.ink) }, style]}>
      <InkContext.Provider value={onFill(p, tone)}>{children}</InkContext.Provider>
    </View>
  );
}

/** A section heading; the optional action sits at the right ("See all"). */
export function NeoSectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <NeoText variant="heading" accessibilityRole="header" numberOfLines={2} style={styles.flex}>
        {title}
      </NeoText>
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
  tone,
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  variant?: NeoButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Fill override for side-by-side actions (e.g. a pink second action). */
  tone?: Tone;
  /** lg: the full-width button pinned at the bottom of a screen. */
  size?: 'sm' | 'md' | 'lg';
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
      tone={tone ?? BUTTON_TONE[variant]}
      onPress={onPress}
      disabled={disabled}
      busy={loading}
      haptic={variant === 'primary' ? 'tap' : false}
      radius={Neo.radius.button}
      offset={size === 'sm' ? Neo.shadow.sm : Neo.shadow.md}
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
      faceStyle={[styles.buttonFace, size === 'lg' ? styles.buttonLg : size === 'sm' ? styles.buttonSm : null]}
    >
      <ButtonContent label={label} icon={icon} loading={loading} danger={variant === 'danger' && !tone} size={size} />
    </PressableNeo>
  );
}

function ButtonContent({ label, icon, loading, danger, size }: { label: string; icon?: IconName; loading?: boolean; danger?: boolean; size: 'sm' | 'md' | 'lg' }) {
  const p = useNeoPalette();
  const ink = useInk();
  const color = danger ? p.dangerInk : ink;
  return (
    <>
      {loading ? <ActivityIndicator color={color} /> : icon ? <IconCircle name={icon} size={size === 'sm' ? 22 : 26} /> : null}
      <NeoText variant={size === 'sm' ? 'label' : 'subheading'} numberOfLines={1} style={[styles.shrink, { color }]}>
        {label}
      </NeoText>
    </>
  );
}

/** Round (actions like close) or rounded-square (navigation like back) outlined icon button. */
export function NeoIconButton({ icon, label, onPress, shape = 'circle', tone = 'surface', size = 44 }: { icon: IconName; label: string; onPress: () => void; shape?: 'circle' | 'square'; tone?: Tone; size?: number }) {
  return (
    <PressableNeo
      tone={tone}
      radius={shape === 'circle' ? size / 2 : Neo.radius.sm}
      offset={Neo.shadow.sm}
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      faceStyle={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <NeoIcon name={icon} size={18} />
    </PressableNeo>
  );
}

// ─── Badges, tags, status, subjects, chips ─────────────────────────────────

const BADGE_TONE: Record<'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'violet', Tone> = {
  neutral: 'subtle',
  primary: 'primarySoft',
  success: 'successSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  violet: 'violetSoft',
};

/** A small label ("NEET", "Weak"): a bordered pill, flat because it isn't tappable. */
export function NeoBadge({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof BADGE_TONE }) {
  const p = useNeoPalette();
  const type = useType();
  const t = BADGE_TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneFill(p, t), borderColor: p.ink }]}>
      <Text maxFontSizeMultiplier={1.3} style={[type.caption, styles.noPad, { fontFamily: type.label.fontFamily, color: onFill(p, t) }]}>
        {label}
      </Text>
    </View>
  );
}

/** The amount on the right of a row ("+25 XP", "72/100"): a coloured pill with a bold number. */
export function NeoTag({ label, tone = 'success', accessibilityLabel }: { label: string; tone?: Tone; accessibilityLabel?: string }) {
  const p = useNeoPalette();
  const type = useType();
  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? label} style={[styles.pill, { backgroundColor: toneFill(p, tone), borderColor: p.ink }]}>
      <Text maxFontSizeMultiplier={1.3} style={[type.label, styles.noPad, styles.tabular, { fontFamily: type.number.fontFamily, color: onFill(p, tone) }]}>
        {label}
      </Text>
    </View>
  );
}

/** "Due today", "Done", "Missed": colour + word + icon, the same on every screen. */
export function NeoStatusChip({ kind, word }: { kind: StatusKind; word?: string }) {
  const p = useNeoPalette();
  const type = useType();
  const look = STATUS[kind];
  const ink = onFill(p, look.tone);
  return (
    <View accessible accessibilityLabel={statusWord(kind, word)} style={[styles.pill, styles.status, { backgroundColor: toneFill(p, look.tone), borderColor: p.ink }]}>
      <NeoIcon name={look.icon as IconName} size={13} color={ink} />
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[type.caption, styles.noPad, { fontFamily: type.label.fontFamily, color: ink }]}>
        {statusWord(kind, word)}
      </Text>
    </View>
  );
}

export function NeoSubjectChips({ subjects, max = 3 }: { subjects: string | string[] | null | undefined; max?: number }) {
  const p = useNeoPalette();
  const type = useType();
  const list = Array.isArray(subjects) ? subjects : subjectsOf(subjects);
  if (!list.length) return null;
  const { shown, more } = chipsFor(list, max);
  return (
    <View accessible accessibilityLabel={subjectsLabel(list)} style={styles.subjectRow}>
      {shown.map((s) => (
        <View key={s} style={[styles.pill, styles.subject, { backgroundColor: p.violetSoft, borderColor: p.ink }]}>
          <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[type.caption, styles.noPad, { color: p.ink, fontFamily: type.label.fontFamily }]}>
            {s}
          </Text>
        </View>
      ))}
      {more ? <NeoText variant="caption" soft>+{more}</NeoText> : null}
    </View>
  );
}

/** One choice in a filter row: selected → yellow. The shadow space is always kept. */
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

/** Related views of one thing; the current one is yellow. */
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

// ─── Progress, numbers, stats ──────────────────────────────────────────────

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
      <View style={styles.inline}>
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

export type NeoAction = { label: string; icon?: IconName; onPress: () => void; tone?: Tone; primary?: boolean };

/** The "balance" card: a label, one big number, a line under it, and up to two actions side by side. */
export function NeoBigNumberCard({ label, value, caption, actions = [] }: { label: string; value: string; caption?: string; actions?: NeoAction[] }) {
  return (
    <NeoCard>
      <View accessible accessibilityLabel={`${label}: ${value}${caption ? `. ${caption}` : ''}`}>
        <NeoText variant="caption" soft>
          {label}
        </NeoText>
        <NeoText variant="bigNumber" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {value}
        </NeoText>
        {caption ? (
          <NeoText variant="caption" soft>
            {caption}
          </NeoText>
        ) : null}
      </View>
      {actions.length ? (
        <View style={styles.actions}>
          {actions.slice(0, 2).map((a) => (
            <NeoButton key={a.label} label={a.label} icon={a.icon} onPress={a.onPress} variant={a.primary ? 'primary' : 'secondary'} tone={a.tone} size="sm" style={styles.flex} />
          ))}
        </View>
      ) : null}
    </NeoCard>
  );
}

/** A small square shortcut (the reference's "Send again" tiles): icon in a circle and a short label. */
export function NeoTile({ label, icon, tone = 'surface', circle = 'violetSoft', onPress }: { label: string; icon: IconName; tone?: Tone; circle?: Tone; onPress: () => void }) {
  const p = useNeoPalette();
  return (
    <PressableNeo tone={tone} radius={Neo.radius.md} onPress={onPress} accessibilityLabel={label} faceStyle={styles.tile}>
      <View style={[styles.tileCircle, { backgroundColor: toneFill(p, circle), borderColor: p.ink }]}>
        <NeoIcon name={icon} size={18} color={onFill(p, circle)} />
      </View>
      <NeoText variant="caption" numberOfLines={1} style={styles.tileLabel}>
        {label}
      </NeoText>
    </PressableNeo>
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

// ─── Keypad and code ───────────────────────────────────────────────────────

export type KeypadKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '0' | 'del';
const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

/** Outlined number keys (codes, numerical answers). No haptic per key. */
export function NeoKeypad({ onKey, decimal = true }: { onKey: (key: KeypadKey) => void; decimal?: boolean }) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((k) =>
        k === '.' && !decimal ? (
          <View key={k} style={styles.keySlot} />
        ) : (
          <PressableNeo key={k} radius={Neo.radius.md} onPress={() => onKey(k)} accessibilityLabel={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k} style={styles.keySlot} faceStyle={styles.key}>
            {k === 'del' ? (
              <NeoIcon name={{ ios: 'delete.left', android: 'backspace' }} size={22} />
            ) : (
              <NeoText variant="number" style={styles.keyText}>
                {k}
              </NeoText>
            )}
          </PressableNeo>
        ),
      )}
    </View>
  );
}

/** The boxes a code is typed into; the next empty box is yellow-tinted. */
export function NeoCodeCells({ value, length = 6 }: { value: string; length?: number }) {
  const p = useNeoPalette();
  return (
    <View accessible accessibilityLabel={`Code, ${value.length} of ${length} digits entered`} style={styles.cells}>
      {Array.from({ length }, (_, i) => {
        const active = i === Math.min(value.length, length - 1);
        return (
          <View key={i} style={[styles.cell, { borderColor: p.ink, backgroundColor: active ? p.primarySoft : p.surface, ...hardShadow(Neo.shadow.sm, p.ink) }]}>
            <NeoText variant="number">{value[i] ?? ''}</NeoText>
          </View>
        );
      })}
    </View>
  );
}

// ─── Sticker ───────────────────────────────────────────────────────────────

/**
 * A scalloped badge (or a starburst with more, deeper points) with a hard
 * shadow. Only on highlights, results and empty states, never on task screens.
 */
export function Sticker({
  size = 120,
  tone = 'primary',
  points = 14,
  depth = 0.09,
  rotate = -4,
  children,
  label,
}: PropsWithChildren<{ size?: number; tone?: Tone; points?: number; depth?: number; rotate?: number; label?: string }>) {
  const p = useNeoPalette();
  const reduce = useReducedMotion();
  const o = Neo.shadow.md;
  const r = size / 2 - 2;
  const c = size / 2;
  const steps = points * 8;
  const d =
    Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      const rr = r * (1 - depth / 2 + (depth / 2) * Math.cos(a * points));
      return `${i ? 'L' : 'M'}${(c + rr * Math.cos(a)).toFixed(2)},${(c + rr * Math.sin(a)).toFixed(2)}`;
    }).join(' ') + 'Z';
  return (
    <View accessible={!!label} accessibilityLabel={label} style={{ width: size + o, height: size + o, transform: [{ rotate: `${reduce ? 0 : rotate}deg` }] }}>
      <Svg width={size} height={size} style={{ position: 'absolute', left: o, top: o }}>
        <Path d={d} fill={p.ink} />
      </Svg>
      <Svg width={size} height={size} style={styles.stickerFace}>
        <Path d={d} fill={toneFill(p, tone)} stroke={p.ink} strokeWidth={2} />
      </Svg>
      <View style={[styles.stickerFace, styles.stickerBody, { width: size, height: size, padding: size * 0.2 }]}>
        <InkContext.Provider value={onFill(p, tone)}>{children}</InkContext.Provider>
      </View>
    </View>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

/** Why it's empty, and the one action that fills it. */
export function NeoEmptyView({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Sticker size={96} tone="primary" points={12}>
        <NeoIcon name={icon} size={30} />
      </Sticker>
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
  info: { tone: 'violetSoft', icon: { ios: 'info.circle', android: 'info' } },
  success: { tone: 'successSoft', icon: { ios: 'checkmark.circle', android: 'check_circle' } },
  warning: { tone: 'primarySoft', icon: { ios: 'exclamationmark.triangle', android: 'warning' } },
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

// ─── Tab bar ───────────────────────────────────────────────────────────────

export type NeoTab<K extends string> = { key: K; label: string; icon: IconName };

/**
 * The floating ink pill bar: the current tab is a yellow pill with icon and
 * label; the others are icons in small outlined squares. Every tab keeps its
 * name for screen readers. No haptic on switching tabs.
 */
export function NeoTabBar<K extends string>({ tabs, value, onChange }: { tabs: readonly NeoTab<K>[]; value: K; onChange: (key: K) => void }) {
  const p = useNeoPalette();
  return (
    <View accessibilityRole="tablist" style={[styles.tabBar, { backgroundColor: p.tabBar }]}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [styles.tab, on ? styles.tabOn : styles.tabOff, { backgroundColor: on ? p.primary : p.surface, borderColor: p.ink }, pressed && !on && styles.pressed]}
          >
            <InkContext.Provider value={on ? p.onAccent : p.ink}>
              <NeoIcon name={t.icon} size={20} />
              {on ? (
                <NeoText variant="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.shrink}>
                  {t.label}
                </NeoText>
              ) : null}
            </InkContext.Provider>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.75 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noPad: Platform.OS === 'android' ? { includeFontPadding: false } : {},
  softOnFill: { opacity: 0.8 },
  card: { borderWidth: Neo.border.width, borderRadius: Neo.radius.lg, padding: Neo.space.lg, gap: Neo.space.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  buttonFace: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonSm: { minHeight: 44, paddingHorizontal: 12, gap: 8 },
  buttonLg: { minHeight: 56 },
  ghost: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4 },
  ghostText: { textDecorationLine: 'underline' },
  pill: { alignSelf: 'flex-start', borderWidth: Neo.border.width, borderRadius: Neo.radius.full, paddingHorizontal: 10, minHeight: 26, justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  subject: { maxWidth: 160, minHeight: 24, paddingHorizontal: 9 },
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
  actions: { flexDirection: 'row', gap: 8 },
  tile: { width: 76, minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 8 },
  tileCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: Neo.radius.sm, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  keySlot: { width: '33.33%', paddingHorizontal: 3 },
  key: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 22, lineHeight: 28 },
  cells: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  cell: { flex: 1, maxWidth: 48, height: 54, borderWidth: Neo.border.width, borderRadius: Neo.radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: Neo.shadow.sm },
  stickerFace: { position: 'absolute', left: 0, top: 0 },
  stickerBody: { alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 12 },
  emptyText: { maxWidth: 320 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, minHeight: 200 },
  notice: { padding: Neo.space.md },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
  tabBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 22 },
  tab: { minHeight: 48, borderRadius: Neo.radius.md, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  tabOn: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  tabOff: { width: 48 },
});
