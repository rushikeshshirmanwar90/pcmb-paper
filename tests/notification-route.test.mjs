// Notification taps: a batch enrollment request opens People › Students;
// every other notification keeps opening its own tab.
//   node --experimental-strip-types --test tests/notification-route.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { routeForNotification } from '../src/services/notification-route.ts';

describe('routeForNotification', () => {
  test('a batch enrollment request opens People › Students, even with a stale home tab', () => {
    assert.deepEqual(routeForNotification({ tab: 'home', kind: 'batch-enrollment' }), { tab: 'people', showStudents: true });
    assert.deepEqual(routeForNotification({ kind: 'batch-enrollment' }), { tab: 'people', showStudents: true });
  });
  test('legacy join requests, tests and reminders keep their tab', () => {
    assert.deepEqual(routeForNotification({ tab: 'home', kind: 'join-request' }), { tab: 'home' });
    assert.deepEqual(routeForNotification({ tab: 'tests', kind: 'test' }), { tab: 'tests' });
    assert.deepEqual(routeForNotification({ tab: 'home', kind: 'timetable' }), { tab: 'home' });
  });
  test('no usable data means no navigation', () => {
    assert.equal(routeForNotification(undefined), null);
    assert.equal(routeForNotification({ kind: 'x' }), null);
  });
});
