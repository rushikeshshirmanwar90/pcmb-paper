# States, async logic, loading & interaction

This file covers the *feature logic* behind every interactive element, identical for every role and every visual design: when a button is enabled, disabled or busy; how loading looks at each stage; how forms validate; how lists load more; what happens offline; and how to stop double submits and race conditions. Code uses the kit contract in adapters.md (`AppText`, `Card`, `Button`, `Alert`, `ErrorState`, `usePalette`, `useDesignTokens`, `useDesign`), so map those to the app's own components. Motion comes from motion.md.

## 1. The state model

Every interactive element is always in exactly one of these states, and each looks different:

| State | Meaning | Look (classic · neo, see adapters.md) | Accessibility |
|---|---|---|---|
| idle | ready | normal | n/a |
| pressed | finger down | classic: scale 0.97 · neo: face slides into the shadow | n/a |
| focused | keyboard/web focus | 2px focus ring, offset 2 (`primary` classic · `ink` neo) | native focus |
| hovered (web) | pointer over | classic: opacity 0.85 · neo: face tinted 12% lighter | n/a |
| **disabled** | can't be used *right now* | 50% opacity, structure unchanged, **reason visible nearby** | `accessibilityState.disabled` + `accessibilityHint` = the reason |
| **busy** | working on *this* action | full color, spinner replaces the icon, label stays, presses ignored | `accessibilityState.busy` |
| success | just finished | label → ✓ + past tense ("Saved") for ~800ms, then back or navigate | announce "Saved" |
| error | failed | button returns to idle; the error shows inline or as a toast with Retry | announce the error |

## 2. Disabled, busy or hidden? (decision rules)

| Situation | Do | Why |
|---|---|---|
| The user **never** has permission (student viewing a teacher action) | **Hide** it | A permanently disabled control is noise |
| A precondition is missing and **visible on the same screen** (pick at least 1 question; accept the terms) | **Disable** + helper text under the button ("Pick at least 1 question") | Tells them what to do next (goal-gradient) |
| A form has invalid or empty fields | **Keep the submit enabled.** On press, show all errors inline, focus and scroll to the first one | Disabled submits hide *why*. Users press, nothing happens, and they're stuck |
| Exception: short forms (≤ 3 fields) with one obvious requirement (an OTP of 6 digits) | Disable until complete (auto-submit when complete is even better) | The reason is self-evident |
| An async action is running | **Busy** on that button. Disable *conflicting* controls (other submit buttons on the form, destructive actions, inputs become read-only). Leave navigation and unrelated controls alone | Prevents double submits without freezing the app |
| Offline and the action needs the network | Disable with "You're offline" helper text, **or** queue it and say "Will send when online" | Honest status |
| A rate limit or cooldown applies (resend OTP) | Disable with a countdown in the label ("Resend in 0:24") | Shows when it comes back |
| A loading list is refreshing | Keep the list usable; show a pull indicator or a small "Updating…" note | Never block reading because of a refresh |

Never: a disabled button with no visible reason; a spinner that replaces the whole screen for a button action; re-enabling a submit before the response returns; hiding an error by resetting the form.

## 3. `useAsyncAction`: one safe way to run user actions

