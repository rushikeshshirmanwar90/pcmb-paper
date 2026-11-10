import React, { type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, usePalette } from '@/components/kit';
import { KeyboardAwareScrollView } from '@/components/keyboard-safe-view';

// Shared pieces for the screens before someone is in a tuition: log in,
// create account, verify email, join tuition and forgot password. One
// leading-aligned column, and one motif taken from an OMR answer sheet: a
// filled bubble is a step that's done, a terracotta ring is the step you're on.

/** The steps of signing up yourself, shown on each of their screens. */
export const SIGN_UP_STEPS = ['Create account', 'Verify email', 'Enter joining code', 'Get approved'] as const;

/** Bubbles stop growing at this text size, so a row of them still fits. */
const BUBBLE_MAX_SCALE = 1.4;

export function AuthScreen({ children, centered = false }: PropsWithChildren<{ centered?: boolean }>) {
  const palette = usePalette();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <KeyboardAwareScrollView contentContainerStyle={[styles.content, centered && styles.centered]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {children}
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The row above the title: a way back or the step, and an action such as Log out. */
export function AuthTopBar({ leading, trailing }: { leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeading}>{leading}</View>
      {trailing}
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} color={palette.primary} size={17} />
      <Text style={[styles.linkText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

/** A text-only button with a full 44 pt tap area. */
export function TextLink({
  label,
  onPress,
  disabled = false,
  align = 'start',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textLink, { alignSelf: ALIGN[align] }, pressed && styles.pressed]}
    >
      <Text style={[styles.linkText, { color: disabled ? palette.mutedForeground : palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;

export function AuthTitle({ title, lead }: { title: string; lead?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
        {title}
      </Text>
      {lead ? <Text style={[styles.lead, { color: palette.mutedForeground }]}>{lead}</Text> : null}
    </View>
  );
}

/** Bold text inside a lead or fine print, e.g. the email a code went to. */
export function Strong({ children }: PropsWithChildren) {
  const palette = usePalette();
  return <Text style={[styles.strong, { color: palette.foreground }]}>{children}</Text>;
}

export function AuthCard({ children }: PropsWithChildren) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>{children}</View>;
}

/** Small help under a card. */
export function FinePrint({ children }: PropsWithChildren) {
  const palette = usePalette();
  return <Text style={[styles.finePrint, { color: palette.mutedForeground }]}>{children}</Text>;
}

/**
 * One answer bubble. ring: the brand or the current step. filled: done.
 * quiet: a step still ahead. `color` overrides the terracotta, e.g. for a warning.
 */
export function Bubble({
  size = 40,
  variant = 'ring',
  color,
  children,
}: PropsWithChildren<{ size?: number; variant?: 'ring' | 'filled' | 'quiet'; color?: string }>) {
  const palette = usePalette();
  const { fontScale } = useWindowDimensions();
  const scaled = Math.round(size * Math.min(Math.max(fontScale, 1), BUBBLE_MAX_SCALE));
  const accent = color ?? palette.primary;
  return (
    <View
      style={[
        styles.bubble,
        {
          width: scaled,
          height: scaled,
          borderRadius: scaled / 2,
          borderWidth: variant === 'quiet' ? 1.5 : 2,
          borderColor: variant === 'quiet' ? palette.borderStrong : accent,
          backgroundColor: variant === 'filled' ? accent : 'transparent',
        },
      ]}
    >
      {children}
    </View>
  );
}

/** A letter or number inside a bubble, in the right colour for its variant. */
export function BubbleText({ children, variant = 'ring', size = 17 }: PropsWithChildren<{ variant?: 'ring' | 'filled' | 'quiet'; size?: number }>) {
  const palette = usePalette();
  const color = variant === 'filled' ? palette.onPrimary : variant === 'quiet' ? palette.mutedForeground : palette.primaryInk;
  return (
    <Text maxFontSizeMultiplier={BUBBLE_MAX_SCALE} style={[styles.bubbleText, { color, fontSize: size }]}>
      {children}
    </Text>
  );
}

/** "Step 2 of 4" with a bubble per step: filled when done, a ring for this one. */
export function StepProgress({ step, style }: { step: 1 | 2 | 3 | 4; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  const total = SIGN_UP_STEPS.length;
  return (
    <View accessible accessibilityLabel={`Step ${step} of ${total}: ${SIGN_UP_STEPS[step - 1]}`} style={[styles.steps, style]}>
      <View style={styles.stepBubbles}>
        {SIGN_UP_STEPS.map((name, i) => {
          const variant = i + 1 < step ? 'filled' : i + 1 === step ? 'ring' : 'quiet';
          return (
            <Bubble key={name} size={26} variant={variant}>
              {variant === 'filled' ? (
                <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.onPrimary} size={13} />
              ) : (
                <BubbleText variant={variant} size={13}>
                  {i + 1}
                </BubbleText>
              )}
            </Bubble>
          );
        })}
      </View>
      <Text style={[styles.stepLabel, { color: palette.mutedForeground }]}>
        Step {step} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pressed: { opacity: 0.6 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, width: '100%', maxWidth: 440, alignSelf: 'center' },
  centered: { justifyContent: 'center', paddingTop: 32 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, marginBottom: 16 },
  topBarLeading: { flexShrink: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingRight: 8, marginLeft: -2 },
  textLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  linkText: { fontSize: 15, fontWeight: '700' },
  heading: { gap: 6, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  lead: { fontSize: 15, lineHeight: 21 },
  strong: { fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  finePrint: { fontSize: 13, lineHeight: 19, marginTop: 16 },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontWeight: '800' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBubbles: { flexDirection: 'row', gap: 5 },
  stepLabel: { fontSize: 13, fontWeight: '600' },
});
