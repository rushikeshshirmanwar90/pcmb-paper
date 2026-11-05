// Rules of the secure exam that don't need React, so they can be tested on
// their own (tests/secure-exam.test.mjs): the server's clock, how long the app
// was away, and each question's status in the palette.

/**
 * How long the app may be away before the attempt ends. The server owns this
 * rule (AWAY_LIMIT_MS in papers/src/lib/attempts.ts) and does the ending; the
 * app only uses it to lock the screen while it waits for the server's word.
 * Keep the two equal.
 */
export const AWAY_LIMIT_MS = 10_000;

/** The phone clock's error against the server's, taken when the server last answered. Add it to Date.now(). */
export const skewOf = (serverTime: string | undefined, now = Date.now()) => {
  const server = serverTime ? new Date(serverTime).getTime() : NaN;
  return Number.isFinite(server) ? server - now : 0;
};

/** Whole seconds left until the deadline by the server's clock, never below zero. */
export const secondsLeft = (deadline: string, skewMs: number, now = Date.now()) =>
  Math.max(0, Math.round((new Date(deadline).getTime() - (now + skewMs)) / 1000));

/** A clock that only moves forward (performance.now), so changing the phone's date can't shorten a measurement. */
const monotonicNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/**
 * Measures how long the app was out of the foreground (or, with the same
 * tracker, in split-screen). `background()` when it leaves, `foreground()` when
 * it returns, which gives the time away (or null if it never left); `elapsed()`
 * reads the time so far without ending it. A second `background()` while away
 * does not restart the clock. Only a real background counts: keyboards, the
 * app's own dialogs and scrolling never change the app state.
 *
 * Two clocks are read and the longer span wins: the wall clock keeps counting
 * while the phone sleeps, the monotonic one can't be turned back in Settings.
 * This is still the phone's word; the server owns the limit (see AWAY_LIMIT_MS).
 */
export function createAwayTracker(clock: () => number = Date.now, monotonic: () => number = monotonicNow) {
  let left: { wall: number; mono: number } | null = null;
  const span = () => (left ? Math.max(0, clock() - left.wall, monotonic() - left.mono) : null);
  return {
    background() {
      if (left === null) left = { wall: clock(), mono: monotonic() };
    },
    elapsed: span,
    foreground(): number | null {
      const away = span();
      left = null;
      return away;
    },
  };
}

type Size = { width: number; height: number };

/** What the phone says about split-screen / multi-window. `authoritative` is true only when Android itself answered (the native module). */
export type MultiWindowReading = { inMultiWindow: boolean; authoritative: boolean };

/**
 * Android's own answer (`Activity.isInMultiWindowMode`) when the native module
 * is there; otherwise a guess from the window being much smaller than the
 * screen. The guess can be wrong (it only ever asks the student to go
 * full-screen), so it's marked non-authoritative and is never held against them.
 */
export function readMultiWindow(native: boolean | null, window: Size, screen: Size): MultiWindowReading {
  if (native !== null) return { inMultiWindow: native, authoritative: true };
  const screenArea = screen.width * screen.height;
  const smaller = screenArea > 0 && (window.width * window.height) / screenArea < 0.85;
  return { inMultiWindow: smaller, authoritative: false };
}

/** What Android's Back does for each stage of a test: the exam itself can't be left, everything else closes normally. */
export const backAction = (phase: 'loading' | 'error' | 'intro' | 'running' | 'review'): 'block' | 'close' => (phase === 'running' ? 'block' : 'close');

/** The two Android calls the native module offers. Absent (Expo Go, iOS, web) means none of this is enforced. */
export interface NativeExamSecurity {
  /** Asks Android (12+) to hide other apps' floating overlay windows while ours is showing. True if the request was made. */
  setOverlayProtection(on: boolean): boolean;
  /** Activity.isInMultiWindowMode: split-screen, freeform window or picture-in-picture. */
  isInMultiWindow(): boolean;
}

/**
 * The exam-only restrictions that need native help, switched on when a test
 * starts and off when it ends. Both calls are safe to repeat; a missing or
 * failing native module just means nothing extra is enforced.
 */
export function createExamSecurity(native: NativeExamSecurity | null) {
  let active = false;
  let overlayHidden = false;
  const attempt = <T>(run: (n: NativeExamSecurity) => T): T | null => {
    if (!native) return null;
    try {
      return run(native);
    } catch {
      return null;
    }
  };
  return {
    get active() {
      return active;
    },
    get overlayProtection() {
      return overlayHidden;
    },
    activate() {
      if (active) return;
      active = true;
      overlayHidden = attempt((n) => n.setOverlayProtection(true)) === true;
    },
    release() {
      if (!active) return;
      active = false;
      if (overlayHidden) attempt((n) => n.setOverlayProtection(false));
      overlayHidden = false;
    },
    /** Android's multi-window answer, or null when it can't be asked. */
    multiWindow: (): boolean | null => attempt((n) => n.isInMultiWindow()),
  };
}

export type CellStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';

/** One question's palette status. Marked (not answered) beats not-answered; visited only matters while unanswered and unmarked. */
export function cellStatus(answered: boolean, marked: boolean, visited: boolean): CellStatus {
  if (answered) return marked ? 'answered-marked' : 'answered';
  if (marked) return 'marked';
  return visited ? 'not-answered' : 'not-visited';
}

/** Counts for the submit confirmation. */
export function examCounts(statuses: CellStatus[]) {
  const answered = statuses.filter((s) => s === 'answered' || s === 'answered-marked').length;
  return {
    answered,
    unanswered: statuses.length - answered,
    marked: statuses.filter((s) => s === 'marked' || s === 'answered-marked').length,
    notVisited: statuses.filter((s) => s === 'not-visited').length,
  };
}
