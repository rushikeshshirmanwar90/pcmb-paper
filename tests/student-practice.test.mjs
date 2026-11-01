// UX-2A focused tests: the PYQ practice session's sums.
//   node --experimental-strip-types --test tests/student-practice.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { accuracyOf, canResume, countsLine, resumePosition, sessionRows, sessionStats, sessionVerdict, toneOf } from '../src/screens/student/practice-session.ts';

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

describe('session result', () => {
  test('rows: questions met, in order, with what was chosen; skipped then answered counts as answered', () => {
    const results = { a: { correct: true, selected: 'A' }, c: { correct: false, selected: 'D' } };
    const rows = sessionRows(qs, results, new Set(['b', 'c']));
    assert.deepEqual(rows.map((r) => [r.index, r.question._id, r.outcome, r.selected]), [
      [0, 'a', 'correct', 'A'],
      [1, 'b', 'skipped', null],
      [2, 'c', 'wrong', 'D'],
    ]);
  });

  test('verdict: by band, naming what to do with the wrong ones', () => {
    assert.equal(sessionVerdict(100, 0, 0).title, 'Strong round');
    assert.match(sessionVerdict(100, 0, 0).text, /Every answer right/);
    assert.match(sessionVerdict(80, 1, 0).text, /the one you got wrong/);
    assert.equal(sessionVerdict(50, 3, 0).title, 'Getting there');
    assert.match(sessionVerdict(50, 3, 0).text, /the 3 you got wrong.*try them again/);
    assert.equal(sessionVerdict(20, 4, 1).title, 'Needs more work');
  });

  test('counts as one spoken phrase', () => {
    assert.equal(countsLine({ attempted: 8, correct: 5, skipped: 2 }), '5 of 8 answered right, 2 skipped');
    assert.equal(countsLine({ attempted: 3, correct: 3, skipped: 0 }), '3 of 3 answered right');
    assert.equal(countsLine({ attempted: 0, correct: 0, skipped: 4 }), '4 skipped');
    assert.equal(countsLine({ attempted: 0, correct: 0, skipped: 0 }), 'No questions answered');
  });

  test('verdict: nothing answered', () => {
    assert.equal(sessionVerdict(null, 0, 0).title, 'Nothing answered yet');
    assert.match(sessionVerdict(null, 0, 3).text, /skipped all 3/);
    assert.match(sessionVerdict(null, 0, 1).text, /skipped the question\. It's still here/);
  });
});
