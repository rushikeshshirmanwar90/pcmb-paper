# Motion & haptics (Expo / React Native)

Good app motion is **physical, short and snappy**: things press down, pop once, wobble once, and settle. (In neobrutalism scope they behave like thick paper cards and chunky buttons.) There is no floating, no decorative fading, no parallax and no looping decoration.

The goal for a student-facing app: **every animation answers "did that work?" or "you did well."** If a motion gives neither feedback nor reward, delete it.

Requires `react-native-reanimated` (Expo default) and `expo-haptics` (`npx expo install expo-haptics`). Every interaction here behaves the same in every visual design; only the look changes (adapters.md). For spring physics and interruptibility principles, defer to the **apple-design** skill. This file decides *where* motion and haptics are allowed, and how much.

## The motion budget (the rule that prevents over-animation)

1. **Only four kinds of motion exist:**
   - **Press**: instant pressed feedback on every pressable: `PressScale` in the classic look, `PressableNeo` (slides into its shadow) in neo scope (adapters.md).
   - **Feedback**: correct pop, wrong shake, field error shake. Plays once, in response to the student's action.
   - **Reward**: progress fill, score count-up, streak bump, completion sticker. Only after an achievement.
   - **Orientation**: tab indicator slide, sheet slide-up, question-to-question slide, first-mount list stagger. Explains where something came from.
2. **One reward at a time per screen.** Never chain two celebrations.
3. **Nothing loops** except *while something is actually loading* (the synced skeleton pulse, `DotsLoader`, spinners, all stopped under Reduce Motion) and the test timer's last-60-seconds pulse. No idle wiggles, bouncing arrows or shimmer gradients. Loops stop the moment content arrives.
4. **Entrance animations run once per screen visit**, never on re-render, refetch, pull-to-refresh or scrolling back. Only the first 6 list items stagger.
5. **Durations are 120–320ms. Nothing exceeds 400ms**, except the results celebration (≤ 900ms total).
6. **Never block input.** Everything is interruptible, and taps during an animation work immediately.
7. **Animate only `transform`, `opacity`, colors, and the width of progress bars.** Never animate `boxShadow`, borders, padding or layout sizes.
8. **Reduced motion** (`useReducedMotion()` / `ReduceMotion.System`): keep the press shift, color changes and haptics. Drop scale, shake, rotate, slide and stagger, and show final states instantly.

## Motion tokens

```ts
import { Easing } from 'react-native-reanimated';

export const Motion = {
  dur: { fast: 120, base: 180, slow: 260, reward: 320 },
  ease: Easing.out(Easing.cubic),                     // for withTiming (colors, opacity, bar width)
  spring: {
    press:  { damping: 22, stiffness: 600, mass: 0.6 }, // button into shadow, no visible bounce
    pop:    { damping: 12, stiffness: 380, mass: 0.7 }, // return from a pop, one small overshoot
    settle: { damping: 20, stiffness: 260, mass: 0.9 }, // sheets, indicators, cards arriving
  },
  stagger: 40,         // ms between list items, first 6 only
  shake: { distance: 6, step: 55 },
  pop: { scale: 1.08, up: 90 },   // quick timing up, spring back; never above 1.1
  tilt: 3,             // degrees, sticker/streak wobble only
} as const;
```

## Haptics: very few, always meaningful

Vibration is reserved for **learning moments**. The whole app vibrates in only these places:

| Event | Kind | iOS | Android (real haptic engine) |
|---|---|---|---|
| Choosing an answer in **test mode** (no instant reveal) | `select` | `selectionAsync()` | `AndroidHaptics.Segment_Tick` |
| Primary action: Start test, Submit, Save | `tap` | `impactAsync(Light)` | `AndroidHaptics.Context_Click` |
| Correct answer, test submitted, chapter complete | `success` | `notificationAsync(Success)` | `AndroidHaptics.Confirm` |
| Wrong answer, form/room-code error | `error` | `notificationAsync(Error)` | `AndroidHaptics.Reject` |
| Timer reaches the last 60s (once) | `warning` | `notificationAsync(Warning)` | `AndroidHaptics.Long_Press` |
| Streak increased, badge unlocked | `bump` | `impactAsync(Medium)` | `AndroidHaptics.Confirm` |

