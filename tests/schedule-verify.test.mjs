import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdded, verifyRemoved, verifyUpdated } from '../src/screens/tuition/schedule-verify.ts';

const fields = { batchId: 'b1', subject: 'Physics', start: '16:00', end: '17:30', teacherId: 't1', note: '' };
const entry = (id, day, over = {}) => ({ id, day, batch: { id: 'b1', name: 'B', venue: '' }, teacher: { id: 't1', name: 'T' }, subject: 'Physics', start: '16:00', end: '17:30', note: '', mine: false, ...over });

test('write that succeeded before the client timed out is confirmed', () => {
  assert.deepEqual(verifyAdded([entry('n1', 1)], new Set(), fields, [1]), { state: 'done' });
});
test('nothing saved: safe to retry', () => {
  assert.deepEqual(verifyAdded([], new Set(), fields, [1]), { state: 'none' });
});
test('a class that was already there is not success', () => {
  assert.deepEqual(verifyAdded([entry('old', 1)], new Set(['old']), fields, [1]), { state: 'none' });
});
test('a different teacher, time or subject is not success', () => {
  for (const over of [{ teacher: { id: 't2', name: 'X' } }, { end: '18:00' }, { subject: 'Chemistry' }, { note: 'x' }, { batch: { id: 'b2', name: '', venue: '' } }]) {
    assert.equal(verifyAdded([entry('n1', 1, over)], new Set(), fields, [1]).state, 'none');
  }
});
test('multi-day: partial success lists saved and missing days', () => {
  assert.deepEqual(verifyAdded([entry('n1', 1), entry('n3', 3)], new Set(), fields, [1, 3, 5]), { state: 'partial', saved: [1, 3], missing: [5] });
});
test('multi-day: all days confirmed', () => {
  assert.equal(verifyAdded([entry('n1', 1), entry('n3', 3)], new Set(), fields, [1, 3]).state, 'done');
});
test('update and remove checks', () => {
  assert.equal(verifyUpdated([entry('e', 2)], 'e', fields, 2).state, 'done');
  assert.equal(verifyUpdated([entry('e', 2, { end: '18:00' })], 'e', fields, 2).state, 'none');
  assert.equal(verifyRemoved([], 'e').state, 'done');
  assert.equal(verifyRemoved([entry('e', 2)], 'e').state, 'none');
});
