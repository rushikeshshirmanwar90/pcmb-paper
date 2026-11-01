// Phase 2C: live test monitoring rules on the teacher's side — filters, row text and the poller.
//   node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MONITOR_FILTERS,
  REFRESH_MS,
  STATE_WORDS,
  createPoller,
  filterRows,
  followAppState,
  matchesFilter,
  monitorModeOf,
  percentDone,
  remainingLabel,
  rowLabel,
  rowLines,
} from '../src/screens/teacher/test-monitor.ts';

const row = (state, over = {}) => ({
  student: { id: state, name: state },
  state,
  answered: 0,
  total: 30,
  startedAt: null,
  submittedAt: null,
  remainingSeconds: null,
  ...over,
});
const rows = ['not-started', 'in-progress', 'submitted', 'auto-submitted', 'violation'].map((s) => row(s));

describe('filters', () => {
  test('All shows everyone; Not Started and In Progress show only their own', () => {
    assert.equal(filterRows(rows, 'all').length, 5);
    assert.deepEqual(filterRows(rows, 'not-started').map((r) => r.state), ['not-started']);
    assert.deepEqual(filterRows(rows, 'in-progress').map((r) => r.state), ['in-progress']);
  });
  test('Submitted includes auto-submitted and violation attempts, as the Submitted card does', () => {
    assert.deepEqual(filterRows(rows, 'submitted').map((r) => r.state), ['submitted', 'auto-submitted', 'violation']);
  });
  test('Violations shows only violations', () => {
    assert.deepEqual(filterRows(rows, 'violations').map((r) => r.state), ['violation']);
  });
  test('every row is in All and in exactly one of Not Started, In Progress, Submitted', () => {
    for (const r of rows) {
      assert.ok(matchesFilter(r, 'all'));
      assert.equal(['not-started', 'in-progress', 'submitted'].filter((f) => matchesFilter(r, f)).length, 1, r.state);
    }
    assert.deepEqual(MONITOR_FILTERS, ['all', 'not-started', 'in-progress', 'submitted', 'violations']);
  });
});

describe('what a row says', () => {
  test('state words', () => {
    assert.deepEqual(Object.values(STATE_WORDS).map((w) => w.label), ['NOT STARTED', 'IN PROGRESS', 'SUBMITTED', 'AUTO-SUBMITTED', 'VIOLATION']);
  });
  test('an active attempt shows saved answers, percent and time left', () => {
    const [first, second] = rowLines(row('in-progress', { answered: 15, startedAt: new Date().toISOString(), remainingSeconds: 18 * 60 }));
    assert.equal(first, '15/30 answered · 50% completed');
    assert.match(second, /^18 min remaining · Started /);
  });
  test('a student who has not started has no times or progress', () => {
    assert.deepEqual(rowLines(row('not-started')), ['Has not started', null]);
  });
  test('finished attempts say how they ended and when', () => {
    const at = new Date().toISOString();
    assert.match(rowLines(row('submitted', { answered: 30, startedAt: at, submittedAt: at }))[0], /^30\/30 answered · Submitted /);
    assert.match(rowLines(row('auto-submitted', { answered: 12, startedAt: at, submittedAt: at }))[0], /^12\/30 answered · Auto-submitted /);
    assert.match(rowLines(row('violation', { answered: 3, startedAt: at, submittedAt: at }))[0], /^3\/30 answered · Ended by violation /);
  });
  test('nothing claims the student is online or on a question', () => {
    for (const r of rows) assert.doesNotMatch(rowLabel(r).toLowerCase(), /online|offline|using the app|question \d|currently/);
  });
  test('percent is rounded, capped and safe for an empty test', () => {
    assert.equal(percentDone(1, 3), 33);
    assert.equal(percentDone(31, 30), 100);
    assert.equal(percentDone(0, 0), 0);
  });
  test('time left counts up to the next minute', () => {
    assert.equal(remainingLabel(18 * 60), '18 min remaining');
    assert.equal(remainingLabel(18 * 60 + 1), '19 min remaining');
    assert.equal(remainingLabel(59), '1 min remaining');
    assert.equal(remainingLabel(65 * 60), '1 h 5 min remaining');
    assert.equal(remainingLabel(2 * 3600), '2 h remaining');
    assert.equal(remainingLabel(0), 'Time is up');
  });
});

describe('lifecycle', () => {
  test('only a Live test is polled; a completed one is read once; an upcoming one not at all', () => {
    assert.equal(monitorModeOf('open'), 'poll');
    assert.equal(monitorModeOf('closed'), 'once');
    assert.equal(monitorModeOf('scheduled'), 'off');
    assert.equal(monitorModeOf(undefined), 'off');
  });
  test('refresh interval is 15 to 20 seconds', () => {
    assert.ok(REFRESH_MS >= 15_000 && REFRESH_MS <= 20_000);
  });
});

/** Timers the test steps by hand. */
function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    pending,
    setTimeout: (fn, ms) => (pending.set(next, { fn, ms }), next++),
    clearTimeout: (h) => void pending.delete(h),
    fire() {
      const [[id, t]] = [...pending];
      pending.delete(id);
      t.fn();
    },
  };
}