**Silent:** tabs, chips, filters, segmented controls, toggles, list rows, navigation, scrolling, keypad digits, secondary buttons, pull-to-refresh.

`performAndroidHapticsAsync` uses Android's haptic engine (crisp, no `VIBRATE` permission). The older `impactAsync`/`notificationAsync` are simulated with the vibration motor on Android and feel buzzy, so they are only the fallback.

```ts
// lib/haptics.ts
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type Kind = 'select' | 'tap' | 'success' | 'error' | 'warning' | 'bump';
const PRIORITY: Record<Kind, number> = { select: 0, tap: 1, bump: 2, warning: 2, success: 3, error: 3 };

let enabled = true;                   // hydrate from the app's preferences store at startup
let last = { at: 0, priority: -1 };
export const setHapticsEnabled = (v: boolean) => { enabled = v; };

const ios: Record<Kind, () => Promise<void>> = {
  select: () => Haptics.selectionAsync(),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  bump: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
const android: Record<Kind, Haptics.AndroidHaptics> = {
  select: Haptics.AndroidHaptics.Segment_Tick,
  tap: Haptics.AndroidHaptics.Context_Click,
  bump: Haptics.AndroidHaptics.Confirm,
  success: Haptics.AndroidHaptics.Confirm,
  error: Haptics.AndroidHaptics.Reject,
  warning: Haptics.AndroidHaptics.Long_Press,
};

function fire(kind: Kind) {
  if (!enabled || Platform.OS === 'web') return;
  const now = Date.now();
  // Within 150ms, only a MORE important haptic may follow (a "correct" right after a tick still plays).
  if (now - last.at < 150 && PRIORITY[kind] <= last.priority) return;
  last = { at: now, priority: PRIORITY[kind] };
  const run = Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync(android[kind]).catch(() => ios[kind]())
    : ios[kind]();
  run.catch(() => {});
}

export const haptic = {
  select: () => fire('select'), tap: () => fire('tap'), bump: () => fire('bump'),
  success: () => fire('success'), error: () => fire('error'), warning: () => fire('warning'),
};
```

Add a **"Vibration" switch** in profile/settings that calls `setHapticsEnabled` and persists the value with the app's existing preferences/secure-store service. Turning it off must silence everything.

## Hooks

```ts
import { useEffect, useRef } from 'react';
import { useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming, cancelAnimation } from 'react-native-reanimated';

/** One-shot horizontal shake: wrong answer, invalid field or code. */
export function useShake() {
  const x = useSharedValue(0);
  const reduce = useReducedMotion();
  const shake = () => {
    if (reduce) return;
    const { distance: d, step } = Motion.shake;
    x.value = withSequence(
      withTiming(-d, { duration: step }), withTiming(d, { duration: step }),
      withTiming(-d / 2, { duration: step }), withTiming(d / 2, { duration: step }),
      withTiming(0, { duration: step }),
    ); // ≈ 275ms
  };
  return { x, shake }; // style: transform: [{ translateX: x.value }]
}

/** One-shot pop: quick scale up, springy settle back. Correct check, streak number, badge. */
export function usePop() {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  const pop = () => {
    if (reduce) return;
    s.value = withSequence(
      withTiming(Motion.pop.scale, { duration: Motion.pop.up, easing: Motion.ease }),
      withSpring(1, Motion.spring.pop),
    );
  };
  return { s, pop }; // style: transform: [{ scale: s.value }]
}

/**
 * Progress bar fill (0..1). Increases animate; decreases jump (never animate "losing").
 * fromZero: animate from 0 on mount (results screen). Otherwise starts at the value.
 */
export function useFill(progress: number, { fromZero = false } = {}) {
  const w = useSharedValue(fromZero ? 0 : progress);
  useEffect(() => {
    if (progress < w.value) { w.value = progress; return; }
    w.value = withTiming(progress, { duration: Motion.dur.reward, easing: Motion.ease });
  }, [progress]);
  return w; // style: width: `${w.value * 100}%`
}

/** Test-timer pulse: the only allowed loop. Active only while `on`. */
export function usePulse(on: boolean) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (on && !reduce) s.value = withRepeat(withSequence(withTiming(1.04, { duration: 220 }), withTiming(1, { duration: 280 }), withTiming(1, { duration: 500 })), -1);
    else { cancelAnimation(s); s.value = 1; }
    return () => cancelAnimation(s);
  }, [on, reduce]);
  return s;
}

/**
 * True only during the first ~700ms after a screen mounts. Gate list `entering` animations with it,
 * so FlatList windowing (items re-mounting when you scroll back) and refetches never replay them.
 */
export function useEntranceWindow(ms = 700) {
  const open = useRef(true);
  useEffect(() => { const t = setTimeout(() => (open.current = false), ms); return () => clearTimeout(t); }, []);
  return open;
}
```

