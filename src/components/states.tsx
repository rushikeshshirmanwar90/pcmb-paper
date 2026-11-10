import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeOut, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorView, Icon, Notice, usePalette, type IconName } from '@/components/kit';
import { ApiError } from '@/services/api-client';

// The interaction layer the kit's screens share in every role (app-interactions):
// single-flight actions with honest busy states, skeletons for first loads, a
// load-state switch, and one toast at a time. Logic never depends on the look.

// ─── Actions ───────────────────────────────────────────────────────────────

type Status = 'idle' | 'pending' | 'success' | 'error';

/** A sentence people can act on, from whatever went wrong. */
export function humanError(e: unknown, timedOut = false): string {
  if (timedOut) return 'This is taking too long. Check your connection and try again.';
  if (e instanceof ApiError) {
    if (e.status === 0) return e.message || "You're offline. Try again when connected.";
    return e.message || 'Something went wrong. Try again.';
  }
  const m = e instanceof Error ? e.message : String(e ?? '');
  return m && m.length < 140 ? m : 'Something went wrong. Try again.';
}

/** True when a failure came from having no connection (the API client's status 0). */
export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0;

/**
 * Runs a user action once at a time: a second tap while it runs does nothing,
 * "busy" shows only after 150 ms (so fast actions never flash a spinner) and then
 * stays at least 400 ms, nothing updates after the screen closes, and the error
 * comes back as a sentence.
 */
export function useAsyncAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  { onSuccess, onError, successMs = 800 }: { onSuccess?: (r: R) => void; onError?: (message: string) => void; successMs?: number } = {}
) {
  const [status, setStatus] = useState<Status>('idle');
  const [showBusy, setShowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  const cbRef = useRef({ onSuccess, onError });
  useEffect(() => {
    fnRef.current = fn;
    cbRef.current = { onSuccess, onError };
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (inFlight.current) return undefined; // ignore double taps
      inFlight.current = true;
      setError(null);
      setStatus('pending');
      let shownAt = 0;
      const busyTimer = setTimeout(() => {
        if (!mounted.current) return;
        shownAt = Date.now();
        setShowBusy(true);
      }, 150);
      const settle = async () => {
        clearTimeout(busyTimer);
        if (shownAt) await new Promise((r) => setTimeout(r, Math.max(0, 400 - (Date.now() - shownAt))));
      };
      try {
        const r = await fnRef.current(...args);
        await settle();
        if (!mounted.current) return r;
        setShowBusy(false);
        setStatus('success');
        cbRef.current.onSuccess?.(r);
        setTimeout(() => mounted.current && setStatus((s) => (s === 'success' ? 'idle' : s)), successMs);
        return r;
      } catch (e) {
        await settle();
        if (!mounted.current) return undefined;
        const message = humanError(e);
        setShowBusy(false);
        setStatus('error');
        setError(message);
        AccessibilityInfo.announceForAccessibility?.(message);
        cbRef.current.onError?.(message);
        return undefined;
      } finally {
        inFlight.current = false;
      }
    },
    [successMs]
  );

  return { run, status, busy: status === 'pending', showBusy, error, reset: () => (setStatus('idle'), setError(null)) };
}

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A button that runs an async action safely (useAsyncAction): busy while it
 * runs, its error under it, and, when it can't be used, the reason under it too.
 */
export function AsyncButton({
  onPress,
  successLabel,
  disabledReason,
  label,
  ...rest
}: Omit<ButtonProps, 'onPress' | 'loading'> & { onPress: () => Promise<unknown>; successLabel?: string; disabledReason?: string | null }) {
  const action = useAsyncAction(onPress);
  return (
    <View style={styles.asyncButton}>
      <Button
        {...rest}
        label={action.status === 'success' && successLabel ? successLabel : label}
        loading={action.showBusy}
        disabled={!!rest.disabled || !!disabledReason}
        onPress={() => void action.run()}
      />
      <Reason text={disabledReason ?? null} />
      {action.error ? <ErrorLine text={action.error} /> : null}
    </View>
  );
}

/** Why a control can't be used right now, shown under it (never a silent disabled button). */
export function Reason({ text }: { text: string | null }) {
  const palette = usePalette();
  if (!text) return null;
  return <Text style={[styles.reason, { color: palette.mutedForeground }]}>{text}</Text>;
}

function ErrorLine({ text }: { text: string }) {
  const palette = usePalette();
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.reason, { color: palette.dangerInk }]}>
      {text}
    </Text>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────

/** A flat placeholder block. No border: borders mean "real and tappable". Static, so it's calm with Reduce Motion too. */
export function Bone({ w = '100%', h = 14, r = 6, style }: { w?: DimensionValue; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: palette.secondary }, style]} />;
}