/** A request that stays open until released. */
function gate() {
  let release;
  const promise = new Promise((r) => (release = r));
  return { promise, release };
}
const flush = () => new Promise((r) => setImmediate(r));

describe('poller', () => {
  test('starts with a request, then one every interval, timed from the end of the last', async () => {
    const timers = fakeTimers();
    let calls = 0;
    const p = createPoller(async () => (calls++, true), REFRESH_MS, timers);
    p.start();
    await flush();
    assert.equal(calls, 1);
    assert.equal(timers.pending.size, 1);
    assert.equal([...timers.pending.values()][0].ms, REFRESH_MS);
    timers.fire();
    await flush();
    assert.equal(calls, 2);
    assert.equal(timers.pending.size, 1);
  });

  test('never overlaps: a refresh while a request is on its way joins it', async () => {
    const timers = fakeTimers();
    const g = gate();
    let calls = 0;
    const p = createPoller(async () => (calls++, await g.promise, true), REFRESH_MS, timers);
    p.start();
    const a = p.refresh();
    const b = p.refresh();
    p.start(); // already running: nothing new
    assert.equal(calls, 1);
    assert.equal(a, b);
    assert.equal(timers.pending.size, 0); // nothing scheduled while a request is open
    g.release();
    await a;
    assert.equal(calls, 1);
    assert.equal(timers.pending.size, 1);
  });

  test('a manual refresh replaces the waiting timer instead of adding one', async () => {
    const timers = fakeTimers();
    let calls = 0;
    const p = createPoller(async () => (calls++, true), REFRESH_MS, timers);
    p.start();
    await flush();
    await p.refresh();
    assert.equal(calls, 2);
    assert.equal(timers.pending.size, 1);
  });

  test('stop clears the timer, and a request already on its way schedules nothing', async () => {
    const timers = fakeTimers();
    const g = gate();
    let calls = 0;
    const p = createPoller(async () => (calls++, await g.promise, true), REFRESH_MS, timers);
    p.start();
    p.stop();
    g.release();
    await flush();
    assert.equal(timers.pending.size, 0);
    assert.equal(p.running, false);
    assert.equal(calls, 1);
  });

  test('stopping while idle removes the pending timer; starting again resumes', async () => {
    const timers = fakeTimers();
    let calls = 0;
    const p = createPoller(async () => (calls++, true), REFRESH_MS, timers);
    p.start();
    await flush();
    p.stop();
    assert.equal(timers.pending.size, 0);
    p.start();
    await flush();
    assert.equal(calls, 2);
    assert.equal(timers.pending.size, 1);
  });

  test('polling ends when the request says the test is no longer Live', async () => {
    const timers = fakeTimers();
    let calls = 0;
    const p = createPoller(async () => (calls++, calls < 2), REFRESH_MS, timers);
    p.start();
    await flush();
    timers.fire();
    await flush();
    assert.equal(calls, 2);
    assert.equal(p.running, false);
    assert.equal(timers.pending.size, 0);
  });

  test('a failing request does not stop polling', async () => {
    const timers = fakeTimers();
    let calls = 0;
    const p = createPoller(async () => {
      calls++;
      throw new Error('offline');
    }, REFRESH_MS, timers);
    p.start();
    await flush();
    assert.equal(p.running, true);
    assert.equal(timers.pending.size, 1);
    timers.fire();
    await flush();
    assert.equal(calls, 2);
  });
});

describe('following the app state', () => {
  const fakeApp = (currentState) => {
    const app = { currentState, listener: null, removed: false, addEventListener: (_t, l) => ((app.listener = l), { remove: () => (app.removed = true) }) };
    return app;
  };

  test('polls while in the foreground, stops in the background, resumes on return', async () => {
    const timers = fakeTimers();
    let calls = 0;
    const poller = createPoller(async () => (calls++, true), REFRESH_MS, timers);
    const app = fakeApp('active');
    followAppState(poller, app);
    await flush();
    assert.equal(calls, 1);
    app.listener('background');
    assert.equal(poller.running, false);
    assert.equal(timers.pending.size, 0);
    app.listener('active');
    await flush();
    assert.equal(calls, 2);
    assert.equal(poller.running, true);
  });

  test('does not start when the app is already in the background', async () => {
    let calls = 0;
    const poller = createPoller(async () => (calls++, true), REFRESH_MS, fakeTimers());
    followAppState(poller, fakeApp('background'));
    await flush();
    assert.equal(calls, 0);
  });

  test('leaving the screen stops polling and removes the listener', async () => {
    const timers = fakeTimers();
    const poller = createPoller(async () => true, REFRESH_MS, timers);
    const app = fakeApp('active');
    const leave = followAppState(poller, app);
    await flush();
    leave();
    assert.equal(poller.running, false);
    assert.equal(timers.pending.size, 0);
    assert.equal(app.removed, true);
  });
});
