// UX-2A focused tests: the PYQ practice session's sums.
//   node --experimental-strip-types --test tests/student-practice.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { accuracyOf, canResume, resumePosition, sessionStats, toneOf } from '../src/screens/student/practice-session.ts';

const qs = ['a', 'b', 'c', 'd', 'e'].map((_id) => ({ _id }));

describe('practice session summary', () => {
  test('counts attempted, correct, wrong and accuracy from checked answers only', () => {
    const results = { a: { correct: true, selected: 'A' }, b: { correct: false, selected: 'C' }, d: { correct: true, selected: 'B' } };
    const s = sessionStats(qs, results, new Set(['c']));
    assert.equal(s.attempted, 3);
    assert.equal(s.correct, 2);
    assert.equal(s.wrong, 1);
    assert.equal(s.skipped, 1);
    assert.equal(s.accuracy, 67);
    assert.deepEqual(s.wrongQuestions.map((q) => q._id), ['b']);
  });

  test('a skipped question answered later counts as answered, not skipped', () => {
    const s = sessionStats(qs, { c: { correct: false, selected: 'D' } }, new Set(['c']));
    assert.equal(s.skipped, 0);
    assert.equal(s.wrong, 1);
  });

  test('nothing answered: no accuracy, nothing to retry', () => {
    const s = sessionStats(qs, {}, new Set(['a', 'b']));
    assert.equal(s.accuracy, null);
    assert.equal(s.attempted, 0);
    assert.equal(s.skipped, 2);
    assert.deepEqual(s.wrongQuestions, []);
  });

  test('wrong questions keep the order they were asked in (the retry order)', () => {
    const results = { e: { correct: false, selected: 'A' }, a: { correct: false, selected: 'B' }, c: { correct: true, selected: 'C' } };
    assert.deepEqual(sessionStats(qs, results, new Set()).wrongQuestions.map((q) => q._id), ['a', 'e']);
  });

  test('accuracy and tone bands', () => {
    assert.equal(accuracyOf(0, 0), null);
    assert.equal(accuracyOf(1, 3), 33);
    assert.equal(toneOf(70), 'success');
    assert.equal(toneOf(69), 'warning');
    assert.equal(toneOf(39), 'danger');
  });

  test('keep practising carries on after the last question seen in the bank', () => {
    assert.equal(resumePosition(4, 10), 5);
    assert.equal(resumePosition(9, 10), 10, 'past the loaded page: the next page is loaded');
    assert.equal(canResume(4, 10, false), true);
    assert.equal(canResume(9, 10, true), true);
    assert.equal(canResume(9, 10, false), false, 'the bank is finished');
  });
});
