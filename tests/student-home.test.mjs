// UX-3 focused tests: what Home's "Next up" shows when there's no test.
//   node --experimental-strip-types --test tests/student-home.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nextClass } from '../src/screens/student/home-next-up.ts';

// Tuesday 27 Oct 2026, 15:00 local time (day 2; Sunday is 0).
const at = (hh, mm = 0) => new Date(2026, 9, 27, hh, mm);
const cls = (id, day, start, end) => ({ id, day, start, end, subject: id, batch: { id: 'b', name: 'B', venue: '' }, teacher: { id: 't', name: 'T' } });

describe('next class for Home', () => {
  test('no timetable: nothing', () => {
    assert.equal(nextClass([], at(15)), null);
  });

  test('later today comes first, in start order', () => {
    const week = [cls('late', 2, '18:00', '19:00'), cls('soon', 2, '16:00', '17:00'), cls('wed', 3, '09:00', '10:00')];
    assert.deepEqual(pick(nextClass(week, at(15))), ['soon', 0, false]);
  });

  test('a class on right now is shown as ongoing', () => {
    const week = [cls('now', 2, '14:30', '15:30'), cls('soon', 2, '16:00', '17:00')];
    assert.deepEqual(pick(nextClass(week, at(15))), ['now', 0, true]);
  });

  test('classes over for today are skipped; the next day with classes wins', () => {
    const week = [cls('morning', 2, '09:00', '10:00'), cls('fri', 5, '10:00', '11:00'), cls('thu', 4, '17:00', '18:00')];
    assert.deepEqual(pick(nextClass(week, at(15))), ['thu', 2, false]);
  });

  test('tomorrow is one day away, across the week end too', () => {
    assert.deepEqual(pick(nextClass([cls('wed', 3, '08:00', '09:00')], at(15))), ['wed', 1, false]);
    const saturday = new Date(2026, 9, 31, 20, 0);
    assert.deepEqual(pick(nextClass([cls('sun', 0, '08:00', '09:00')], saturday)), ['sun', 1, false]);
  });

  test("only today's class, already over: same time next week", () => {
    assert.deepEqual(pick(nextClass([cls('morning', 2, '09:00', '10:00')], at(15))), ['morning', 7, false]);
  });

  test('a class that just ended is not "on now"', () => {
    assert.deepEqual(pick(nextClass([cls('done', 2, '14:00', '15:00')], at(15))), ['done', 7, false]);
  });
});

function pick(next) {
  return next ? [next.entry.id, next.inDays, next.ongoing] : null;
}