/** A real card with placeholder rows, so nothing jumps when the data lands. */
export function SkeletonCard({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <Card>
      <View accessible accessibilityLabel={`Loading ${label}`} accessibilityState={{ busy: true }} style={styles.skeletonRows}>
        {Array.from({ length: Math.min(rows, 6) }, (_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={styles.flex}>
              <Bone w={i % 2 ? '45%' : '60%'} h={14} />
              <Bone w="35%" h={11} style={styles.boneGap} />
            </View>
            <Bone w={40} h={20} r={10} />
          </View>
        ))}
      </View>
    </Card>
  );
}

// ─── Load states ───────────────────────────────────────────────────────────

/**
 * The five data states for anything loaded with the kit's useLoad: skeleton on the
 * first load ("Still loading…" after 3 s), the data kept on refresh, a calm note
 * with Retry when a refresh fails, an error with Retry when there's no data, and
 * the empty state when the data is empty.
 */
export function AsyncView<T>({
  state,
  skeleton,
  empty,
  isEmpty = (d: T) => Array.isArray(d) && d.length === 0,
  children,
}: {
  state: { data: T | null; loading: boolean; error: string | null; reload: () => void };
  skeleton: ReactNode;
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  const palette = usePalette();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!state.loading) return;
    const t = setTimeout(() => setSlow(true), 3000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [state.loading]);

  if (state.loading && state.data == null) {
    return (
      <View style={styles.stack}>
        {skeleton}
        {slow ? <Text style={[styles.reason, styles.center, { color: palette.mutedForeground }]}>Still loading…</Text> : null}
      </View>
    );
  }
  if (state.data == null) return <ErrorView message={state.error ?? 'Something went wrong.'} onRetry={state.reload} />;
  return (
    <>
      {state.error ? <StaleNotice message={state.error} onRetry={state.reload} /> : null}
      {empty && isEmpty(state.data) ? empty : children(state.data)}
    </>
  );
}

/** A refresh failed: the screen keeps what it had and says so. */
export function StaleNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const palette = usePalette();
  const offline = /offline|reach the server|internet/i.test(message);
  return (
    <View style={[styles.stale, { backgroundColor: palette.secondary }]}>
      <Icon name={offline ? { ios: 'wifi.slash', android: 'wifi_off' } : { ios: 'exclamationmark.circle', android: 'error_outline' }} color={palette.inkSoft} size={16} />
      <Text style={[styles.staleText, { color: palette.foreground }]}>{offline ? "You're offline · showing what was saved" : "Couldn't update · showing what was saved"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} hitSlop={8} style={styles.retry}>
        <Text style={[styles.retryText, { color: palette.primary }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ─── Toasts ────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string; kind?: 'info' | 'success' | 'error'; action?: { label: string; onPress: () => void } };
const ToastContext = createContext<{ show: (t: Omit<Toast, 'id'>) => void }>({ show: () => {} });

/** Shows a short message above the tab bar (4 s, 6 s with an action). One at a time. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children, bottomOffset = 0 }: PropsWithChildren<{ bottomOffset?: number }>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = useCallback((t: Omit<Toast, 'id'>) => {
    if (timer.current) clearTimeout(timer.current);
    const next = { ...t, id: Date.now() };
    setToast(next);
    AccessibilityInfo.announceForAccessibility?.(t.message);
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === next.id ? null : cur)), t.action ? 6000 : 4000);
  }, []);
  const tone = toast?.kind === 'error' ? 'danger' : toast?.kind === 'success' ? 'success' : null;
  const icon: IconName | undefined = toast?.kind === 'success' ? { ios: 'checkmark.circle', android: 'check_circle' } : undefined;
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={SlideInDown.duration(220)}
          exiting={FadeOut.duration(120)}
          pointerEvents="box-none"
          style={[styles.toast, { bottom: insets.bottom + bottomOffset + 12 }]}
        >
          {tone ? (
            <Notice tone={tone} icon={icon} title={toast.message} live />
          ) : (
            <View accessibilityLiveRegion="polite" style={[styles.toastCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.toastText, { color: palette.foreground }]}>{toast.message}</Text>
              {toast.action ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    toast.action!.onPress();
                    setToast(null);
                  }}
                  hitSlop={8}
                  style={styles.retry}
                >
                  <Text style={[styles.retryText, { color: palette.primary }]}>{toast.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 12 },
  center: { textAlign: 'center' },
  asyncButton: { gap: 6 },
  reason: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  skeletonRows: { gap: 4 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  boneGap: { marginTop: 8 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, minHeight: 44 },
  staleText: { flex: 1, fontSize: 13, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '700' },
  toast: { position: 'absolute', left: 16, right: 16, maxWidth: 560, alignSelf: 'center' },
  toastCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, minHeight: 48 },
  toastText: { flex: 1, fontSize: 14, lineHeight: 19 },
});
