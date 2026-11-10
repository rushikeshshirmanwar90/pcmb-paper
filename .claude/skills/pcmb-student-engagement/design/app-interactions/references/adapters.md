# Adapters: one interaction layer, any visual design

The interaction layer (motion, haptics, states, loading, responsive) is the **same logic** in every part of the app. Only its *look* changes with the visual design of the area it runs in. This file defines:
- the small **kit contract** the code in this skill uses, and how it maps to the app's own components;
- the **design scope** hook that tells an interaction which look to use;
- the **look per design** for every interaction (classic = the app's existing style, neo = neobrutalism-expo).

## 1. Design scope

If the app uses design scopes (e.g. neobrutalism for the student login only, via neobrutalism-expo's scoped-adoption.md), the app already has a `useDesign()` hook. If it doesn't, add this fallback so every adapter works with the app's own look:

```ts
// lib/design-scope.ts (fallback when the app has a single visual design)
export type Design = 'classic' | 'neo';
export const useDesign = (): Design => 'classic';
```

Rule: **interaction logic never branches on design. Only looks do.** `useAsyncAction`, `useForm`, haptics, timeouts, offline and race-condition guards behave identically everywhere.

## 2. Kit contract

The code samples in this skill use these names. Map each to the app's component, adapting the sample when names or props differ. **Don't create a second kit.**

| Contract | What it must do | neo scope (neobrutalism-expo) | classic scope: map to the app's own (pcmb-paper example) |
|---|---|---|---|
| `usePalette()` | tokens `ink`, `inkSoft`, `surface`, `subtle`, `canvas`, `border`, `primary`, `primarySoft`, `success(Soft)`, `danger(Soft)`, `dangerInk`, `warning(Soft)` | preset palette | the app's palette (pcmb already has all these names) |
| `AppText` (`variant`, `soft`) | typography variants: display, title, heading, subheading, body, bodySm, label, caption | `NeoText` | the app's text component; or `Text` + the app's type styles, with `soft` → `inkSoft` (pcmb: `Text` / `Muted`) |
| `Card` (`style`, optional `tone`, `elevation`) | grouped surface | neo `Card` | the app's `Card` (pcmb `Card`); tone → `backgroundColor` from the palette |
| `Button` (`label`, `variant`, `size`, `loading`, `disabled`, `disabledReason`, `onPress`) | actions with busy and disabled states | neo `Button` | the app's `Button` (pcmb `Button` has `loading`/`disabled`; **add `disabledReason`**: helper text under it + `accessibilityHint`) |
| `Alert` (`kind`, `title`, `body`, `action`) | inline screen-level message | neo `Alert` | pcmb `Notice` |
| `ErrorState` (`message`, `onRetry`) | full-area error | neo `ErrorState` | pcmb `ErrorView` |
| `EmptyState` (`title`, `body`, `action`) | full-area empty | neo `EmptyState` | pcmb `EmptyView` |
| `useDesignTokens()` | `borderWidth`, `radius.{xs,sm,md,lg,full}` | preset values (2, preset radii) | the app's values (e.g. `StyleSheet.hairlineWidth`, its radius constants) |

Fallback `useDesignTokens` for a single-design app:

```ts
import { StyleSheet } from 'react-native';
export const useDesignTokens = () => ({ borderWidth: StyleSheet.hairlineWidth, radius: { xs: 4, sm: 8, md: 12, lg: 16, full: 999 } });
```

## 3. Look per design

| Interaction | classic (the app's look) | neo (neobrutalism-expo) |
|---|---|---|
| Press feedback | `PressScale`: scale 0.97 + opacity 0.9 while pressed (below) | `PressableNeo`: the face slides into its hard shadow |
| Hover (web) | opacity 0.85 | face tinted 12% lighter |
| Focus ring (web/keyboard) | 2px `primary` outline, offset 2 | 2px `ink` outline, offset 2 |
| Disabled | 50% opacity + `disabledReason` text | the same (border and shadow kept) |
| Busy button | the app's spinner in the button, label kept | the same, spinner in ink |
| Skeleton frame | the app's `Card` around flat `subtle` bones | neo `Card` (ink border + shadow) around flat bones |
| Loader | `DotsLoader` classic: three soft `primary` dots | `DotsLoader` neo: three bordered squares (primary / highlight / success) |
| Toast | the app's card style, raised (soft shadow allowed in classic) | neo card, `shadow.lg` |
| Error / empty / offline | the app's ErrorView / EmptyView / Notice | neo ErrorState / EmptyState / Alert |
| Progress bar | the app's `ProgressBar`, width animated with `useFill` | neo paper-strip bar, width animated with `useFill` |
| Correct / wrong answer | fill turns `successSoft` / `dangerSoft` + the same pop/shake + haptic | fill turns `success` / `danger` + the same pop/shake + haptic |
| Celebration art | an illustration, badge icon or emoji in a card | a Sticker or neo illustration |
| Dividers | `hairlineWidth` `border` | 2px `ink` |

Motion timings, springs, haptics, the motion budget, reduced-motion behavior and accessibility are **identical** in both.

## 4. Classic press feedback

```tsx
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Press feedback for the classic look: a quick, subtle press-in. Haptics follow motion.md (fire on commit). */
export function PressScale({ style, haptic: kind = false, onPress, onPressIn, onPressOut, disabled, ...rest }: PressableProps & {
  style?: StyleProp<ViewStyle>; haptic?: 'select' | 'tap' | false;
}) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 0.9 + (s.value - 0.97) * (0.1 / 0.03) }));
  const to = (v: number) => (reduce ? withTiming(v, { duration: 0 }) : withSpring(v, Motion.spring.press));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => { if (!disabled) s.value = to(0.97); onPressIn?.(e); }}
      onPressOut={(e) => { s.value = to(1); onPressOut?.(e); }}
      onPress={(e) => { if (kind) haptic[kind](); onPress?.(e); }}
      style={[{ opacity: disabled ? 0.5 : 1 }, style, anim]}
    />
  );
}
```

In a scoped app, the kit's pressable primitive picks one: `useDesign() === 'neo' ? <PressableNeo …/> : <PressScale …/>`. Screens never choose.

## 5. Applying the layer to an app with design scopes

1. Add the interaction primitives **once** in the kit (`lib/haptics.ts`, `Motion`, hooks, `useAsyncAction`, `AsyncView`, skeletons, `DotsLoader`, `ToastProvider`, `useOnline`, `useForm`, `useLayout`).
2. Wherever a look differs, branch inside the kit component on `useDesign()`. Screens import one name.
3. Wire the behavior **per role/area**, in the order of motion.md's catalogue and states-and-async.md. The same rules apply to every role.
4. Verify every role: motion, haptics and states should feel identical, and only the styling differs.
