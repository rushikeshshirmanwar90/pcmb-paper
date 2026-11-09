import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trackAppBackground } from '../src/screens/student/exam-app-state.ts';
import { createExamVisibility, reopenVisibility } from '../src/screens/student/exam-visibility.ts';

function harness(initial = 'active') {
  let currentState = initial;
  const listeners = new Map();
  const calls = [];
  const appState = {
    get currentState() { return currentState; },
    addEventListener(event, listener) { listeners.set(event, listener); return { remove: () => listeners.delete(event) }; },
  };
  const subscription = trackAppBackground(appState, {
    lose: (...args) => calls.push(['lose', ...args]), gain: (...args) => calls.push(['gain', ...args]),
    verify: async () => { calls.push(['verify']); },
  });
  return { calls, subscription, listeners,
    emit(event, state) { if (event === 'change') currentState = state; listeners.get(event)?.(state); },
    setState(state) { currentState = state; },
  };
}

test('a foreground student can remain idle and receive window blur without a background violation', () => {
  const h = harness();
  for (let i = 0; i < 100; i++) { h.subscription.sync(); h.emit('blur'); }
  h.emit('change', 'inactive'); h.emit('change', 'active');
  assert.deepEqual(h.calls, []);
  assert.deepEqual([...h.listeners.keys()], ['change']);
  h.subscription.dispose();
  assert.equal(h.listeners.size, 0);
  assert.deepEqual(h.calls, [], 'unmounting is not background evidence');
});

test('only a real background transition opens an interruption, and foreground closes it once', () => {
  const h = harness();
  h.emit('change', 'background'); h.subscription.sync(); h.emit('blur');
  h.emit('change', 'inactive'); h.emit('change', 'active'); h.subscription.sync();
  assert.deepEqual(h.calls, [['lose', 'app', 'app-background'], ['gain', 'app'], ['verify']]);
});

test('unknown startup state is not a violation; background startup and missed callbacks are checked', () => {
  assert.deepEqual(harness(null).calls, []);
  assert.deepEqual(harness('background').calls, [['lose', 'app', 'app-background']]);
  const h = harness(); h.setState('background'); h.subscription.sync();
  h.setState('active'); h.subscription.sync();
  assert.deepEqual(h.calls, [['lose', 'app', 'app-background'], ['gain', 'app'], ['verify']]);
});

test('relaunch ignores legacy window/route interruptions and retains actual background evidence', () => {
  const at = Date.parse('2026-11-09T10:00:00Z');
  const interruption = reason => ({ id: reason, reason, startedAt: new Date(at - 20000).toISOString() });
  const recovered = { startedAt: new Date(at - 60000).toISOString(), resumeVersion: 0, clientId: 'old', sequence: 1, clockSkew: 0,
    pending: [interruption('focus-loss'), interruption('app-background')], open: interruption('screen-focus-loss') };
  assert.deepEqual(reopenVisibility(recovered, at).interruptions.map(i => i.reason), ['app-background']);
  const c = createExamVisibility({ startedAt: recovered.startedAt, resumeVersion: 0, recovered, now: () => at, clockSkew: () => 0,
    persist: () => {}, onStatus: () => {}, onBlocked: () => {}, onLoss: () => {}, send: async () => ({ state: 'in-progress' }) });
  assert.deepEqual(c.snapshot().pending.map(i => i.reason), ['app-background']);
  c.dispose();
});

test('teacher resume while still backgrounded retains actual background evidence in the new generation', () => {
  const c = createExamVisibility({ startedAt: '2026-11-09T09:00:00Z', resumeVersion: 0,
    now: () => Date.parse('2026-11-09T10:00:00Z'), clockSkew: () => 0,
    persist: () => {}, onStatus: () => {}, onBlocked: () => {}, onLoss: () => {},
    send: async () => ({ state: 'suspended', resumeVersion: 0 }) });
  c.lose('app', 'app-background');
  c.accept({ state: 'in-progress', resumeVersion: 1 });
  assert.equal(c.snapshot().open.reason, 'app-background');
  assert.equal(c.snapshot().resumeVersion, 1);
  assert.equal(c.visible(), false);
  c.dispose();
});