```tsx
type Status = 'idle' | 'pending' | 'success' | 'error';

/**
 * Single-flight async action with:
 * - double-submit guard (a ref, not state, so two fast taps can't both start)
 * - no spinner flicker (busy shows only after 150ms; once shown it stays ≥ 400ms)
 * - timeout + cancellation (AbortController), unmount safety
 * - human error messages, and haptics on success/error
 */
export function useAsyncAction<A extends unknown[], R>(
  fn: (signal: AbortSignal, ...args: A) => Promise<R>,
  { timeoutMs = 15000, successMs = 800, onSuccess, onError, haptics = true }: {
    timeoutMs?: number; successMs?: number; onSuccess?: (r: R) => void; onError?: (msg: string) => void; haptics?: boolean;
  } = {},
) {
  const [status, setStatus] = useState<Status>('idle');
  const [showBusy, setShowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => { mounted.current = false; ctrl.current?.abort(); }, []);

  const run = useCallback(async (...args: A) => {
    if (inFlight.current) return;                       // ignore double taps
    inFlight.current = true;
    setError(null); setStatus('pending');
    const c = new AbortController(); ctrl.current = c;
    const shownAt = { t: 0 };
    const busyTimer = setTimeout(() => { if (mounted.current) { setShowBusy(true); shownAt.t = Date.now(); } }, 150);
    const timeout = setTimeout(() => c.abort(), timeoutMs);
    const settle = async () => {
      clearTimeout(busyTimer); clearTimeout(timeout);
      if (shownAt.t) await new Promise((r) => setTimeout(r, Math.max(0, 400 - (Date.now() - shownAt.t))));
    };
    try {
      const r = await fn(c.signal, ...args);
      await settle();
      if (!mounted.current) return;
      setShowBusy(false); setStatus('success');
      if (haptics) haptic.success();
      AccessibilityInfo.announceForAccessibility?.('Done');
      onSuccess?.(r);
      setTimeout(() => mounted.current && setStatus((s) => (s === 'success' ? 'idle' : s)), successMs);
      return r;
    } catch (e) {
      await settle();
      if (!mounted.current) return;
      const msg = humanError(e, c.signal.aborted);
      setShowBusy(false); setStatus('error'); setError(msg);
      if (haptics) haptic.error();
      AccessibilityInfo.announceForAccessibility?.(msg);
      onError?.(msg);
    } finally {
      inFlight.current = false;
    }
  }, [fn, timeoutMs, successMs, onSuccess, onError, haptics]);

  return { run, status, busy: status === 'pending', showBusy, error, reset: () => { setStatus('idle'); setError(null); } };
}

/** Map technical failures to sentences people can act on. */
export function humanError(e: unknown, aborted: boolean): string {
  if (aborted) return 'This is taking too long. Check your connection and try again.';
  const m = e instanceof Error ? e.message : String(e);
  if (/network|fetch|failed to fetch|ECONN|offline/i.test(m)) return 'You seem to be offline. Try again when connected.';
  if (/401|unauthor/i.test(m)) return 'Your session expired. Please sign in again.';
  if (/403|forbidden/i.test(m)) return "You don't have access to do this.";
  if (/409|conflict/i.test(m)) return 'Someone else changed this. Refresh and try again.';
  if (/5\d\d|server/i.test(m)) return 'Our server had a problem. Try again in a moment.';
  return m.length < 120 ? m : 'Something went wrong. Try again.';
}
```

Use `busy` (true immediately) to block input and `showBusy` (after 150ms) to show the spinner. Fast actions then never flash a spinner, and slow ones never flicker.

### `AsyncButton`

```tsx
export function AsyncButton({ label, successLabel, onPress, ...rest }: Omit<ButtonProps, 'onPress' | 'loading'> & {
  successLabel?: string; onPress: (signal: AbortSignal) => Promise<unknown>;
}) {
  const action = useAsyncAction(onPress);
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Button
        {...rest}
        label={action.status === 'success' && successLabel ? successLabel : label}
        icon={action.status === 'success' ? 'check' : rest.icon}
        loading={action.showBusy}
        disabled={rest.disabled}
        onPress={action.busy ? undefined : () => action.run()}
      />
      {action.error && <AppText variant="caption" style={{ color: p.dangerInk }} accessibilityLiveRegion="polite">{action.error}</AppText>}
    </View>
  );
}
// <AsyncButton label="Create test" successLabel="Created" variant="primary" onPress={(signal) => api.createTest(draft, { signal })} />
```

While it's busy, make the form's inputs `editable={false}` and disable other submit buttons. Leave back navigation working: if the request can continue in the background, let it, and show the result as a toast.

## 4. Loading a screen: the five data states

| Phase | Show | Never |
|---|---|---|
| < 150ms | nothing new (avoid flashes) | a skeleton blink |
| **First load** (no data yet) | a **skeleton** shaped like the real content | a full-screen spinner over a blank page |
| still loading after 3s | the skeleton + "Still loading…" caption | an infinite skeleton with no feedback |
| after 10–15s | an error state with Retry (via the timeout) | waiting forever |
| **Refresh** (data exists) | the data + pull-to-refresh indicator or a small header "Updating…" | replacing data with a skeleton |
| **Error with data** | keep the data + an inline Alert "Couldn't refresh. Retry" | wiping good data |
| **Error without data** | an error state: what happened + Retry (+ Contact/Help if repeated) | a raw error message or stack trace |
| **Empty** | an empty state: why it's empty + the one action that fills it | a blank list |
| **Offline** | cached data + an offline banner; actions that need the network are disabled with a reason | silent failures |

