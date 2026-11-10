# Neobrutalism components (Expo / React Native)

Adapt these into the app's existing kit file, **keeping the kit's exported names and props** so screens don't need to change (if the kit exports `Button({ label, onPress, tone })`, restyle its internals instead of renaming). **Scoped apps** (only some roles are neo, scoped-adoption.md): each component here becomes the `Neo<Name>` branch, the existing implementation stays untouched as `Classic<Name>`, and the exported name switches on `useDesign()`. Code assumes:
- the active preset and helpers from presets.md / tokens.md: `preset`, `Neo`, `font`, `textStyles`, `hardShadow`, `mix`;
- motion and haptics from app-interactions motion.md: `Motion`, `haptic`, `useShake`, `usePop`, `useFill`;
- the app's palette hook (`usePalette()` / `useTheme()`, whichever exists) returning a `Palette` (presets.md);
- `react-native-reanimated` (Expo default) and `react-native-svg`.

## The system in six rules (read before any component)

1. **Shadow = hierarchy.** `sm` for small marks (badges, checkboxes, page cells, chips), `md` for anything you tap or type into and for cards, `lg` for overlays (dialogs, sheets, toasts). A bigger shadow means it sits higher. Text blocks and backgrounds never get one.
2. **Selection vs location.** *Choosing* something (checked box, picked answer, selected filter, current page) uses the **primary** family. *Where you are* (active tab, segment, current nav item, table header) uses **highlight**. Never swap them.
3. **States change one thing.** Disabled = the whole control at **50% opacity**, structure unchanged (border, fill and shadow stay). Error = border **and** shadow turn `danger`, plus `dangerInk` helper text. Focus = a highlight-tinted fill. Pressed = the face slides into its shadow.
4. **Shadow space is always reserved**, even when a shadow is hidden, so nothing shifts when state changes.
5. **Text color comes from the surface** (`useInk()`), never hard-coded. Accents are fills, never text colors.
6. **Pressables use the plate, static surfaces use `boxShadow`.** Only `transform` animates.

## 0. Ink context: readable text on any fill

```tsx
import { createContext, useContext } from 'react';

const InkContext = createContext<string | null>(null);
export const InkProvider = InkContext.Provider;

/** Text/icon color for whatever surface we're sitting on. */
export function useInk() {
  const p = usePalette();
  return useContext(InkContext) ?? p.ink;
}

export type Tone =
  | 'surface' | 'subtle' | 'ink' | 'highlight'
  | 'primary' | 'primarySoft' | 'success' | 'successSoft' | 'danger' | 'dangerSoft'
  | 'warning' | 'warningSoft' | 'violet' | 'violetSoft' | 'info' | 'infoSoft';

export const toneFill = (p: Palette, t: Tone) => p[t];
/** surface, subtle and *Soft tints → normal ink (dark tints in dark mode); ink → canvas;
 *  saturated accents and highlight → onAccent, which is dark in both modes. */
export const onFill = (p: Palette, t: Tone) =>
  t === 'surface' || t === 'subtle' || t.endsWith('Soft') ? p.ink : t === 'ink' ? p.canvas : p.onAccent;

/** For small filled marks (icon circles, letter badges): dark or light ink, whichever reads on `hex`. */
export function readableOn(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1A1A1A' : '#FAF6EC';
}
```

Secondary text on **saturated** fills uses the fill's own ink at `opacity: 0.8`, never `inkSoft` (it drops to ~4.4:1 on pink and lilac). On surfaces and `*Soft` tints, `inkSoft` is fine. `NeoText soft` handles this automatically.

## 1. NeoText: replaces raw `<Text>` + `fontWeight`

```tsx
type Variant = keyof typeof textStyles; // display | title | heading | subheading | body | bodySm | label | caption | overline | mono

export function NeoText({ variant = 'body', soft, style, ...rest }: TextProps & { variant?: Variant; soft?: boolean }) {
  const p = usePalette();
  const ink = useInk();
  const plain = ink === p.ink;
  const softColor = variant === 'overline' || soft;
  return (
    <Text
      maxFontSizeMultiplier={variant === 'display' || variant === 'title' || variant === 'overline' ? 1.3 : 1.6}
      {...rest}
      style={[textStyles[variant], { color: softColor && plain ? p.inkSoft : ink }, softColor && !plain && { opacity: 0.8 }, style]}
    />
  );
}
```

