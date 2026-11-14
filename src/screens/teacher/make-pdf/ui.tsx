import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { Field, Icon, usePalette, type IconName } from '@/components/kit';
import { haptic } from '@/design/haptics';
import { KeyboardAwareScrollView } from '@/components/keyboard-safe-view';
import { MaxContentWidth } from '@/constants/theme';

// The few pieces the Make PDF steps share, in the app's own look: the step
// header with its progress, the large choice cards, and a whole-number field.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One bar of the step progress: it fills with a critically damped spring (no bounce), so going back reverses smoothly. */
function ProgressSegment({ filled, color, track }: { filled: boolean; color: string; track: string }) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.set(reduceMotion ? (filled ? 1 : 0) : withSpring(filled ? 1 : 0, { duration: 400, dampingRatio: 1 }));
  }, [filled, fill, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View style={[styles.barSegment, { backgroundColor: track, overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, transformOrigin: 'left' }, style]} />
    </View>
  );
}

/** Where the teacher is: a back button, the step's name, a "start over" and a bar of steps. */
export function StepHeader({
  title,
  subtitle,
  step,
  steps,
  onBack,
  backLabel = 'Back',
  onReset,
}: {
  title: string;
  subtitle?: string;
  /** What the back button does, for screen readers ("Back to Papers" on the first step). */
  backLabel?: string;
  /** This step's place from 0, among `steps`. */
  step: number;
  steps: number;
  onBack?: () => void;
  onReset?: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.card }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={20} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={[styles.headerTitle, { color: palette.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: palette.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onReset ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start over"
            onPress={onReset}
            hitSlop={8}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          >
            <Text style={[styles.resetText, { color: palette.primary }]}>Start over</Text>
          </Pressable>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step + 1} of ${steps}`}
        accessibilityValue={{ min: 1, max: steps, now: step + 1 }}
        style={styles.bar}
      >
        {Array.from({ length: steps }, (_, i) => (
          <ProgressSegment key={i} filled={i <= step} color={palette.primary} track={palette.border} />
        ))}
      </View>
    </View>
  );
}

/** A large tap target for one of a few choices (a PDF type, a way of choosing questions). */
export function ChoiceCard({
  icon,
  title,
  text,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  text: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  // Feedback on press-down: the card settles in under the finger on a spring and a light tick confirms the choice.
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const spring = (to: number) => {
    scale.set(reduceMotion ? 1 : withSpring(to, { duration: 300, dampingRatio: 1 }));
  };
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${text}`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPressIn={() => spring(0.98)}
      onPressOut={() => spring(1)}
      onPress={() => {
        if (!selected) haptic.select();
        onPress();
      }}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? palette.primarySoft : palette.card,
          borderColor: selected ? palette.primary : palette.border,
          borderWidth: selected ? 1.5 : 1,
          opacity: disabled ? 0.5 : 1,
        },
        press,
      ]}
    >
      <View style={[styles.choiceIcon, { backgroundColor: selected ? palette.primary : palette.primarySoft }]}>
        <Icon name={icon} color={selected ? palette.onPrimary : palette.primary} size={22} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, { color: palette.foreground }]}>{title}</Text>
        <Text style={[styles.choiceText, { color: palette.mutedForeground }]}>{text}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? palette.primary : palette.borderStrong, backgroundColor: selected ? palette.primary : 'transparent' }]}>
        {selected ? <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.onPrimary} size={12} /> : null}
      </View>
    </AnimatedPressable>
  );
}

/** A step's scrolling content (kept clear of the keyboard) with its main action(s) pinned under it. */
export function StepLayout({ children, footer, inset }: PropsWithChildren<{ footer?: ReactNode; inset: number }>) {
  return (
    <>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, footer ? null : { paddingBottom: 24 + inset }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </KeyboardAwareScrollView>
      {footer ? <Footer inset={inset}>{footer}</Footer> : null}
    </>
  );
}

/** A pinned bar for a step's main action(s), under the scrolling content. */
export function Footer({ children, inset = 0 }: PropsWithChildren<{ inset?: number }>) {
  const palette = usePalette();
  return <View style={[styles.footer, { backgroundColor: palette.card, borderTopColor: palette.border, marginBottom: inset }]}>{children}</View>;
}

/** A titled group of fields in a card. */
export function Group({ title, hint, children, right }: PropsWithChildren<{ title: string; hint?: string; right?: ReactNode }>) {
  const palette = usePalette();
  return (
    <View style={[styles.group, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.groupHead}>
        <View style={styles.groupCopy}>
          <Text accessibilityRole="header" style={[styles.groupTitle, { color: palette.foreground }]}>
            {title}
          </Text>
          {hint ? <Text style={[styles.groupHint, { color: palette.mutedForeground }]}>{hint}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/**
 * A whole number typed in, as a field with its range. `value` is NaN while the
 * field is empty or not a number, so the screen can tell it can't go on.
 */
export function CountField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  // What is being typed, until the field is left; the number itself is shown otherwise (e.g. after a preset changed it).
  const [draft, setDraft] = useState<string | null>(null);
  const draftIsValue = draft !== null && (draft === '' ? Number.isNaN(value) : Number(draft) === value);
  const text = draftIsValue ? draft : Number.isNaN(value) ? '' : String(value);
  const invalid = !Number.isInteger(value) || value < min || value > max;
  return (
    <Field
      label={label}
      value={text}
      onChangeText={(next) => {
        const digits = next.replace(/[^0-9]/g, '').slice(0, 3);
        setDraft(digits);
        onChange(digits === '' ? Number.NaN : Number(digits));
      }}
      onBlur={() => setDraft(null)}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={3}
      returnKeyType="done"
      accessibilityHint={`From ${min} to ${max}`}
      error={invalid ? `Enter a whole number from ${min} to ${max}.` : null}
      hint={hint}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: 16, gap: 14, paddingBottom: 24 },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  backButton: { width: 40, height: 40, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13 },
  resetButton: { minHeight: 40, paddingHorizontal: 4, justifyContent: 'center' },
  resetText: { fontSize: 14, fontWeight: '600' },
  bar: { flexDirection: 'row', gap: 4 },
  barSegment: { flex: 1, height: 4, borderRadius: 2 },
  pressed: { opacity: 0.7 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, minHeight: 88 },
  choiceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, gap: 3 },
  choiceTitle: { fontSize: 16, fontWeight: '700' },
  choiceText: { fontSize: 13, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 14, gap: 10, borderTopWidth: 1 },
  group: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  groupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  groupCopy: { flex: 1, gap: 3 },
  groupTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.15 },
  groupHint: { fontSize: 13, lineHeight: 18 },
});