```tsx
/** Maps a load result (e.g. the app's useLoad: { data, loading, error, refreshing, reload }) to the right state UI. */
export function AsyncView<T>({ state, skeleton, empty, isEmpty = (d: T) => Array.isArray(d) && d.length === 0, label, children }: {
  state: { data: T | null; loading: boolean; error: string | null; refreshing?: boolean; reload: () => void };
  skeleton: ReactNode; empty: ReactNode; isEmpty?: (d: T) => boolean; label: string; children: (data: T) => ReactNode;
}) {
  const [slow, setSlow] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!state.loading) { setSlow(false); setVisible(false); return; }
    const a = setTimeout(() => setVisible(true), 150);
    const b = setTimeout(() => setSlow(true), 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [state.loading]);

  if (state.loading) {
    if (!visible) return null;
    return (
      <View accessible accessibilityLabel={`Loading ${label}`} accessibilityState={{ busy: true }} style={{ gap: 12 }}>
        {skeleton}
        {slow && <AppText variant="caption" soft style={{ textAlign: 'center' }}>Still loading…</AppText>}
      </View>
    );
  }
  if (state.data == null) {
    return <ErrorState message={state.error ?? 'Something went wrong.'} onRetry={state.reload} />;
  }
  return (
    <>
      {state.error && <Alert kind="error" title="Couldn't refresh" body={state.error} action={<Button size="sm" variant="outline" label="Retry" onPress={state.reload} />} />}
      {isEmpty(state.data) ? empty : children(state.data)}
    </>
  );
}
```

## 5. Skeletons

Skeletons show the **structure** of what's coming: the real card component as the frame (classic: the app's card; neo: ink border + hard shadow) with flat placeholder blocks inside, so nothing jumps when the data lands.

```tsx
// One shared pulse so every skeleton on screen breathes together (a moving field of out-of-sync blocks looks broken).
const PulseCtx = createContext<SharedValue<number> | null>(null);

export function SkeletonProvider({ children }: PropsWithChildren) {
  const v = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { v.value = 1; return; }
    v.value = withRepeat(withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(v);
  }, [reduce]);
  return <PulseCtx.Provider value={v}>{children}</PulseCtx.Provider>;
}

export function Bone({ w = '100%', h = 14, r, style }: { w?: DimensionValue; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const t = useDesignTokens();
  const radius = r ?? t.radius.xs;
  const pulse = useContext(PulseCtx);
  const a = useAnimatedStyle(() => ({ opacity: pulse ? pulse.value : 1 }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: radius, backgroundColor: p.subtle }, a, style]} />;
}

export const SkeletonText = ({ lines = 3 }: { lines?: number }) => (
  <View style={{ gap: 8 }}>{Array.from({ length: lines }, (_, i) => <Bone key={i} w={i === lines - 1 ? '60%' : '100%'} />)}</View>
);

/** Placeholder row inside a real Card: the layout is final from frame one. */
export const SkeletonRow = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
    <Bone w={40} h={40} r={20} />
    <View style={{ flex: 1, gap: 8 }}><Bone w="55%" h={14} /><Bone w="35%" h={11} /></View>
    <Bone w={44} h={22} r={999} />
  </View>
);

export const SkeletonList = ({ rows = 5 }: { rows?: number }) => (
  <SkeletonProvider>
    <Card>{Array.from({ length: Math.min(rows, 6) }, (_, i) => <SkeletonRow key={i} />)}</Card>
  </SkeletonProvider>
);
```

Rules: placeholder blocks have **no borders** (borders mean "real and interactive"); the surrounding frame is the real card component. Show at most 6 rows, matching the real row height. Never show a skeleton for a refresh. With reduced motion the pulse stops (static blocks). No shimmer gradients: one calm, synced pulse reads as "loading" in every style.

## 6. Loaders

| Wait | Indicator |
|---|---|
| Inside a button | `ActivityIndicator` in the button's ink color (replaces the icon; the label stays) |
| A content area, unknown duration | skeleton (first load) or `DotsLoader` (an action in progress, e.g. "Submitting test…") |
| Known progress (upload, generating, syncing N items) | `ProgressBar` with real values + a step label. Never fake progress |
| Long multi-step jobs (> 5s) | a checklist + real progress + the option to leave and be notified (neo: the Generating archetype in neobrutalism-expo patterns.md) |