If the app already has `ThemedText`, give it these variants instead of adding a second text component. In a scoped app, also export `AppText` (neo → `NeoText`, classic → the app's own text styling) for shared code and the app-interactions layer.

## 2. PressableNeo: the core primitive

```tsx
import { ReactNode, useState } from 'react';
import { GestureResponderEvent, Platform, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic as hx } from '@/lib/haptics'; // app-interactions motion.md

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  tone?: Tone;                       // face fill; sets text color for children
  radius?: number;
  offset?: number;                   // visible shadow now (0 = flat)
  reserve?: number;                  // space always kept for the shadow (defaults to offset)
  borderColor?: string;              // e.g. danger for an error state
  shadowColor?: string;
  style?: StyleProp<ViewStyle>;      // outer layout: margin, flex, alignSelf
  faceStyle?: StyleProp<ViewStyle>;  // padding/alignment inside the face
  haptic?: 'select' | 'tap' | false; // fires on commit (onPress), never on press-in
  busy?: boolean;                    // loading: blocks presses, keeps full color, announces "busy"
  locked?: boolean;                  // answered/read-only: blocks presses, keeps look, no press shift
};

export function PressableNeo({
  children, tone = 'surface', radius = Neo.radius.md, offset = Neo.shadow.md, reserve, borderColor, shadowColor,
  style, faceStyle, haptic = false, busy, locked, disabled, onPress, onPressIn, onPressOut, ...rest
}: Props) {
  const p = usePalette();
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0);
  const [focused, setFocused] = useState(false); // web/keyboard focus ring
  const inactive = !!disabled || !!busy || !!locked;
  const space = reserve ?? offset;

  const faceAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: pressed.value * offset }, { translateY: pressed.value * offset }],
  }));
  // Reduced motion: the shift still happens (it is feedback), just without the spring.
  const to = (v: number) => (reduce ? withTiming(v, { duration: 0 }) : withSpring(v, Motion.spring.press));

  return (
    <Pressable
      {...rest}
      disabled={inactive}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ ...rest.accessibilityState, disabled: !!disabled, busy: !!busy }}
      onPressIn={(e) => { if (!inactive) pressed.value = to(1); onPressIn?.(e); }}
      onPressOut={(e) => { pressed.value = to(0); onPressOut?.(e); }}
      onPress={(e: GestureResponderEvent) => { if (haptic) haptic === 'tap' ? hx.tap() : hx.select(); onPress?.(e); }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        { paddingRight: space, paddingBottom: space, opacity: disabled ? 0.5 : 1 },
        Platform.OS === 'web' && ({ cursor: inactive ? 'default' : 'pointer' } as any),
        style,
      ]}
    >
      {offset > 0 && (
        <View pointerEvents="none" style={{ position: 'absolute', left: offset, top: offset, right: space - offset, bottom: space - offset, borderRadius: radius, backgroundColor: shadowColor ?? p.ink }} />
      )}
      <Animated.View
        style={[
          { backgroundColor: toneFill(p, tone), borderRadius: radius, borderWidth: Neo.border.width, borderColor: borderColor ?? p.ink },
          focused && ({ outlineStyle: 'solid', outlineWidth: 2, outlineColor: p.ink, outlineOffset: 2 } as any),
          faceStyle,
          faceAnim,
        ]}
      >
        <InkProvider value={onFill(p, tone)}>{children}</InkProvider>
      </Animated.View>
    </Pressable>
  );
}
```

Haptics fire on `onPress` because `onPressIn` also fires when a finger lands on an option and then scrolls.

## 3. Card

```tsx
const CARD_PAD = { sm: Neo.space.md, md: Neo.space.xl, lg: Neo.space.xxl } as const;

export function Card({ children, style, tone = 'surface', size = 'md', elevation = 'md' }: PropsWithChildren<{
  style?: StyleProp<ViewStyle>; tone?: Tone; size?: 'sm' | 'md' | 'lg'; elevation?: 'none' | 'sm' | 'md' | 'lg';
}>) {
  const p = usePalette();
  const s = elevation === 'none' ? 0 : Neo.shadow[elevation];
  return (
    <View style={[{
      backgroundColor: toneFill(p, tone),
      borderWidth: Neo.border.width, borderColor: p.ink,
      borderRadius: Neo.radius.lg,
      padding: CARD_PAD[size],
      marginRight: s, marginBottom: s,           // shadow space: right edge lines up with PressableNeo faces
      ...hardShadow(s, p.ink),
    }, style]}>
      <InkProvider value={onFill(p, tone)}>{children}</InkProvider>
    </View>
  );
}
```

## 4. Button

Variants: **primary** (main action) · **secondary** (`violet`, an alternative action) · **accent** (`success`, a positive/confirm action) · **destructive** (`danger`, ink label) · **outline** (`surface`, the default secondary) · **dark** (`ink` fill, at most one per screen) · **ghost** (no border or shadow, underlined, tertiary only). If the app's kit uses other names (`danger`, `secondary` meaning white), map them; don't rename the kit.

```tsx
const BTN = { sm: { h: 36, px: 14, fs: 14 }, md: { h: 48, px: 20, fs: 16 }, lg: { h: 56, px: 24, fs: 17 } } as const;
const VARIANT_TONE = { primary: 'primary', secondary: 'violet', accent: 'success', destructive: 'danger', outline: 'surface', dark: 'ink' } as const;
const labelFont = () => (preset.headingWeight === 'bold' ? font.bold : font.medium);

export type ButtonProps = {
  label: string; onPress?: () => void; variant?: keyof typeof VARIANT_TONE | 'ghost'; size?: keyof typeof BTN;
  icon?: IconName; disabled?: boolean; loading?: boolean; fullWidth?: boolean;
  disabledReason?: string;   // shown under the button while disabled + used as the accessibility hint (app-interactions states-and-async.md §2)
};

export function Button(props: ButtonProps) {
  const { disabled, disabledReason, fullWidth } = props;
  if (!disabled || !disabledReason) return <ButtonCore {...props} />;
  return (
    <View style={{ gap: 6, alignSelf: fullWidth ? 'stretch' : 'flex-start' }}>
      <ButtonCore {...props} />
      <NeoText variant="caption" soft accessibilityElementsHidden importantForAccessibility="no">{disabledReason}</NeoText>
    </View>
  );
}

function ButtonCore({ label, onPress, variant = 'primary', size = 'md', icon, disabled, loading, fullWidth, disabledReason }: ButtonProps) {
  const b = BTN[size];

  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" hitSlop={8}
        style={({ pressed }) => ({ minHeight: b.h, justifyContent: 'center', paddingHorizontal: 4, opacity: pressed ? 0.6 : disabled ? 0.5 : 1 })}>
        <NeoText variant="label" style={{ textDecorationLine: 'underline', fontSize: b.fs, fontFamily: labelFont() }}>{label}</NeoText>
      </Pressable>
    );
  }

  return (
    <PressableNeo
      tone={VARIANT_TONE[variant]} onPress={onPress} disabled={disabled} busy={loading}
      haptic={variant === 'primary' ? 'tap' : false}
      radius={Neo.radius.button}
      offset={size === 'sm' ? Neo.shadow.sm : Neo.shadow.md}
      hitSlop={size === 'sm' ? 6 : 0}
      accessibilityLabel={label}
      accessibilityHint={disabled ? disabledReason : undefined}
      style={fullWidth ? { alignSelf: 'stretch' } : undefined}
      faceStyle={{ minHeight: b.h, paddingHorizontal: b.px, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
      <ButtonContent label={label} icon={icon} loading={loading} fontSize={b.fs} />
    </PressableNeo>
  );
}

function ButtonContent({ label, icon, loading, fontSize }: { label: string; icon?: IconName; loading?: boolean; fontSize: number }) {
  const ink = useInk();
  return (
    <>
      {loading ? <ActivityIndicator color={ink} /> : icon ? <IconCircle name={icon} /> : null}
      <NeoText variant="label" numberOfLines={1} style={{ fontSize, flexShrink: 1, fontFamily: labelFont() }}>{label}</NeoText>
    </>
  );
}

/** Small ink circle holding a light icon: the "↗ Transfer" look. */
function IconCircle({ name, size = 26 }: { name: IconName; size?: number }) {
  const ink = useInk();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={Math.round(size * 0.55)} color={readableOn(ink)} />
    </View>
  );
}
```

The label stays visible while loading (the spinner replaces the icon), so the button keeps its width. **Never** use white labels on accent fills; `onAccent` keeps every variant ≥ 5:1.

## 5. IconButton

Round for actions in headers (bell, close); **rounded-square** (`radius.sm`) for navigation on top of illustrations (back, bookmark), as in the learning-app reference.

```tsx
export function IconButton({ name, onPress, tone = 'surface', size = 44, shape = 'circle', label }: {
  name: IconName; onPress: () => void; tone?: Tone; size?: number; shape?: 'circle' | 'square'; label: string;
}) {
  return (
    <PressableNeo tone={tone} radius={shape === 'circle' ? size / 2 : Neo.radius.sm} offset={Neo.shadow.sm}
      onPress={onPress} accessibilityLabel={label} hitSlop={6}
      faceStyle={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <ToneIcon name={name} size={20} />
    </PressableNeo>
  );
}
const ToneIcon = ({ name, size }: { name: IconName; size: number }) => <Icon name={name} size={size} color={useInk()} />;
```

## 6. Badge, Tag, Chip

```tsx
/** Status pill: "Active", "NEET", "Due today". Pill + small shadow. */
export function Badge({ label, tone = 'surface' }: { label: string; tone?: Tone }) {
  const p = usePalette();
  return (
    <View style={{ alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center', paddingHorizontal: 12,
      backgroundColor: toneFill(p, tone), borderWidth: Neo.border.width, borderColor: p.ink, borderRadius: Neo.radius.full,
      marginRight: Neo.shadow.sm, marginBottom: Neo.shadow.sm, ...hardShadow(Neo.shadow.sm, p.ink) }}>
      <Text maxFontSizeMultiplier={1.3} style={[textStyles.caption, { color: onFill(p, tone) }]}>{label}</Text>
    </View>
  );
}

/** Compact value tag for dense rows: "−25", "72%". Flat, small radius. */
export function Tag({ label, tone = 'violet' }: { label: string; tone?: Tone }) {
  const p = usePalette();
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: toneFill(p, tone), borderWidth: Neo.border.thin, borderColor: p.ink, borderRadius: Neo.radius.xs, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text maxFontSizeMultiplier={1.3} style={[textStyles.caption, { fontFamily: font.bold, color: onFill(p, tone), fontVariant: ['tabular-nums'] }]}>{label}</Text>
    </View>
  );
}

/** Filter chip (selection → primary). Pill, small shadow, space reserved. */
export function Chip({ label, selected, onPress, onRemove }: { label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void }) {
  return (
    <PressableNeo tone={selected ? 'primary' : 'surface'} radius={Neo.radius.full} offset={Neo.shadow.sm}
      onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      faceStyle={{ paddingHorizontal: 14, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <NeoText variant="label" style={{ fontSize: 13 }}>{label}</NeoText>
      {onRemove && <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${label}`}><ToneIcon name="x" size={12} /></Pressable>}
    </PressableNeo>
  );
}
```

Tone meaning everywhere: success = correct/positive/active · danger = wrong/negative/removed · warning = pending/timer · violet = subject/category · info = info · primary = selected/main · highlight = current location.

**Tag input** (topics, labels): a white `Card size="sm"` wrapping `Chip`s with `onRemove` in a `flexWrap` row, plus a borderless `TextInput` ("Add topic…") at the end.

## 7. Field (text input)

Border, fill and shadow live on a wrapper `View` (`boxShadow` on `TextInput` is unreliable on Android). The wrapper shakes when a new error appears.

```tsx
export function Field({ label, error, hint, icon, style, editable = true, ...input }: TextInputProps & {
  label?: string; error?: string | null; hint?: string; icon?: IconName;
}) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const { x, shake } = useShake();
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  useEffect(() => { if (error) { shake(); haptic.error(); } }, [error]); // only when an error appears/changes

  const edge = error ? p.danger : p.ink;
  return (
    <View style={{ gap: 6, opacity: editable ? 1 : 0.5 }}>
      {label && <NeoText variant="label">{label}</NeoText>}
      <Animated.View style={[{
        flexDirection: 'row', alignItems: 'center',
        borderRadius: Neo.radius.md, borderWidth: Neo.border.width, borderColor: edge,
        backgroundColor: focused ? mix(p.highlight, p.surface, 0.25) : p.surface,
        marginRight: Neo.shadow.md, marginBottom: Neo.shadow.md,
        ...hardShadow(Neo.shadow.md, edge),
      }, shakeStyle]}>
        {icon && <View style={{ paddingLeft: 12 }}><Icon name={icon} size={16} color={p.ink} /></View>}
        <TextInput
          {...input}
          editable={editable}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          placeholderTextColor={p.inkSoft}
          selectionColor={p.primary}
          cursorColor={p.ink}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={input.accessibilityLabel ?? label}
          style={[{ flex: 1, minHeight: 48, paddingHorizontal: icon ? 10 : 16, fontFamily: font.regular, fontSize: 16, color: p.ink }, style]}
        />
      </Animated.View>
      {error ? <NeoText variant="caption" style={{ color: p.dangerInk, fontFamily: font.medium }} accessibilityLiveRegion="polite">{error}</NeoText>
        : hint ? <NeoText variant="caption" soft>{hint}</NeoText> : null}
    </View>
  );
}
```

## 8. Checkbox

```tsx
export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const p = usePalette();
  const { s, pop } = usePop();
  const tick = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable onPress={() => { onChange(!checked); if (!checked) pop(); }} disabled={disabled} hitSlop={8}
      accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !!disabled }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: 22, height: 22, borderRadius: Neo.radius.xs, borderWidth: Neo.border.width, borderColor: p.ink,
        backgroundColor: checked ? p.primary : p.surface, alignItems: 'center', justifyContent: 'center',
        marginRight: Neo.shadow.sm, marginBottom: Neo.shadow.sm, ...hardShadow(Neo.shadow.sm, p.ink) }}>
        {checked && <Animated.View style={tick}><Icon name="check" size={14} color={p.onAccent} /></Animated.View>}
      </View>
      <NeoText variant="label">{label}</NeoText>
    </Pressable>
  );
}
```

A radio button is the same with `radius.full` and a 10px ink dot instead of the check. A switch is a pill track (`radius.full`, 2px ink, 52×30) with a bordered knob that slides (`spring.press`); its on-track is `success`.

## 9. AnswerOption (MCQ): the core student component

```tsx
type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'reveal'; // reveal = the right answer shown after a wrong pick

