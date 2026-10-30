// Self-assessment: picking chapters and topics, time limits and labels.
//   node --experimental-strip-types --test tests/self-assessment.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  basisText,
  chapterState,
  isTopicPicked,
  pickedQuestions,
  questionList,
  scopeOf,
  secondsLeft,
  selectionLabel,
  splitLabel,
  suggestedMinutes,
  summaryLine,
  timeChoices,
  timeLabel,
  toggleChapter,
  toggleTopic,
} from '../src/screens/student/self-assessment.ts';

const kin = {
  standard: '11th',
  chapter: 'Kinematics',
  questions: 50,
  topics: [
    { topic: 'Projectile Motion', questions: 20 },
    { topic: 'Relative Velocity', questions: 10 },
    { topic: 'Graphs', questions: 15 },
  ],
};
const units = { standard: '11th', chapter: 'Units', questions: 8, topics: [] };
const chapters = [kin, units];

describe('picking chapters and topics', () => {
  test('a chapter picks whole, and tapping again drops it', () => {
    let s = toggleChapter({}, kin);
    assert.equal(chapterState(s, kin), 'all');
    assert.ok(isTopicPicked(s, kin, 'Graphs'), 'every topic counts as picked');
    s = toggleChapter(s, kin);
    assert.equal(chapterState(s, kin), 'none');
    assert.deepEqual(s, {});
  });

  test('topics pick one by one; all of them become the whole chapter', () => {
    let s = toggleTopic({}, kin, 'Graphs');
    s = toggleTopic(s, kin, 'Projectile Motion');
    assert.equal(chapterState(s, kin), 'some');
    assert.deepEqual(scopeOf(s, chapters), [{ standard: '11th', chapter: 'Kinematics', topics: ['Projectile Motion', 'Graphs'] }], 'in syllabus order');
    s = toggleTopic(s, kin, 'Relative Velocity');
    assert.equal(chapterState(s, kin), 'all');
    assert.deepEqual(scopeOf(s, chapters)[0].topics, [], 'whole chapter: no topic list');
  });

  test('dropping a topic from a whole chapter keeps the others', () => {
    let s = toggleChapter({}, kin);
    s = toggleTopic(s, kin, 'Graphs');
    assert.deepEqual(scopeOf(s, chapters)[0].topics, ['Projectile Motion', 'Relative Velocity']);
    s = toggleTopic(toggleTopic(s, kin, 'Projectile Motion'), kin, 'Relative Velocity');
    assert.deepEqual(s, {}, 'no topics left: the chapter goes');
  });

  test('question counts and labels', () => {
    let s = toggleTopic({}, kin, 'Projectile Motion');
    assert.equal(pickedQuestions(s, chapters), 20);
    assert.equal(selectionLabel(s, chapters), 'Kinematics · 1 topic');
    s = toggleChapter(s, units);
    assert.equal(pickedQuestions(s, chapters), 28);
    assert.equal(selectionLabel(s, chapters), '2 chapters · 1 whole, 1 topic');
    assert.equal(selectionLabel({}, chapters), 'Nothing picked yet');
  });
});

describe('time limits', () => {
  test('exam pace: 2 min a question, 1 for Biology, rounded up to 5', () => {
    assert.equal(suggestedMinutes(20, 'Physics'), 40);
    assert.equal(suggestedMinutes(45, 'Biology'), 45);
    assert.equal(suggestedMinutes(2, 'Biology'), 5, 'at least 5 minutes');
    assert.deepEqual(timeChoices(20, 'Physics'), ['40', '60', '0']);
    assert.equal(timeLabel('40', 40), '40 min · exam pace');
    assert.equal(timeLabel('0', 40), 'No limit');
  });

  test('seconds left from the deadline; null without one', () => {
    const now = Date.parse('2026-10-30T10:00:00Z');
    assert.equal(secondsLeft('2026-10-30T10:01:30Z', now), 90);
    assert.equal(secondsLeft('2026-10-30T09:00:00Z', now), 0);
    assert.equal(secondsLeft(null, now), null);
  });
});

describe('labels', () => {
  test('splits, question lists and why Smart chose its mix', () => {
    assert.equal(splitLabel({ Easy: 6, Medium: 10, Hard: 4 }), '6 easy · 10 medium · 4 hard');
    assert.equal(questionList([2, 5, 7]), 'Q2, Q5 and Q7');
    assert.equal(questionList([3]), 'Q3');
    assert.match(basisText('smart', { kind: 'struggling', accuracy: 30, answered: 20 }), /30%.*more easy/);
    assert.match(basisText('smart', { kind: 'no-history', accuracy: null, answered: 1 }), /Not enough practice/);
    assert.match(basisText('balanced', { kind: 'fixed', accuracy: null, answered: 0 }), /real exam/);
  });

  test('the list line says where each one stands', () => {
    const base = { subject: 'Physics', questionCount: 20, answeredCount: 0, durationMinutes: 40, result: null };
    assert.equal(summaryLine({ ...base, state: 'ready' }), 'Physics · Not started · 20 questions · 40 min');
    assert.equal(summaryLine({ ...base, state: 'in-progress', answeredCount: 7 }), 'Physics · In progress · 7 of 20 answered');
    assert.equal(
      summaryLine({ ...base, state: 'submitted', result: { correct: 12, weakTopics: 2 } }),
      'Physics · 12/20 right · 2 weak topics'
    );
  });
});