```tsx
/** Three hopping marks: calm and obviously "working". Classic: soft primary dots. Neo: bordered squares. */
export function DotsLoader({ size = 12, label = 'Loading' }: { size?: number; label?: string }) {
  const p = usePalette();
  const neo = useDesign() === 'neo';
  const reduce = useReducedMotion();
  const colors = neo ? [p.primary, (p as any).highlight ?? p.warning, p.success] : [p.primary, p.primary, p.primary];
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ flexDirection: 'row', gap: size / 2, alignItems: 'flex-end', height: size * 2 }}>
      {colors.map((c, i) => (
        <Hop key={i} i={i} size={size} color={c} still={reduce}
          mark={neo ? { borderRadius: 3, borderWidth: 2, borderColor: p.ink } : { borderRadius: size / 2, opacity: 0.55 + i * 0.2 }} />
      ))}
    </View>
  );
}
function Hop({ i, size, color, still, mark }: { i: number; size: number; color: string; still: boolean; mark: ViewStyle }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    y.value = withDelay(i * 120, withRepeat(withSequence(withTiming(-size * 0.6, { duration: 220 }), withTiming(0, { duration: 220 }), withTiming(0, { duration: 300 })), -1));
    return () => cancelAnimation(y);
  }, [still]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: size, height: size, backgroundColor: color }, mark, s]} />;
}
```

With reduced motion, the marks stay still (the label is still announced). Use a single loader per screen, centered in the area that's loading, never over content that's still usable.

## 7. Forms: validation and submit logic

- **When to validate:** format errors **on blur** (email, room code); clear an error **as soon as** the input becomes valid (on change); required fields only **on submit**. Never yell at an untouched field.
- **On submit:** validate everything → if invalid, show all errors, focus the first invalid field, scroll it into view, and fire `haptic.error()` once (not per field) → if valid, `AsyncButton` runs.
- **Server errors** map to fields when possible ("Room code already used" under the field), otherwise an Alert above the button. Never clear the user's input on error.
- **While submitting:** the button is busy, inputs are read-only, and the keyboard stays open only if the user may need to edit after an error.
- **Help, don't block:** helper text under fields explains format before errors happen ("6 characters, like NEET42"). Character counters only near the limit.
- **Drafts:** long forms autosave (human-friendly-ux → expo-navigation.md §3). Leaving with unsaved, unsavable changes asks once.

```tsx
/** Tiny field-validation helper: touched-aware errors, focus-first-invalid on submit. */
export function useForm<V extends Record<string, string>>(initial: V, rules: Partial<Record<keyof V, (v: string, all: V) => string | null>>) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const refs = useRef<Partial<Record<keyof V, TextInput | null>>>({});
  const errorOf = (k: keyof V) => rules[k]?.(values[k], values) ?? null;
  const visibleError = (k: keyof V) => (touched[k] || submitted ? errorOf(k) : null);
  const bind = (k: keyof V) => ({
    ref: (r: TextInput | null) => { refs.current[k] = r; },
    value: values[k],
    onChangeText: (t: string) => setValues((v) => ({ ...v, [k]: t })),
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
    error: visibleError(k),
  });
  const validate = () => {
    setSubmitted(true);
    const firstBad = (Object.keys(values) as (keyof V)[]).find((k) => errorOf(k));
    if (firstBad) { refs.current[firstBad]?.focus(); haptic.error(); return false; }
    return true;
  };
  return { values, bind, validate, setValues };
}
```

## 8. Lists: refresh, pagination, search, row actions

- **Pull-to-refresh:** `RefreshControl` with `tintColor={p.ink}` (iOS) and `colors={[p.primary]}` / `progressBackgroundColor={p.surface}` (Android). Refresh keeps the data on screen.
- **Infinite scroll:** `onEndReachedThreshold={0.4}` + an in-flight guard (a ref) + a `hasMore` flag. The footer has 3 states: loading (1–2 `SkeletonRow`s), error ("Couldn't load more · Retry" inline), end ("That's everything" in caption, only for lists > 20 items). Under assistive tech, also offer a "Load more" button.
- **Search:** debounce 300ms, cancel the previous request (AbortController) and ignore stale responses (compare a request id). Show a small spinner *inside* the search field, not over the list. No results → "No results for 'xyz'" + a suggestion (clear filters, check spelling).
- **Row-level busy:** acting on one row (approve a join request) shows a spinner **in that row's button only**. The rest of the list stays usable.
- **Optimistic updates** for reversible, low-risk changes (toggle done, mark read, reorder, remove with undo): update instantly, then roll back with a toast on failure. **Not** for submitting tests, grading, payments or anything with server-side consequences. Those use `AsyncButton`.
- **Preserve position:** coming back from a detail screen keeps the scroll offset and filters.