export function AnswerOption({ letter, state, onPress, disabled, children }: PropsWithChildren<{
  letter: string; state: OptionState; onPress: () => void; disabled?: boolean;
}>) {
  const p = usePalette();
  const { x, shake } = useShake();
  const { s: checkScale, pop } = usePop();
  const prev = useRef(state);

  useEffect(() => {
    if (prev.current === state) return;
    if (state === 'correct') { pop(); haptic.success(); }
    if (state === 'wrong') { shake(); haptic.error(); }
    prev.current = state;
  }, [state]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  const tone: Tone = ({ idle: 'surface', selected: 'primarySoft', correct: 'success', wrong: 'danger', reveal: 'successSoft' } as const)[state];
  const locked = disabled || state === 'correct' || state === 'wrong' || state === 'reveal';

  return (
    <Animated.View style={shakeStyle}>
      <PressableNeo
        tone={tone} onPress={onPress} locked={locked} haptic={false}
        accessibilityRole="radio" accessibilityState={{ selected: state !== 'idle' && state !== 'reveal', disabled: locked }}
        accessibilityLabel={`Option ${letter}${state === 'correct' ? ', correct' : state === 'wrong' ? ', wrong' : ''}`}
        style={{ alignSelf: 'stretch' }}
        faceStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
      >
        <LetterBadge letter={letter} filled={state !== 'idle'} />
        <View style={{ flex: 1 }}>{children /* option text or the existing math renderer, untouched */}</View>
        {(state === 'correct' || state === 'reveal') && (
          <Animated.View style={checkStyle}><ToneIcon name="check" size={20} /></Animated.View>
        )}
      </PressableNeo>
    </Animated.View>
  );
}

function LetterBadge({ letter, filled }: { letter: string; filled: boolean }) {
  const p = usePalette();
  const ink = useInk();
  return (
    <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: Neo.border.width, borderColor: p.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? ink : 'transparent' }}>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: filled ? readableOn(ink) : ink }}>{letter}</Text>
    </View>
  );
}
```

Parent logic: in **test mode**, set `state="selected"` and call `haptic.select()` in the parent's `onPress`. In **practice mode**, go straight to `'correct'` or `'wrong'` (+ `'reveal'` on the right option) and don't call `select`, so the success/error haptic is the only vibration.

## 10. Tabs and segmented control (location → highlight)

One bordered container (`radius.md`, `surface`, 2px ink, `hardShadow(md)`). Tabs share the width equally (`flex: 1`, height 44), separated by **2px ink dividers** (`borderLeftWidth: 2` on every tab but the first). A **highlight** indicator view sits under the labels and slides to the active tab (`withSpring(x, Motion.spring.settle)`, width from `onLayout`). Labels: `NeoText variant="label"`, `onAccent` on the indicator. Clip the inner row with an inner view (`overflow: 'hidden'`, same radius) while keeping the shadow on the outer one. Silent: no haptic. Tab content goes in a `Card` 16px below.

## 11. Alert / Notice

```tsx
const ALERT = { info: ['infoSoft', 'info'], success: ['successSoft', 'check-circle'], warning: ['warning', 'alert-triangle'], error: ['dangerSoft', 'x-circle'] } as const;

