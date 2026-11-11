// Subject chips for multi-subject tests and papers.
//   node --experimental-strip-types --test tests/subjects.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chipsFor, subjectsLabel, subjectsOf } from '../src/shared/subjects.ts';

describe('subjectsOf', () => {
  test('splits the server text on commas and the other joiners', () => {
    assert.deepEqual(subjectsOf('Physics, Chemistry'), ['Physics', 'Chemistry']);
    assert.deepEqual(subjectsOf('Physics + Chemistry & Biology'), ['Physics', 'Chemistry', 'Biology']);
    assert.deepEqual(subjectsOf('Physics/Mathematics'), ['Physics', 'Mathematics']);
  });
  test('one subject, empty, repeats and stray spaces', () => {
    assert.deepEqual(subjectsOf('Physics'), ['Physics']);
    assert.deepEqual(subjectsOf(''), []);
    assert.deepEqual(subjectsOf(null), []);
    assert.deepEqual(subjectsOf(' Physics ,physics, , Chemistry '), ['Physics', 'Chemistry']);
  });
});

describe('chips and labels', () => {
  test('at most 3 chips, the rest as +n', () => {
    assert.deepEqual(chipsFor(['P', 'C', 'M', 'B']), { shown: ['P', 'C', 'M'], more: 1 });
    assert.deepEqual(chipsFor(['P']), { shown: ['P'], more: 0 });
  });
  test('read out as one sentence', () => {
    assert.equal(subjectsLabel(['Physics']), 'Subject: Physics');
    assert.equal(subjectsLabel(['Physics', 'Chemistry', 'Biology']), 'Subjects: Physics, Chemistry and Biology');
    assert.equal(subjectsLabel([]), 'No subject');
  });
});
