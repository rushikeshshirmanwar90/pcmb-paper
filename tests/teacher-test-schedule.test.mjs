// Phase 1: the teacher's test timing rules and Manage Tests rules.
//   node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  actionsFor,
  durationProblem,
  filterTests,
  lastStartOf,
  marksProblem,
  maxMarks,
  scheduleProblem,
  sortTests,
  suggestClosing,
  withDay,
  withTime,
} from '../src/screens/teacher/test-schedule.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = new Date(2026, 10, 3, 9, 0, 0).getTime(); // 3 Nov 2026, 09:00 local

describe('scheduleProblem', () => {
  const later = (opensInMs, windowMs, durationMinutes = 60) =>
    scheduleProblem({ mode: 'later', opensAt: new Date(now + opensInMs), closesAt: new Date(now + opensInMs + windowMs), durationMinutes }, now);

  test('a future opening with a window that fits the time limit is fine', () => {
    assert.equal(later(HOUR, 3 * HOUR), null);
  });
  test('an opening time in the past, or too close to now, is refused', () => {
    assert.match(later(-HOUR, 3 * HOUR), /future/);
    assert.match(later(0, 3 * HOUR), /future/);
    assert.match(later(30_000, 3 * HOUR), /future/);
  });
  test('today later in the day is fine once it is in the future', () => {
    assert.equal(later(2 * HOUR, 2 * HOUR), null);
  });
  test('closing at or before opening is refused', () => {
    assert.match(later(HOUR, 0), /after it opens/);
    assert.match(later(HOUR, -HOUR), /after it opens/);
  });
  test('the window must fit the whole time limit; exactly equal is allowed', () => {
    assert.match(later(HOUR, 30 * MIN), /time limit/);
    assert.equal(later(HOUR, 60 * MIN), null);
  });
  test('a window over six hours is fine', () => {
    assert.equal(later(HOUR, 72 * HOUR), null);
  });
  test('Start Now opens at the clock, and still needs a closing time that fits', () => {
    const start = (closesInMs) => scheduleProblem({ mode: 'now', opensAt: null, closesAt: closesInMs === null ? null : new Date(now + closesInMs), durationMinutes: 60 }, now);
    assert.equal(start(2 * HOUR), null);
    assert.match(start(null), /closes/);
    assert.match(start(-HOUR), /after it opens/);
    assert.match(start(30 * MIN), /time limit/);
  });
  test('a scheduled test needs an opening time', () => {
    assert.match(scheduleProblem({ mode: 'later', opensAt: null, closesAt: new Date(now + HOUR), durationMinutes: 60 }, now), /opens/);
  });
});

describe('closing time and last start', () => {
  test('the suggested closing is the time limit plus an hour, to the next 5 minutes', () => {
    const opens = new Date(2026, 10, 3, 10, 0, 0);
    assert.equal(suggestClosing(opens, 60).getTime(), new Date(2026, 10, 3, 12, 0, 0).getTime());
    const odd = new Date(2026, 10, 3, 10, 2, 0);
    assert.equal(suggestClosing(odd, 60).getTime(), new Date(2026, 10, 3, 12, 5, 0).getTime());
  });
  test('the last start is closing time minus the time limit (10:00–13:00, 60 min: 12:00)', () => {
    assert.equal(lastStartOf(new Date(2026, 10, 4, 13, 0), 60).getTime(), new Date(2026, 10, 4, 12, 0).getTime());
  });
  test('the suggestion always fits the time limit', () => {
    for (const d of [1, 30, 60, 180, 600]) {
      const opens = new Date(now);
      assert.equal(scheduleProblem({ mode: 'now', opensAt: null, closesAt: suggestClosing(opens, d), durationMinutes: d }, now), null);
    }
  });
  test('picking a day or a time keeps the other part', () => {
    const base = new Date(2026, 10, 3, 10, 30);
    assert.equal(withDay(base, new Date(2026, 10, 9)).getTime(), new Date(2026, 10, 9, 10, 30).getTime());
    assert.equal(withTime(base, '16:45').getTime(), new Date(2026, 10, 3, 16, 45).getTime());
  });
});

describe('marks and time limit', () => {
  test('maximum marks are worked out, without floating-point leftovers', () => {
    assert.equal(maxMarks(25, 4), 100);
    assert.equal(maxMarks(3, 0.1), 0.3);
  });
  test('bad marking is explained', () => {
    assert.equal(marksProblem('4', '1'), null);
    assert.equal(marksProblem('4', ''), null);
    assert.match(marksProblem('', '0'), /right answer/);
    assert.match(marksProblem('0', '0'), /right answer/);
    assert.match(marksProblem('2', '3'), /more than/);
  });
  test('the time limit is 1 to 600 whole minutes', () => {
    assert.equal(durationProblem('60'), null);
    assert.ok(durationProblem(''));
    assert.ok(durationProblem('0'));
    assert.ok(durationProblem('601'));
  });
});

describe('Manage Tests', () => {
  const t = (status, opensAt, closesAt, started = 0) => ({ status, opensAt, closesAt, started, title: `${status}-${opensAt}` });
  const tests = [
    t('closed', '2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z'),
    t('scheduled', '2026-11-20T10:00:00Z', '2026-11-20T14:00:00Z'),
    t('open', '2026-11-01T10:00:00Z', '2026-11-05T10:00:00Z'),
    t('scheduled', '2026-11-10T10:00:00Z', '2026-11-10T14:00:00Z'),
    t('closed', '2026-10-20T10:00:00Z', '2026-10-21T10:00:00Z'),
    t('open', '2026-11-02T10:00:00Z', '2026-11-04T10:00:00Z'),
  ];

  test('filters pick Upcoming, Live and Completed', () => {
    assert.equal(filterTests(tests, 'all').length, 6);
    assert.deepEqual(filterTests(tests, 'upcoming').map((x) => x.status), ['scheduled', 'scheduled']);
    assert.deepEqual(filterTests(tests, 'live').map((x) => x.status), ['open', 'open']);
    assert.deepEqual(filterTests(tests, 'completed').map((x) => x.status), ['closed', 'closed']);
  });
  test('live first, then the nearest upcoming, then the most recently completed', () => {
    const order = sortTests(tests).map((x) => `${x.status}@${x.closesAt}`);
    assert.deepEqual(order, [
      'open@2026-11-04T10:00:00Z',
      'open@2026-11-05T10:00:00Z',
      'scheduled@2026-11-10T14:00:00Z',
      'scheduled@2026-11-20T14:00:00Z',
      'closed@2026-10-21T10:00:00Z',
      'closed@2026-10-02T10:00:00Z',
    ]);
  });
  test('upcoming: edit and cancel; live: close now; completed: results only', () => {
    assert.deepEqual(actionsFor({ status: 'scheduled', started: 0 }), { edit: true, cancel: true, closeNow: false, results: false, submissions: false });
    assert.deepEqual(actionsFor({ status: 'open', started: 3 }), { edit: false, cancel: false, closeNow: true, results: false, submissions: true });
    assert.deepEqual(actionsFor({ status: 'closed', started: 3 }), { edit: false, cancel: false, closeNow: false, results: true, submissions: false });
  });
  test('an upcoming test someone has started can no longer be edited or cancelled', () => {
    const a = actionsFor({ status: 'scheduled', started: 1 });
    assert.equal(a.edit, false);
    assert.equal(a.cancel, false);
  });
});
