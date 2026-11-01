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

/**
 * Measures how long the app was out of the foreground. `background()` when the
 * app leaves, `foreground()` when it returns, which gives the time away (or
 * null if it never left). Only a real background counts: keyboards, the app's
 * own dialogs and scrolling never change the app state.
 */
export function createAwayTracker(clock: () => number = Date.now) {
  let leftAt: number | null = null;
  return {
    background() {
      if (leftAt === null) leftAt = clock();
    },
    foreground(): number | null {
      if (leftAt === null) return null;
      const away = Math.max(0, clock() - leftAt);
      leftAt = null;
      return away;
    },
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
