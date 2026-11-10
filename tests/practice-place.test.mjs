// 1B: topic practice as pushed screens: links, finding the chapter a link means, and the saved "Continue" place.
//   node --experimental-strip-types --test tests/practice-place.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { findChapter, findTopic, isLastPractised, practiceChapterHref, practiceSubjectHref, WHOLE_CHAPTER } from '../src/screens/student/practice/practice-place.ts';

const ch = (standard, chapter, mine) => ({ standard, chapter, mine });

describe('practice links', () => {
  test('encode names with spaces and symbols', () => {
    assert.equal(practiceSubjectHref('Physics'), '/practice/Physics');
    assert.equal(practiceChapterHref({ subject: 'Chemistry', chapter: 'Some Basic Concepts & Mole' }), '/practice/Chemistry/Some%20Basic%20Concepts%20%26%20Mole');
    assert.equal(
      practiceChapterHref({ subject: 'Physics', chapter: 'Kinematics', standard: '11th', topic: 'Projectile Motion' }),
      '/practice/Physics/Kinematics?standard=11th&topic=Projectile+Motion'
    );
    assert.equal(practiceChapterHref({ subject: 'Physics', chapter: 'Kinematics', topic: WHOLE_CHAPTER }), '/practice/Physics/Kinematics?topic=__all__');
    assert.equal(practiceChapterHref({ subject: 'Physics', chapter: 'Kinematics', topic: null, standard: null }), '/practice/Physics/Kinematics');
  });
});

describe('the chapter a link means', () => {
  const chapters = [ch('11th', 'Kinematics', false), ch('12th', 'Electrostatics', true), ch('12th', 'Kinematics', true)];
  test('by name, ignoring case and spaces at the ends', () => {
    assert.equal(findChapter(chapters, '  electrostatics ')?.standard, '12th');
  });
  test('the given class wins, else the student\'s own class, else the first match', () => {
    assert.equal(findChapter(chapters, 'Kinematics', '11th')?.standard, '11th');
    assert.equal(findChapter(chapters, 'Kinematics')?.standard, '12th');
    assert.equal(findChapter([ch('11th', 'Optics', false), ch('12th', 'Optics', false)], 'Optics')?.standard, '11th');
    assert.equal(findChapter(chapters, 'Kinematics', '10th')?.standard, '12th');
  });
  test('a chapter that is not there is null, never another one', () => {
    assert.equal(findChapter(chapters, 'Thermodynamics'), null);
    assert.equal(findTopic([{ topic: 'Projectile Motion' }], 'projectile motion')?.topic, 'Projectile Motion');
    assert.equal(findTopic([{ topic: 'Projectile Motion' }], 'Graphs'), null);
  });
});

describe('the saved Continue place', () => {
  const good = { subject: 'Physics', standard: '11th', chapter: 'Kinematics', topic: null, at: 1 };
  test('accepts a well-formed place, with or without a topic', () => {
    assert.equal(isLastPractised(good), true);
    assert.equal(isLastPractised({ ...good, topic: 'Graphs' }), true);
  });
  test('rejects anything else (old or broken data on the phone)', () => {
    for (const bad of [null, 'x', {}, { ...good, at: '1' }, { ...good, topic: 3 }, { ...good, chapter: undefined }]) assert.equal(isLastPractised(bad), false);
  });
});
