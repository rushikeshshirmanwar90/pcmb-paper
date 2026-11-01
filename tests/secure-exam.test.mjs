// Phase 2B focused tests: the secure exam's clock, away tracking and palette rules.
//   node --experimental-strip-types --test tests/secure-exam.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AWAY_LIMIT_MS, cellStatus, createAwayTracker, examCounts, secondsLeft, skewOf } from '../src/screens/student/exam-guard.ts';

describe('server clock', () => {
  test('the deadline is measured on the server clock, not the phone clock', () => {
    const phone = Date.parse('2030-01-01T10:00:00Z');
    // The phone is 2 hours fast; the server says it is 10:00 minus that.
    const server = new Date(phone - 2 * 3600_000).toISOString();
    const skew = skewOf(server, phone);
    const deadline = new Date(phone - 2 * 3600_000 + 30 * 60_000).toISOString();
    assert.equal(secondsLeft(deadline, skew, phone), 30 * 60);
    assert.equal(secondsLeft(deadline, 0, phone), 0, 'trusting the phone clock would end the test at once');
  });

  test('time only runs down, never below zero, and a missing server time means no correction', () => {
    const now = Date.now();
    const deadline = new Date(now + 90_000).toISOString();
    assert.equal(secondsLeft(deadline, 0, now), 90);
    assert.equal(secondsLeft(deadline, 0, now + 60_000), 30);
    assert.equal(secondsLeft(deadline, 0, now + 500_000), 0);
    assert.equal(skewOf(undefined, now), 0);
    assert.equal(skewOf('not a date', now), 0);
  });

  test('restarting the app cannot extend the deadline: it is the same deadline measured again', () => {
    const now = Date.now();
    const deadline = new Date(now + 600_000).toISOString();
    const later = now + 300_000; // reopened five minutes on, with a fresh server reading
    assert.equal(secondsLeft(deadline, skewOf(new Date(later).toISOString(), later), later), 300);
  });
});

describe('away tracking', () => {
  test('reports how long the app was in the background, once', () => {
    let t = 1000;
    const away = createAwayTracker(() => t);
    assert.equal(away.foreground(), null, 'never left');
    away.background();
    t += 4000;
    assert.equal(away.foreground(), 4000);
    assert.equal(away.foreground(), null, 'already reported');
  });

  test('a second background event while away does not restart the clock', () => {
    let t = 0;
    const away = createAwayTracker(() => t);
    away.background();
    t = 3000;
    away.background();
    t = 12_000;
    assert.equal(away.foreground(), 12_000);
    assert.ok(12_000 > AWAY_LIMIT_MS);
  });
});

describe('palette status', () => {
  test('the five statuses', () => {
    assert.equal(cellStatus(false, false, false), 'not-visited');
    assert.equal(cellStatus(false, false, true), 'not-answered');
    assert.equal(cellStatus(true, false, true), 'answered');
    assert.equal(cellStatus(false, true, true), 'marked');
    assert.equal(cellStatus(true, true, true), 'answered-marked');
  });

  test('counts for the submit confirmation', () => {
    const counts = examCounts(['answered', 'answered-marked', 'marked', 'not-answered', 'not-visited']);
    assert.deepEqual(counts, { answered: 2, unanswered: 3, marked: 2, notVisited: 1 });
  });
});