## 9. Feedback surfaces: which one?

| Message | Surface |
|---|---|
| Field-level problem | inline under the field (`dangerInk`) |
| A screen-level problem the user must fix | an inline Alert at the top of the content |
| Completed in the background / undo window / a non-blocking failure | **Toast** (snackbar) above the tab bar, 4s (6s with an action), one at a time, with Undo/Retry |
| Irreversible confirmation | the app's confirmation dialog |
| Connectivity | an offline banner under the header while offline |

```tsx
type ToastMsg = { id: number; message: string; kind?: 'info' | 'success' | 'error'; action?: { label: string; onPress: () => void } };
const ToastCtx = createContext<{ show: (t: Omit<ToastMsg, 'id'>) => void }>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

/** One toast at a time; the next replaces the current. Mount once near the root, above the tab bar. */
export function ToastProvider({ children, bottomOffset = 0 }: PropsWithChildren<{ bottomOffset?: number }>) {
  const [t, setT] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const show = useCallback((m: Omit<ToastMsg, 'id'>) => {
    if (timer.current) clearTimeout(timer.current);
    const next = { ...m, id: Date.now() };
    setT(next);
    AccessibilityInfo.announceForAccessibility?.(m.message);
    timer.current = setTimeout(() => setT((cur) => (cur?.id === next.id ? null : cur)), m.action ? 6000 : 4000);
  }, []);
  const bg = t?.kind === 'error' ? p.dangerSoft : t?.kind === 'success' ? p.successSoft : p.surface;
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {t && (
        <Animated.View key={t.id} entering={SlideInDown.springify().damping(20)} exiting={FadeOut.duration(120)}
          accessibilityLiveRegion="polite" pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + bottomOffset + 12 }}>
          <Card style={{ backgroundColor: bg }} elevation="lg">   {/* classic: the app's raised card · neo: Card shadow.lg */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AppText variant="bodySm" style={{ flex: 1 }}>{t.message}</AppText>
              {t.action && <Button size="sm" variant="outline" label={t.action.label} onPress={() => { t.action!.onPress(); setT(null); }} />}
            </View>
          </Card>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
// bottomOffset = tab bar height on tab screens, or the pinned button height so a toast never covers the primary action.
```

## 10. Network: offline, retry, timeouts

```tsx
// npx expo install @react-native-community/netinfo
import NetInfo from '@react-native-community/netinfo';

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)), []);
  return online;
}

/** Retry with backoff for idempotent reads (never for non-idempotent writes without an idempotency key). */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3, base = 600): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= tries - 1) throw e; await new Promise((r) => setTimeout(r, base * 2 ** i + Math.random() * 200)); }
  }
}
```

- Offline banner: a `warning`-filled strip under the header, "You're offline · showing saved data", 2px ink bottom rule, announced once. When the connection returns: refetch visible screens and show a brief "Back online" toast.
- Every request has a timeout (≈ 15s for actions, 10s for reads) and an abort on unmount.
- **Tests and answers** save locally first and sync after. Never lose an answer because the network dropped.

## 11. Race conditions & double actions (checklist)

- [ ] Every submit goes through `useAsyncAction` (ref guard). A double tap never creates two records.
- [ ] Navigation buttons ignore a second tap for ~500ms (or check `router.canGoBack`/the current route) to prevent pushing a screen twice.
- [ ] Responses for an old query (search, filters, a fast tab switch) are ignored if a newer request started.
- [ ] Requests are aborted on unmount, and no `setState` runs after unmount.
- [ ] Optimistic changes roll back on failure, with a toast.
- [ ] Screen-level **error boundary**: render errors show an error state with "Reload screen", not a white screen.

## 12. Interaction affordances (everything should respond)

- Every tappable thing has visible pressed feedback: `PressScale` (classic) or the press-shift (neo) for buttons and cards, a `subtle` background for rows and links.
- Long-press: icon buttons show their label (tooltip); rows open a context menu with the same actions as the detail screen.
- Swipe actions on rows (archive, remove with undo), mirrored by a visible ⋯ menu for discoverability.
- Pull-to-refresh on every list that can change on the server.
- Haptics only per motion.md's table. Focus rings on web/keyboard. Hover tints on web.
- Disabled controls always carry their reason: `Button disabledReason="Pick at least 1 question"` renders it as helper text under the button and as the accessibility hint, so a tap that does nothing is never a mystery.