export function Alert({ kind = 'info', title, body, action }: { kind?: keyof typeof ALERT; title: string; body?: string; action?: ReactNode }) {
  const [tone, icon] = ALERT[kind];
  return (
    <Card tone={tone as Tone} size="sm">
      <View style={{ flexDirection: 'row', gap: 12 }} accessibilityRole="alert">
        <ToneIcon name={icon} size={20} />
        <View style={{ flex: 1, gap: 2 }}>
          <NeoText variant="subheading">{title}</NeoText>
          {body && <NeoText variant="bodySm" soft>{body}</NeoText>}
          {action && <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>{action}</View>}
        </View>
      </View>
    </Card>
  );
}
```

Warnings use the **solid** warning fill (they should interrupt). Info, success and error use soft tints (they inform).

## 12. ProgressBar (paper strip)

```tsx
export function ProgressBar({ value, tone = 'primary', label, fromZero }: { value: number; tone?: Tone; label?: string; fromZero?: boolean }) {
  const p = usePalette();
  const w = useFill(Math.max(0, Math.min(1, value)), { fromZero });
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      {label && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <NeoText variant="bodySm">{label}</NeoText>
          <NeoText variant="bodySm" soft style={{ fontVariant: ['tabular-nums'] }}>{Math.round(value * 100)}%</NeoText>
        </View>
      )}
      <View style={{ marginRight: Neo.shadow.sm, marginBottom: Neo.shadow.sm, borderRadius: Neo.radius.full, ...hardShadow(Neo.shadow.sm, p.ink) }}>
        <View style={{ height: 20, borderRadius: Neo.radius.full, borderWidth: Neo.border.width, borderColor: p.ink, backgroundColor: p.surface, padding: 2, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', borderRadius: Neo.radius.full, backgroundColor: toneFill(p, tone), borderRightWidth: value > 0 && value < 1 ? 2 : 0, borderColor: p.ink }, fill]} />
        </View>
      </View>
    </View>
  );
}
```

The 2px ink right edge on the fill makes it read as a strip of paper, not a web bar.

## 13. ListRow

Rows live **inside one Card** separated by 2px ink dividers, *or* each row is its own small card with `gap: 10`. Pick one per list.

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
  <Avatar name="Aarav Shah" size={40} />
  <View style={{ flex: 1, minWidth: 0 }}>
    <NeoText variant="subheading" numberOfLines={1}>Aarav Shah</NeoText>
    <NeoText variant="caption" soft numberOfLines={1}>Physics · Test 4 · Oct 28</NeoText>
  </View>
  <Tag label="72%" tone="success" />
</View>
// Divider: <View style={{ height: 2, backgroundColor: p.ink, marginHorizontal: -CARD_PAD.md }} />
```