List usage:

```tsx
const entrance = useEntranceWindow();
const reduce = useReducedMotion();
// in renderItem:
<Animated.View entering={entrance.current && !reduce && index < 6
  ? FadeInDown.duration(Motion.dur.base).delay(index * Motion.stagger)
  : undefined}>
  <StudentRow item={item} />
</Animated.View>
```

## CountUp (score / percentage)

No extra library: an animated, non-editable `TextInput` whose `text` prop is driven on the UI thread.

```tsx
import { useEffect } from 'react';
import { TextInput } from 'react-native';
import Animated, { useAnimatedProps, useDerivedValue, useSharedValue, withTiming, useReducedMotion } from 'react-native-reanimated';

const AnimatedText = Animated.createAnimatedComponent(TextInput);

/** Pass the app's display text style as `style` (neo: textStyles.display). */
export function CountUp({ to, suffix = '', style, duration = 600 }: { to: number; suffix?: string; style?: any; duration?: number }) {
  const v = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { v.value = reduce ? to : withTiming(to, { duration, easing: Motion.ease }); }, [to]);
  const text = useDerivedValue(() => `${Math.round(v.value)}${suffix}`);
  const animatedProps = useAnimatedProps(() => ({ text: text.value, defaultValue: text.value }) as any);
  return (
    <AnimatedText editable={false} underlineColorAndroid="transparent" animatedProps={animatedProps}
      accessibilityLabel={`${to}${suffix}`} style={[{ padding: 0, fontSize: 32, fontVariant: ['tabular-nums'] }, style]} />
  );
}
```

## Student interaction catalogue

Use these patterns. Anything not listed stays still.

### Answer option (MCQ): the app's option component (neo scope: `AnswerOption` in neobrutalism-expo components.md)
- **Test mode, select**: press shift, fill turns `primarySoft`, letter badge fills. Haptic `select` (parent calls it).
- **Practice mode, correct**: fill → `success` (classic: `successSoft` with a `success` border), check icon pops (`usePop`). Haptic `success`. No `select` tick before it.
- **Practice mode, wrong**: fill → `danger` (classic: `dangerSoft` with a `danger` border), the option shakes once. The correct option turns `successSoft` with a check and **no pop** (the pop is for getting it right). Haptic `error`.
- Answered options are `locked`: no press shift, no second haptic.

### Question to question
- The question card slides 24px and fades (`Motion.dur.slow`, `spring.settle`), direction matching next/previous. It's not a full-screen push.
- Question palette (number grid): answered cells turn `success` instantly, the current cell has `shadow.md`, and a flagged cell's tag pops once. Silent.

### Test timer
- Normal: static chip.
- Last 60s: chip turns `warning` and pulses (`usePulse`). Haptic `warning` once.
- Last 10s: chip turns `danger`, pulse continues. No more haptics.

