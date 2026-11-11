// Subject sections of the exam runner.
//   node --experimental-strip-types --test tests/exam-sections.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { answeredIn, buildSections, landingFor, sectionOf, stepFrom, walkOrder } from '../src/screens/student/exam-sections.ts';

const qs = (...subjects) => subjects.map((subject) => ({ subject }));

describe('exam sections', () => {
  test('groups by subject in first-appearance order', () => {
    const s = buildSections(qs('Physics', 'Physics', 'Chemistry', 'Physics', ' chemistry ', ''));
    assert.deepEqual(s.map((x) => [x.label, x.positions]), [['Physics', [0, 1, 3]], ['Chemistry', [2, 4]], ['General', [5]]]);
  });

  test('a single subject is a single section', () => {
    assert.equal(buildSections(qs('Maths', 'Maths')).length, 1);
  });

  test('empty test has no sections', () => {
    assert.deepEqual(buildSections([]), []);
  });

  test('walking order crosses subject boundaries both ways', () => {
    const s = buildSections(qs('P', 'P', 'C', 'C'));
    const order = walkOrder(s);
    assert.deepEqual(order, [0, 1, 2, 3]);
    assert.equal(stepFrom(order, 1, 1), 2);
    assert.equal(stepFrom(order, 2, -1), 1);
    assert.equal(stepFrom(order, 0, -1), null);
    assert.equal(stepFrom(order, 3, 1), null);
  });

  test('interleaved subjects are walked subject by subject', () => {
    const order = walkOrder(buildSections(qs('P', 'C', 'P', 'C')));
    assert.deepEqual(order, [0, 2, 1, 3]);
    assert.equal(stepFrom(order, 2, 1), 1);
  });

  test('tapping a subject returns to its last visited question', () => {
    const s = buildSections(qs('P', 'P', 'C', 'C'));
    const last = new Map([['p', 1]]);
    assert.equal(landingFor(s[0], last), 1);
    assert.equal(landingFor(s[1], last), 2);
    assert.equal(landingFor(s[1], new Map([['c', 0]])), 2, 'ignores a position from another subject');
  });

  test('counts answered per subject and finds the owning section', () => {
    const s = buildSections(qs('P', 'P', 'C'));
    assert.equal(answeredIn(s[0], (p) => p === 1), 1);
    assert.equal(sectionOf(s, 2).label, 'C');
  });
});