Tappable rows get a `subtle` pressed background, **with no press-shift and no haptic** (they navigate).

## 14. Avatar

A circle with a 2px ink border and a pastel fill picked from the name, with initials in `onAccent` or an `expo-image` photo inside a bordered wrapper.

```tsx
const AVATAR_TONES: Tone[] = ['violet', 'success', 'danger', 'info', 'warning', 'primary'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
export const avatarTone = (name: string) => AVATAR_TONES[Math.abs(hash(name)) % AVATAR_TONES.length];
```

Quick-action tiles (the wallet's "Send again" row): 72×84 `PressableNeo` cards with an avatar and a caption. The first tile is `success` with an ink "+" circle.

## 15. StatTile

`Card` with a pastel tone, an overline label on top, a big number (`textStyles.display` at 28–32), and an optional `Tag` for the delta. Two per row, `gap: 12`. Adjacent tiles never share a tone.

## 16. DataTable (teacher results, rosters)

- Outer view: `hardShadow(md)`, `radius.lg`. Inner view: 2px ink border, same radius, `overflow: 'hidden'`.
- Header row: **highlight** fill (location), 2px ink bottom border, `font.bold` 13.5, cell padding 12–16.
- Body rows: min height 52, 2px ink bottom border (except the last), `zebra` on odd rows, cells `bodySm`, statuses as `Badge`s, numbers `tabular-nums` right-aligned.
- **Phones:** ≤ 3 columns fit as-is. With more columns, wrap the table in a horizontal `ScrollView` with a sticky first column, **or** render each row as a small card (name + 2–3 key values + badge). Prefer cards for student lists and the scroll table for mark sheets.

## 17. Pagination / QuestionPalette

Page cells: 40×40 `PressableNeo` (`radius.sm`, `offset: shadow.sm`, `label` font, tabular-nums). **Current = primary** (selection). Answered = `successSoft`, flagged = a small `warning` dot in the corner, unvisited = `surface`. Prev/Next are `Button size="sm" variant="outline"`. In tests, lay out the cells as a 5–6 column grid in a bottom sheet. Silent.

## 18. Tooltip / popover

Ink fill, `onInk` text (`caption`), `radius.xs`, `hardShadow(sm)`, padding 6×12, and a 10px rotated-square arrow. On mobile, show it on **long-press** for icon-only controls, and dismiss on release or after 2s. Never put essential information only in a tooltip.

## 19. Dialog and sheet (overlays → `shadow.lg`)

- **Dialog:** `Card size="lg" elevation="lg"`. Title row: a 20px icon (warning icon in `doodle`/orange for destructive) + `subheading` 18. Body `bodySm soft`. Then a row of `size="sm"` buttons, gap 12: on destructive dialogs the destructive action comes first, then outline "Cancel". Backdrop `rgba(26,26,26,0.45)`, flat.
- **Bottom sheet:** canvas fill, top corners `radius.lg`, 2px ink border on top/left/right, a 40×5 ink handle, and `hardShadow(lg)` drawn upward (use the plate technique with a negative offset, or skip the shadow because the backdrop already separates it).

## 20. Empty and error states

```tsx
export function EmptyState({ title, body, art, action }: { title: string; body?: string; art?: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 12 }}>
      {art /* an <Illustration> or a Sticker (graphics.md / §24) */}
      <NeoText variant="heading" style={{ textAlign: 'center' }}>{title}</NeoText>
      {body && <NeoText variant="bodySm" soft style={{ textAlign: 'center', maxWidth: 320 }}>{body}</NeoText>}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="dangerSoft" size="lg" style={{ alignItems: 'center', gap: 12 }}>
      <ToneIcon name="cloud-off" size={28} />
      <NeoText variant="subheading" style={{ textAlign: 'center' }} accessibilityRole="alert">{message}</NeoText>
      {onRetry && <Button variant="outline" size="sm" label="Try again" onPress={onRetry} />}
    </Card>
  );
}
```

Empty states say **why** it's empty and offer the **one action** that fills it ("No tests yet · Create your first test"). Error states say what happened in plain words (`humanError`, app-interactions states-and-async.md) and offer Retry. Personality (illustration, sticker) is allowed here.

## 21. Bottom tab bar

```tsx
// Container: absolute, left/right 16, bottom insets.bottom + 8, backgroundColor p.tabBar,
//   borderRadius Neo.radius.lg, padding 8, flexDirection row, gap 8,
//   ...hardShadow(Neo.shadow.md, p.highlight)   // the one non-ink shadow: an ink shadow would vanish under an ink bar
// Tabs: PressableNeo radius sm, offset 0, reserve 0; tone 'surface', icon only, accessibilityLabel = tab name.
// Active (location → highlight): a separate highlight indicator view slides under the tabs; icon + label; flex 1.6.
// No haptic on tab switch.
```

Reserve the bar's height + bottom inset as `paddingBottom` on every scroll view (update the app's tab-bar-height hook).

