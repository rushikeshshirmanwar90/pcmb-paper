// Saves a test's changed answers in the background, and says truthfully where
// that stands. No React here, so it can be tested on its own
// (tests/student-tests.test.mjs).
//
// - A change is sent `delayMs` after the last change (one request for a burst).
// - One request at a time; answers changed meanwhile go in the next one.
// - Each request reads the answer's latest value, so a retry never sends an
//   old one.
// - A failed save keeps its answers and tries again after 2, 5, 10, then
//   every 20 seconds, until it works or the test is submitted.

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';
export type AnswerUpdate = { index: number; selected: string | null };

type Timer = ReturnType<typeof setTimeout>;

export interface AnswerSaverOptions {
  /** Sends changed answers to the server; rejects when that fails. */
  save: (answers: AnswerUpdate[]) => Promise<unknown>;
  /** The answer to a question as it is now. */
  read: (index: number) => string | null;
  /** Called whenever the state changes. */
  onState: (state: SaveState) => void;
  delayMs?: number;
  retryMs?: number[];
  /** For tests: stand-ins for setTimeout / clearTimeout. */
  setTimer?: (run: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
}

export interface AnswerSaver {
  /** An answer changed: save it shortly. */
  change(index: number): void;
  /** Try a waiting save now (e.g. "Retry" tapped). */
  retryNow(): void;
  /** Send what's waiting now, if nothing is on the way already. */
  flush(): Promise<void>;
  /** Submitting: hold saves (the submission carries every answer). */
  pause(): void;
  /** The submission failed: carry on saving. */
  resume(): void;
  /** Answers not sent yet (and not on the way). */
  unsent(): AnswerUpdate[];
  /** Answers the server hasn't confirmed: not sent yet, or on the way. */
  unconfirmed(): AnswerUpdate[];
  /**
   * Leaving: send what's waiting now and wait for the outcome. True only when
   * the server has confirmed every answer; false means some are still unsaved.
   */
  settle(): Promise<boolean>;
  /** Stop all timers, e.g. when the screen closes. */
  dispose(): void;
  readonly state: SaveState;
}

export function createAnswerSaver({
  save,
  read,
  onState,
  delayMs = 800,
  retryMs = [2000, 5000, 10000, 20000],
  setTimer = (run, ms) => setTimeout(run, ms),
  clearTimer = (t) => clearTimeout(t),
}: AnswerSaverOptions): AnswerSaver {
  const waiting = new Set<number>();
  let state: SaveState = 'saved';
  let timer: Timer | null = null;
  let inFlight = false;
  let sending: number[] = [];
  let flight: Promise<void> | null = null;
  let paused = false;
  let failures = 0;

  const setState = (next: SaveState) => {
    if (next === state) return;
    state = next;
    onState(next);
  };

  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const schedule = (ms: number) => {
    cancel();
    timer = setTimer(() => {
      timer = null;
      void flush();
    }, ms);
  };

  const updates = (indexes: Iterable<number>) => [...indexes].map((index) => ({ index, selected: read(index) }));

  function flush(): Promise<void> {
    if (paused || inFlight || !waiting.size) return flight ?? Promise.resolve();
    flight = send().finally(() => {
      flight = null;
    });
    return flight;
  }

  async function send() {
    const sent = [...waiting];
    waiting.clear();
    sending = sent;
    inFlight = true;
    setState('saving');
    try {
      await save(updates(sent));
      sending = [];
      inFlight = false;
      failures = 0;
      if (paused) return;
      // Answers changed while that was on the way: they go next.
      if (waiting.size) schedule(delayMs);
      else setState('saved');
    } catch {
      sending = [];
      inFlight = false;
      sent.forEach((index) => waiting.add(index));
      if (paused) return;
      setState('error');
      schedule(retryMs[Math.min(failures, retryMs.length - 1)]);
      failures += 1;
    }
  }

  return {
    change(index) {
      waiting.add(index);
      // A failure stays visible until a save actually works.
      if (state !== 'error') setState('pending');
      if (!paused) schedule(delayMs);
    },
    retryNow() {
      if (!paused && waiting.size) schedule(0);
    },
    flush,
    pause() {
      paused = true;
      cancel();
    },
    resume() {
      paused = false;
      if (waiting.size) schedule(delayMs);
    },
    unsent: () => updates(waiting),
    unconfirmed: () => updates(new Set([...sending, ...waiting])),
    async settle() {
      cancel();
      if (flight) await flight;
      if (waiting.size && !paused) await flush();
      return !waiting.size && !inFlight;
    },
    dispose: cancel,
    get state() {
      return state;
    },
  };
}
