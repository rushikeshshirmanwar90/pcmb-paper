import assert from 'node:assert/strict';
import { test } from 'node:test';
import { endProblem, classProblem, from12, label12 } from '../src/screens/tuition/timetable-draft.ts';

test('session duration boundaries and changing start time', () => {
  assert.ok(endProblem('11:00', '11:00'));
  assert.ok(endProblem('11:00', '18:00'));
  assert.ok(endProblem('11:00', '11:59'));
  assert.equal(endProblem('11:00', '12:00'), null);
  assert.equal(endProblem('11:00', '17:00'), null);
  assert.ok(endProblem('11:00', '17:01'));
  assert.ok(endProblem('12:00', '12:00'));
  assert.ok(endProblem('23:00', '00:00'));
});
test('AM/PM conversions preserve noon and midnight', () => {
  assert.equal(from12(12, 0, true), '12:00');
  assert.equal(from12(12, 0, false), '00:00');
  assert.equal(label12('12:00'), '12:00 PM');
});
test('multiple weekdays, overlap, adjacent sessions and editing exclusion', () => {
  const entries = [{ id: 'one', subject: 'Physics', day: 1, start: '11:00', end: '12:00' }];
  assert.ok(classProblem(entries, [], '11:00', '12:00'));
  assert.ok(classProblem(entries, [1, 3], '11:00', '12:00'));
  assert.equal(classProblem(entries, [1, 3], '12:00', '13:00'), null);
  assert.equal(classProblem(entries, [1], '11:00', '12:00', 'one'), null);
});