## 22. Header, section header, overline

- **Screen header:** canvas background, no bottom border. Left: `title` or "Hello, Name 👋". Right: round `IconButton`s. `paddingHorizontal: Neo.screenPadding`, `paddingTop: insets.top + 8`. Pushed screens: a back `IconButton` left.
- **Section header with rule:** `[heading] ───────` row: `NeoText variant="heading"` + `View { flex: 1, height: 2, backgroundColor: ink }`, gap 12, marginTop 28.
- **Overline:** `NeoText variant="overline"` above groups ("TODAY", "COMPLETED", "AMOUNT"), 8px above the group.
- **Hero band** (optional, home or profile top): a full-width `highlight` block with a 2px ink bottom rule, containing the greeting and a 48px logo/emoji tile (`radius.xl`, primary, `shadow.md`).

## 23. Keypad / CodeInput (room codes, OTP)

Keys: `PressableNeo` (`radius.md`, `surface`, height 60, 3 columns, `gap: 12`), digits `font.bold` 22, **no haptic per key**. Code cells: 48×56 bordered boxes, the active cell highlight-tinted with `shadow.md`, filled cells `surface` with `shadow.sm`, all reserving `shadow.md`. Valid/invalid motion is in app-interactions motion.md → Forms.

## 24. Sticker (wavy badge)

