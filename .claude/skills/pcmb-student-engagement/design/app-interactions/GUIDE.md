# app-interactions (bundled design guide)

> Part of the **pcmb-student-engagement** skill. Paths in this guide (`references/…`, `scripts/…`) are relative to **this folder**: `${CLAUDE_SKILL_DIR}/design/app-interactions/`.
>
> **What it covers:** Style-independent interaction layer for Expo / React Native apps, applied to every role and every visual design. It covers motion and haptics (a strict motion budget, springs, reduced motion, vibration only for learning moments), interaction states (disabled vs busy vs hidden, double-submit guards, form validation timing), loading (skeletons, loaders, the five data states, refresh, pagination), toasts, offline handling, race conditions and responsive layout (phones to tablets and web, keyboard handling). It works with the app's existing look or with neobrutalism-expo, through adapters. Use it whenever the user wants animations, micro-interactions, haptics or vibration, loading states, skeletons, spinners, button loading or disabled logic, form validation, pull-to-refresh, infinite scroll, offline support, toasts, responsiveness or tablet support, for one screen, one role or the whole app.


# App interactions: motion, states and responsiveness for every screen

This skill makes an app *feel* right: it responds instantly, never double-submits, shows honest loading, recovers from errors, works offline, adapts to every screen size, and moves with restraint. The **logic is identical everywhere**. Only the look adapts to the visual design of each area (adapters.md), so the same skill serves an app whose student login is neobrutalist while the teacher and tuition logins keep their own look.

## Who owns what
- **This skill:** behavior. Motion and haptics, states, async logic, loading, feedback, offline, responsive layout.
- **neobrutalism-expo** (or the app's own design system): the look of each component. With design scopes, the kit picks the look per area.
- **human-friendly-ux:** structure (which content goes on which screen, tabs vs steps vs sheets). Restructure before adding polish.
- **apple-design:** motion physics and feel. Defer to it for spring tuning and gestures.

## Reference files

| File | Read before… |
|---|---|
| `references/adapters.md` | anything else: the kit contract, `useDesign()`, the look of each interaction in classic vs neo scope, `PressScale` |
| `references/states-and-async.md` | any button that calls an API, any screen that loads data, forms, lists, offline, toasts, skeletons, loaders |
| `references/motion.md` | any animation, haptic, timer, results, streak, onboarding or loading motion |
| `references/responsive.md` | small phones, landscape, foldables, tablets, web, keyboard handling |

## Core rules

1. **Logic never depends on the look.** `useAsyncAction`, `useForm`, haptics, timeouts and guards behave identically in every role and design scope. Only kit components branch on `useDesign()`.
2. **Every pressable responds instantly** (< 100ms): `PressScale` in the classic look, `PressableNeo` in neo scope, a `subtle` background for rows.
3. **User actions run through `useAsyncAction` / `AsyncButton`:** single-flight (no double submits), busy after 150ms (no flicker), timeout, abort on unmount, human error messages.
4. **Disabled only with a visible reason** (`disabledReason`). Hide what a role can never do. Keep form submits enabled and show the errors on press.
5. **Data screens use `AsyncView`:** a skeleton on first load (never a full-screen spinner), data kept on refresh, plus error with Retry, empty with one action, and offline with cached data.
6. **Motion budget:** only press, feedback, reward or orientation; 120–320ms; one reward at a time. Nothing loops except loading indicators *while loading* and the last-minute test timer. Reduced motion keeps press feedback, colors and haptics.
7. **Haptics are rare:** only the test-mode answer pick, primary actions, correct/wrong, form errors, the 60s timer warning and achievements, through one `haptic` helper with a user "Vibration" switch.
8. **Responsive by layout, never by shrinking:** size classes by window, centered max-width content, more columns or a split view on wide screens, type that follows the user's font-size setting, and the keyboard never hides the primary button.
9. **Never lose work:** answers and drafts save locally first, survive backgrounding and offline periods, and sync later.

## Workflow

1. **Audit:** list per role the screens that load data, the buttons that call APIs, the forms, the lists and the existing animation code (React Native `Animated`, `LayoutAnimation`, loose `ActivityIndicator`s, full-screen loaders). The bundled neobrutalism-expo `audit.sh` (`${CLAUDE_SKILL_DIR}/design/neobrutalism-expo/scripts/audit.sh`) reports the animation and haptics counts. Restructure screens flagged by the bundled human-friendly-ux audit first.
2. **Foundation (once, in the kit):** the design-scope hook (or the fallback in adapters.md), `lib/haptics.ts` + `Motion` tokens + hooks (motion.md), `useAsyncAction`, `AsyncButton`, `AsyncView`, skeletons, `DotsLoader`, `ToastProvider`, `useOnline`, `useForm` (states-and-async.md), `useLayout`, `Container`, `Grid`, `SplitView` (responsive.md), `PressScale` (adapters.md). **Adapt the app's existing equivalents** (e.g. a `useLoad` hook, a `LoadingView`, a responsive hook) instead of duplicating them. Add a persisted Vibration switch to each role's profile/settings.
3. **Wire one role at a time:** for each role's screens (e.g. student, then teacher, then tuition), wire states (buttons → forms → data screens → lists → offline), then motion in catalogue order (answer feedback → errors → timer → results → progress → achievements → onboarding/loading → navigation → first-visit stagger), then responsive (Container, grids, split views, keyboard).
4. **Verify each role:** network throttled/offline, double-tap every submit, every disabled button shows its reason, Reduce Motion on, Vibration off means silent, the size matrix (320px phone → tablet → web) and maximum font size.

## Per-screen checklist
- [ ] Every API button is single-flight with busy and error states; disabled buttons show why.
- [ ] Loading (skeleton), refresh (data kept), error (Retry), empty (one action), offline: all handled.
- [ ] Press feedback on everything tappable; motion and haptics only as the catalogue allows.
- [ ] Works from 320px phones to tablets/web, with the keyboard open and at max font size.
- [ ] Leaving, backgrounding or losing the network loses nothing.

## Anti-patterns
- Branching business logic on the visual design or role styling.
- Full-screen spinners for first loads, skeletons on refresh, shimmer gradients.
- Buttons clickable while their request runs; disabled buttons with no reason; wiping data on a failed refresh.
- Looping or idle animation, confetti showers, parallax, scroll-triggered fades, haptics on scrolling, tabs or navigation.
- Shrinking fonts on small screens; stretched full-width forms on tablets.
- A second kit just for interactions. Extend the app's kit.
