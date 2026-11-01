// Live test monitoring rules for the teacher, kept free of React so they can be
// tested on their own: the student list filters, the words shown for each state
// and the poller that refreshes the monitor without overlapping requests.
// The server decides every state and count (papers/src/lib/test-monitor.ts);
// nothing here works out a student's status, only how it is shown.
import type { AppStateStatus } from 'react-native';
import type { TestMonitorRow, TestMonitorState } from '../../services/school-api';

/** How often a Live test's monitor is refreshed. */
export const REFRESH_MS = 15_000;

export type MonitorFilter = 'all' | 'not-started' | 'in-progress' | 'submitted' | 'violations';
export const MONITOR_FILTERS: readonly MonitorFilter[] = ['all', 'not-started', 'in-progress', 'submitted', 'violations'];
export const MONITOR_FILTER_LABELS: Record<MonitorFilter, string> = {
  all: 'All',
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  submitted: 'Submitted',
  violations: 'Violations',
};

export const STATE_WORDS: Record<TestMonitorState, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  'not-started': { label: 'NOT STARTED', tone: 'neutral' },
  'in-progress': { label: 'IN PROGRESS', tone: 'primary' },
  submitted: { label: 'SUBMITTED', tone: 'success' },
  'auto-submitted': { label: 'AUTO-SUBMITTED', tone: 'warning' },
  violation: { label: 'VIOLATION', tone: 'danger' },
};

const FINALIZED: readonly TestMonitorState[] = ['submitted', 'auto-submitted', 'violation'];

/** Whether a row belongs under a filter. "Submitted" is every finalized attempt, as the Submitted card counts; "Violations" is the subset ended by a violation. */
export function matchesFilter(row: Pick<TestMonitorRow, 'state'>, filter: MonitorFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'violations') return row.state === 'violation';
  if (filter === 'submitted') return FINALIZED.includes(row.state);
  return row.state === filter;
}

export const filterRows = <T extends Pick<TestMonitorRow, 'state'>>(rows: T[], filter: MonitorFilter) => rows.filter((r) => matchesFilter(r, filter));

/** The percentage of questions answered, 0 when the test has none. */
export const percentDone = (answered: number, total: number) => (total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0);

/** "18 min remaining", "1 h 5 min remaining". Counted up to the next minute, as a countdown is. */
export function remainingLabel(seconds: number): string {
  if (seconds <= 0) return 'Time is up';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min remaining`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${h} h${rest ? ` ${rest} min` : ''} remaining`;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** The two lines under a student's name. Only what the server recorded: answers saved, start and submission times, the server's deadline. */
export function rowLines(row: TestMonitorRow): [string, string | null] {
  if (row.state === 'not-started') return ['Has not started', null];
  const answered = `${row.answered}/${row.total} answered`;
  if (row.state === 'in-progress') {
    const left = row.remainingSeconds !== null ? remainingLabel(row.remainingSeconds) : null;
    return [`${answered} · ${percentDone(row.answered, row.total)}% completed`, [left, row.startedAt ? `Started ${clock(row.startedAt)}` : null].filter(Boolean).join(' · ') || null];
  }
  const ended = row.state === 'violation' ? 'Ended by violation' : row.state === 'auto-submitted' ? 'Auto-submitted' : 'Submitted';
  return [
    `${answered} · ${row.submittedAt ? `${ended} ${clock(row.submittedAt)}` : ended}`,
    row.startedAt ? `Started ${clock(row.startedAt)}` : null,
  ];
}

/** Spoken summary of a row, for screen readers. */
export function rowLabel(row: TestMonitorRow): string {
  const [first, second] = rowLines(row);
  return [row.student.name, STATE_WORDS[row.state].label.toLowerCase().replace('-', ' '), first, second].filter(Boolean).join('. ');
}

/** "3:42:10 PM"-style time of the last good refresh. */
export const refreshedLabel = (at: Date) => at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

/** How the monitor should be fed for a test in this state: polled while Live, read once when completed, not at all before it opens. */
export type MonitorMode = 'poll' | 'once' | 'off';
export const monitorModeOf = (status: 'scheduled' | 'open' | 'closed' | undefined): MonitorMode => (status === 'open' ? 'poll' : status === 'closed' ? 'once' : 'off');

// ─── Polling ───────────────────────────────────────────────────────────────

export interface Poller {
  /** Begins polling: a refresh now, then one every interval. Does nothing when already running. */
  start(): void;
  /** Stops polling. A request already on its way finishes but its result schedules nothing. */
  stop(): void;
  /** Refreshes now (pull-to-refresh). Joins the request in flight instead of sending a second one. */
  refresh(): Promise<void>;
  readonly running: boolean;
}

interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

/**
 * Runs `tick` on a schedule, one request at a time. The next tick is timed from
 * the end of the last one, so a slow network can't pile requests up. `tick`
 * returns false to say polling is over (the test is no longer Live).
 */
export function createPoller(tick: () => Promise<boolean>, intervalMs = REFRESH_MS, timers: Timers = globalThis as unknown as Timers): Poller {
  let running = false;
  let inFlight: Promise<void> | null = null;
  let timer: unknown = null;

  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clear();
    if (running) timer = timers.setTimeout(() => void run(), intervalMs);
  };

  const run = (): Promise<void> => {
    if (inFlight) return inFlight;
    clear();
    inFlight = (async () => {
      let again = false;
      try {
        again = await tick();
      } catch {
        again = true; // the tick reports its own errors; keep polling
      }
      inFlight = null;
      if (!again) running = false;
      schedule(); // does nothing if polling was stopped meanwhile
    })();
    return inFlight;
  };

  return {
    start() {
      if (running) return;
      running = true;
      void run();
    },
    stop() {
      running = false;
      clear();
    },
    refresh: run,
    get running() {
      return running;
    },
  };
}

/** The slice of React Native's AppState the poller follows. */
export interface AppStateLike {
  currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void };
}

/** Polls only while the app is in the foreground: starts now if it is, stops on background, restarts on return. Returns the cleanup that stops it all. */
export function followAppState(poller: Poller, appState: AppStateLike): () => void {
  const sub = appState.addEventListener('change', (state) => (state === 'active' ? poller.start() : poller.stop()));
  if (appState.currentState === 'active') poller.start();
  return () => {
    poller.stop();
    sub.remove();
  };
}