```tsx
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Scalloped circle badge. points 12–16, depth 0.06–0.1, rotate within ±6°. */
export function Sticker({ size = 140, tone = 'highlight', points = 14, depth = 0.08, rotate = -4, children }: { size?: number; tone?: Tone; points?: number; depth?: number; rotate?: number; children?: ReactNode }) {
  const p = usePalette();
  const r = size / 2 - 4, c = size / 2, steps = points * 8;
  const d = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 - depth / 2 + (depth / 2) * Math.cos(a * points));
    return `${i ? 'L' : 'M'}${(c + rr * Math.cos(a)).toFixed(2)},${(c + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + 'Z';
  return (
    <View style={{ width: size + 4, height: size + 4, transform: [{ rotate: `${rotate}deg` }] }} accessible={false}>
      <Svg width={size} height={size} style={{ position: 'absolute', left: 4, top: 4 }}><Path d={d} fill={p.ink} /></Svg>
      <Svg width={size} height={size} style={{ position: 'absolute' }}><Path d={d} fill={toneFill(p, tone)} stroke={p.ink} strokeWidth={2} /></Svg>
      <View style={[StyleSheet.absoluteFillObject, { right: 4, bottom: 4, alignItems: 'center', justifyContent: 'center', padding: size * 0.18 }]}>
        <InkProvider value={onFill(p, tone)}>{children}</InkProvider>
      </View>
    </View>
  );
}
```

Use it on onboarding, the results celebration, and empty states only. Text inside: `NeoText variant="label"`, centered.

## Screen layout template (student home)

```tsx
<Screen>{/* canvas bg, safe area, paddingHorizontal 20, gap 16 */}
  <Header title="Hi, Aarav 👋" right={<IconButton name="bell" label="Notifications" onPress={…} />} />
  <Card size="lg" tone="primary">                        {/* hero: the next action */}
    <NeoText variant="overline">Next test · Physics</NeoText>
    <NeoText variant="title">Laws of Motion</NeoText>
    <NeoText variant="bodySm" soft>30 questions · 45 min · due today</NeoText>
    <Button label="Start test" variant="dark" icon="arrow-right" fullWidth />
  </Card>
  <View style={{ flexDirection: 'row', gap: 12 }}>
    <StatTile tone="success" label="Streak" value="6 days" />
    <StatTile tone="violet" label="Accuracy" value="78%" />
  </View>
  <SectionHeader title="Continue practising" />           {/* heading + 2px rule */}
  <Card>{rows}</Card>
</Screen>
```

Full-screen archetypes (onboarding, generating, answer, results, data table) are in patterns.md.
