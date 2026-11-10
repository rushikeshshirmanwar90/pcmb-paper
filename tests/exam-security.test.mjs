// Phase 5 focused tests: Android exam security. Pure rules only (the native module and
// the React hooks need a device; see the Phase 5 report for what was checked there).
//   node --experimental-strip-types --test tests/exam-security.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { AWAY_LIMIT_MS, backAction, createAwayTracker, createExamSecurity, readMultiWindow } from '../src/screens/student/exam-guard.ts';

const fakeNative = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    setOverlayProtection: (on) => (calls.push(['overlay', on]), true),
    isInMultiWindow: () => false,
    ...overrides,
  };
};

describe('security activation and cleanup', () => {
  test('nothing is restricted until the exam starts, and release undoes exactly what was switched on', () => {
    const native = fakeNative();
    const security = createExamSecurity(native);
    assert.equal(security.active, false);
    assert.deepEqual(native.calls, []);
    security.activate();
    assert.equal(security.active, true);
    assert.equal(security.overlayProtection, true);
    security.release();
    assert.equal(security.active, false);
    assert.equal(security.overlayProtection, false);
    assert.deepEqual(native.calls, [['overlay', true], ['overlay', false]]);
  });

  test('activating or releasing twice does not repeat the native calls', () => {
    const native = fakeNative();
    const security = createExamSecurity(native);
    security.activate();
    security.activate();
    security.release();
    security.release();
    assert.equal(native.calls.length, 2);
  });

  test('releasing without activating, or after a refused request, touches nothing', () => {
    const idle = fakeNative();
    createExamSecurity(idle).release();
    assert.deepEqual(idle.calls, []);

    const refused = fakeNative({ setOverlayProtection: (on) => (refused.calls.push(['overlay', on]), false) });
    const security = createExamSecurity(refused);
    security.activate();
    assert.equal(security.overlayProtection, false, 'older Android or no permission: not claimed');
    security.release();
    assert.deepEqual(refused.calls, [['overlay', true]], 'nothing to undo');
  });

  test('can be activated again for the next exam', () => {
    const native = fakeNative();
    const security = createExamSecurity(native);
    security.activate();
    security.release();
    security.activate();
    assert.equal(security.overlayProtection, true);
  });
});

describe('unsupported-platform fallback', () => {
  test('without the native module (Expo Go, iOS, web) nothing throws and nothing is claimed', () => {
    const security = createExamSecurity(null);
    security.activate();
    assert.equal(security.active, true);
    assert.equal(security.overlayProtection, false);
    assert.equal(security.multiWindow(), null);
    security.release();
    assert.equal(security.active, false);
  });

  test('a native module that throws is treated as unsupported, not as a failed exam', () => {
    const broken = fakeNative({
      setOverlayProtection: () => {
        throw new Error('boom');
      },
      isInMultiWindow: () => {
        throw new Error('boom');
      },
    });
    const security = createExamSecurity(broken);
    assert.doesNotThrow(() => security.activate());
    assert.equal(security.overlayProtection, false);
    assert.equal(security.multiWindow(), null);
    assert.doesNotThrow(() => security.release());
  });
});

describe('away and interruption tracking', () => {
  test('the limit is the existing 10 seconds, and matches the server', () => {
    assert.equal(AWAY_LIMIT_MS, 10_000);
    const server = '../../papers/src/lib/exam-visibility-policy.ts';
    const path = new URL(server, import.meta.url);
    if (existsSync(path)) assert.match(readFileSync(path, 'utf8'), /export const VISIBILITY_GRACE_MS = 10_000;/);
  });

  test('repeated background events do not restart the clock', () => {
    let wall = 0;
    let mono = 0;
    const away = createAwayTracker(() => wall, () => mono);
    away.background();
    wall = mono = 4000;
    away.background();
    away.background();
    wall = mono = 11_000;
    assert.equal(away.foreground(), 11_000);
    assert.ok(11_000 > AWAY_LIMIT_MS);
  });

  test('returning within the limit reports the real time once; a second return reports nothing', () => {
    let t = 0;
    const away = createAwayTracker(() => t, () => t);
    away.background();
    t = 7000;
    const ms = away.foreground();
    assert.equal(ms, 7000);
    assert.ok(ms <= AWAY_LIMIT_MS);
    assert.equal(away.foreground(), null, 'one continuous interruption, one report');
  });

  test('turning the phone clock back cannot shorten the time away', () => {
    let wall = 1_000_000;
    let mono = 50;
    const away = createAwayTracker(() => wall, () => mono);
    away.background();
    wall -= 3_600_000; // date moved back an hour while away
    mono += 30_000;
    assert.equal(away.foreground(), 30_000);
  });

  test('time the phone slept still counts when only the wall clock moved', () => {
    let wall = 0;
    let mono = 0;
    const away = createAwayTracker(() => wall, () => mono);
    away.background();
    wall = 60_000; // screen locked: the monotonic clock may pause
    mono = 1000;
    assert.equal(away.foreground(), 60_000);
  });

  test('elapsed() reads the time so far without ending the interruption', () => {
    let t = 0;
    const away = createAwayTracker(() => t, () => t);
    assert.equal(away.elapsed(), null);
    away.background();
    t = 10_500;
    assert.equal(away.elapsed(), 10_500);
    t = 12_000;
    assert.equal(away.foreground(), 12_000);
    assert.equal(away.elapsed(), null);
  });

  test('foreground then background again starts a fresh interruption', () => {
    let t = 0;
    const away = createAwayTracker(() => t, () => t);
    away.background();
    t = 2000;
    away.foreground();
    t = 5000;
    away.background();
    t = 6000;
    assert.equal(away.foreground(), 1000);
  });
});

describe('split-screen / multi-window', () => {
  const screen = { width: 412, height: 915 };

  test("Android's own answer is authoritative either way", () => {
    assert.deepEqual(readMultiWindow(true, screen, screen), { inMultiWindow: true, authoritative: true });
    assert.deepEqual(readMultiWindow(false, { width: 412, height: 300 }, screen), { inMultiWindow: false, authoritative: true }, 'the native answer wins over the size');
  });

  test('without it, a much smaller window is only a guess', () => {
    assert.deepEqual(readMultiWindow(null, { width: 412, height: 450 }, screen), { inMultiWindow: true, authoritative: false });
    assert.deepEqual(readMultiWindow(null, screen, screen), { inMultiWindow: false, authoritative: false });
  });

  test('a window a little short of the screen (system bars) is not split-screen', () => {
    assert.equal(readMultiWindow(null, { width: 412, height: 860 }, screen).inMultiWindow, false);
  });

  test('an unknown screen size never reads as split-screen', () => {
    assert.equal(readMultiWindow(null, { width: 100, height: 100 }, { width: 0, height: 0 }).inMultiWindow, false);
  });

  test('the module reports multi-window when Android does', () => {
    const security = createExamSecurity(fakeNative({ isInMultiWindow: () => true }));
    assert.equal(security.multiWindow(), true);
  });
});

describe('back navigation', () => {
  test('Back is blocked only while the exam is being answered', () => {
    assert.equal(backAction('running'), 'block');
    for (const phase of ['loading', 'error', 'intro', 'review']) assert.equal(backAction(phase), 'close', phase);
  });
});