### Submit → results
1. Submit: haptic `tap`. The button shows its spinner (label stays). No full-screen overlay.
2. Results: the score card arrives from 16px below with `spring.settle`, and the score runs through `CountUp` (≤ 600ms). Then **exactly one** reward:
   - **≥ 80%**: a celebration graphic (neo: a `Sticker`; classic: a badge illustration or trophy icon in a card) drops in, rotating −10° → −4° with `spring.pop`. Haptic `success`.
   - **50–79%**: the progress bar/ring fills (`useFill({ fromZero: true })`). Haptic `success`.
   - **< 50%**: no celebration and no haptic. A calm, encouraging line and a primary "Practise weak topics" button. Never a sad or negative animation.
3. Topic breakdown bars fill with the 40ms stagger (first 6), all silent.

### Streaks, badges, chapters
- Streak increases: the number pops and the flame tilts ±3° once. Haptic `bump`. Only on an actual increase, at most once per day.
- Badge unlocked: a bottom sheet slides up (`spring.settle`) with the badge art (neo: a `Sticker`) that pops in. Haptic `bump`. One "Nice!" button closes it.
- Syllabus topic ticked: the check pops, the chapter bar fills, silent. A whole chapter completed: haptic `success`.

### Forms (login, join tuition, room code)
- New field error: the field shakes once, the border turns `dangerInk`, the message appears. Haptic `error` (built into `Field`).
- Room/OTP code complete and valid: all cells flash `success` (timing 160ms), then navigate. Invalid: the row shakes, haptic `error`, cells clear.
- Primary submit success: navigate right away. Don't hold the student on a success animation.

### Onboarding & loading (all silent)
- Pager: slides follow the finger (native pager); page dots widen the active dot with `spring.settle` (neo: `PageDots` in neobrutalism-expo patterns.md).
- (neo scope) The highlighted headline word may **wipe in once** on the first onboarding slide: the highlight block scales X from 0 → 1 (transform origin left, `Motion.dur.slow`), after the headline has rendered. Not on later slides, and not on revisits.
- Doodles and illustrations fade in with the slide (`FadeIn.duration(Motion.dur.base)`). No floating, spinning or bobbing.
- Generating screen: each checklist row's check pops once when its step really finishes, and the progress bar fills with `useFill`. If progress is unknown, show the spinner row only. Never fake a looping bar.

### Animated graphics (neobrutalism-expo graphics.md, or the app's own art)
- Frame animations (animated WebP from `export_assets.py anim`) **play once**, ≤ 900ms for celebrations, and are mounted at the moment they celebrate (badge unlocked, results ≥ 80%), never on screen load "just because".
- Reduced motion, or when the moment has passed: show the `end` still instead.
- At most one animated graphic per screen, never on task screens, never looping. A still that only needs to "arrive" uses `usePop` / `entering` instead of frames.

### Navigation & surfaces (all silent)
- Tab switch: the mustard indicator slides (`spring.settle`, animate `translateX` of the indicator only).
- Segmented control: same indicator slide.
- Sheets: slide up with `spring.settle`, backdrop fades 180ms, dismiss uses `Motion.dur.fast`.
- Lists: first-visit stagger gated by `useEntranceWindow`.
- Empty states: static. An optional sticker may tilt once on mount.

## Banned motion
- Card fades/scales while scrolling, parallax headers, auto-advancing carousels.
- Springs with more than one visible overshoot (damping < 10).
- Confetti showers, full-screen Lottie celebrations, and sounds by default.
- Animating `boxShadow`, `borderWidth`, padding, or the width/height of layout containers.
- Shaking, red flashes or haptics for a low score.
- Haptics outside the table above.
- Animating KaTeX/WebView content or PDF previews.

## Performance
- Shared values + `useAnimatedStyle` / `useAnimatedProps` only. Migrate the React Native `Animated` API and `LayoutAnimation` to Reanimated, and never drive motion through React state.
- Long lists: no `entering` past index 6, no `itemLayoutAnimation`.
- On a low-end Android device, the time from tapping an answer to the visual response must feel instant (< 50ms). Keep JS work in `onPress` light (save the answer asynchronously).
