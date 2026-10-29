// Topic practice focused tests: queries, labels and ordering.
//   node --experimental-strip-types --test tests/topic-practice.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  actionsFor,
  answerDelta,
  applyAnswer,
  breadcrumb,
  completionText,
  countLabel,
  coverageLabel,
  mergePage,
  nextPlace,
  NO_EXPLANATION,
  nodeKey,
  statsAt,
  positionOf,
  practiceQuery,
  sessionTally,
  sortTopics,
  STATUS_OF,
} from '../src/screens/student/topic-practice.ts';

const topicNode = { subject: 'Physics', standard: '11th', chapter: 'Motion in a Plane', topic: 'Projectile Motion' };
const chapterNode = { ...topicNode, topic: null };

describe('practice queries', () => {
  test('a topic page asks for 10 by default and encodes names', () => {
    assert.equal(
      practiceQuery(topicNode, 'unanswered'),
      'subject=Physics&standard=11th&chapter=Motion%20in%20a%20Plane&topic=Projectile%20Motion&status=unanswered&limit=10'
    );
  });

  test('the whole chapter leaves the topic out; the next page passes the last id', () => {
    const q = practiceQuery(chapterNode, 'all', '64b7f0c2a1b2c3d4e5f60718');
    assert.ok(!q.includes('topic='));
    assert.ok(q.includes('after=64b7f0c2a1b2c3d4e5f60718'));
  });

  test('names with & or + survive', () => {
    const q = practiceQuery({ ...topicNode, chapter: 'Work, Energy & Power', topic: 'a+b' }, 'all');
    assert.ok(q.includes('chapter=Work%2C%20Energy%20%26%20Power'));
    assert.ok(q.includes('topic=a%2Bb'));
  });

  test('each action asks for its own questions', () => {
    assert.deepEqual(STATUS_OF, { continue: 'unanswered', review: 'answered', retry: 'incorrect', again: 'all' });
  });

  test('node keys tell a topic from its whole chapter', () => {
    assert.notEqual(nodeKey(topicNode), nodeKey(chapterNode));
  });
});

describe('labels', () => {
  test('breadcrumb', () => {
    assert.equal(breadcrumb(topicNode), 'Physics → Motion in a Plane → Projectile Motion');
    assert.equal(breadcrumb(chapterNode), 'Physics → Motion in a Plane → All chapter questions');
  });

  test('counts and coverage', () => {
    assert.equal(countLabel({ questions: 0, answered: 0 }), 'No practice questions yet');
    assert.equal(countLabel({ questions: 1, answered: 0 }), '1 question · not started');
    assert.equal(countLabel({ questions: 40, answered: 12 }), '40 questions · 12 done');
    assert.equal(coverageLabel({ topics: [], coveredTopics: 1, totalTopics: 1 }), 'Covered in class');
    assert.equal(coverageLabel({ topics: [], coveredTopics: 0, totalTopics: 1 }), 'Not covered yet');
    assert.equal(coverageLabel({ topics: [{}, {}, {}], coveredTopics: 2, totalTopics: 3 }), 'Covered 2/3 topics');
  });

  test('the missing-explanation text', () => {
    assert.equal(NO_EXPLANATION, 'Explanation is not available for this question yet.');
  });
});

describe('practising', () => {
  test('pages merge without repeats', () => {
    const merged = mergePage([{ _id: 'a' }, { _id: 'b' }], [{ _id: 'b' }, { _id: 'c' }]);
    assert.deepEqual(merged.map((q) => q._id), ['a', 'b', 'c']);
  });

  test('continuing counts on from the answers saved before', () => {
    assert.deepEqual(positionOf('continue', 0, 30, { answered: 20, questions: 50 }), { current: 21, of: 50 });
    assert.deepEqual(positionOf('continue', 40, 30, { answered: 20, questions: 50 }), { current: 50, of: 50 });
    assert.deepEqual(positionOf('review', 2, 20, { answered: 20, questions: 50 }), { current: 3, of: 20 });
    assert.deepEqual(positionOf('retry', 0, 0, { answered: 0, questions: 0 }), { current: 1, of: 1 });
  });

  test('actions follow the counts, and the right one leads', () => {
    assert.deepEqual(actionsFor({ questions: 0, answered: 0, wrong: 0, remaining: 0 }), { continue: 'none', review: false, retry: false, again: false, primary: null });
    assert.deepEqual(actionsFor({ questions: 50, answered: 0, wrong: 0, remaining: 50 }), { continue: 'start', review: false, retry: false, again: false, primary: 'continue' });
    // Still practising: continue leads, retry is there for the wrong ones, review for anything answered.
    assert.deepEqual(actionsFor({ questions: 50, answered: 20, wrong: 5, remaining: 30 }), { continue: 'continue', review: true, retry: true, again: false, primary: 'continue' });
    assert.deepEqual(actionsFor({ questions: 50, answered: 20, wrong: 0, remaining: 30 }), { continue: 'continue', review: true, retry: false, again: false, primary: 'continue' });
    // Complete with some wrong: retry leads.
    assert.deepEqual(actionsFor({ questions: 50, answered: 50, wrong: 4, remaining: 0 }), { continue: 'done', review: true, retry: true, again: false, primary: 'retry' });
    // Complete and all right: practise again instead of retry.
    assert.deepEqual(actionsFor({ questions: 50, answered: 50, wrong: 0, remaining: 0 }), { continue: 'done', review: true, retry: false, again: true, primary: 'again' });
  });

  test('practising again goes through every question', () => {
    assert.equal(STATUS_OF.again, 'all');
    assert.deepEqual(positionOf('again', 4, 40, { answered: 40, questions: 40 }), { current: 5, of: 40 });
  });

  test('the completion message', () => {
    assert.equal(completionText({ questions: 40, correct: 34, accuracy: 85 }), 'All 40 questions answered · 85% accuracy (34 correct)');
    assert.equal(completionText({ questions: 1, correct: 0, accuracy: 0 }), 'The question is answered · 0% accuracy (0 correct)');
  });

  test('the next topic or chapter still to finish', () => {
    const s = (questions, answered) => ({ questions, answered, correct: answered, wrong: 0, remaining: questions - answered, accuracy: answered ? 100 : null });
    const chapters = [
      {
        standard: '11th',
        chapter: 'Motion in a Plane',
        ...s(60, 30),
        topics: [
          { topic: 'Relative Velocity', coveredOn: null, ...s(10, 0) },
          { topic: 'Projectile Motion', coveredOn: '2026-10-01', ...s(30, 30) },
          { topic: 'Uniform Circular Motion', coveredOn: '2026-10-05', ...s(20, 0) },
          { topic: 'Empty', coveredOn: null, ...s(0, 0) },
        ],
      },
      { standard: '11th', chapter: 'Laws of Motion', ...s(40, 40), topics: [] },
      { standard: '11th', chapter: 'Work, Energy and Power', ...s(25, 3), topics: [{ topic: 'Work', coveredOn: null, ...s(25, 3) }] },
    ];
    const at = (topic) => ({ standard: '11th', chapter: 'Motion in a Plane', topic });

    // Covered topics are listed first, so after Projectile Motion comes Uniform Circular Motion.
    assert.deepEqual(nextPlace(chapters, at('Projectile Motion')), {
      kind: 'topic',
      standard: '11th',
      chapter: 'Motion in a Plane',
      topic: 'Uniform Circular Motion',
      label: 'Next topic: Uniform Circular Motion',
    });
    // From the last unfinished one it wraps round; topics without questions are skipped.
    assert.equal(nextPlace(chapters, at('Uniform Circular Motion')).topic, 'Relative Velocity');

    // With the chapter's topics all done, the next unfinished chapter (finished ones skipped).
    const done = chapters.map((c, i) => (i === 0 ? { ...c, ...s(60, 60), topics: c.topics.map((t) => ({ ...t, ...s(t.questions, t.questions) })) } : c));
    assert.deepEqual(nextPlace(done, at('Projectile Motion')), {
      kind: 'chapter',
      standard: '11th',
      chapter: 'Work, Energy and Power',
      topic: null,
      label: 'Next chapter: Work, Energy and Power',
    });
    // The whole chapter goes to the next chapter, not a topic of its own.
    assert.equal(nextPlace(chapters, at(null)).kind, 'chapter');
    // Nothing left anywhere.
    const allDone = done.map((c) => ({ ...c, ...s(c.questions, c.questions), topics: c.topics.map((t) => ({ ...t, ...s(t.questions, t.questions) })) }));
    assert.equal(nextPlace(allDone, at('Projectile Motion')), null);

    assert.equal(statsAt(chapters, at('Projectile Motion')).remaining, 0);
    assert.equal(statsAt(chapters, at(null)).questions, 60);
    assert.equal(statsAt(chapters, at('Nope')), null);
  });

  test('covered topics come first, otherwise in syllabus order', () => {
    const topics = [
      { topic: 'A', coveredOn: null },
      { topic: 'B', coveredOn: '2026-10-01' },
      { topic: 'C', coveredOn: null },
      { topic: 'D', coveredOn: '2026-09-01' },
    ];
    assert.deepEqual(sortTopics(topics).map((t) => t.topic), ['B', 'D', 'A', 'C']);
  });

  test('a saved answer moves the counts at once', () => {
    const s = (questions, answered, correct) => ({ questions, answered, correct, wrong: answered - correct, remaining: questions - answered, accuracy: answered ? Math.round((correct / answered) * 100) : null });
    const tree = {
      subject: 'Physics',
      summary: { ...s(60, 20, 15), coveredTopics: 1, totalTopics: 4 },
      chapters: [
        { standard: '11th', chapter: 'Motion in a Plane', ...s(50, 20, 15), topics: [{ topic: 'Projectile Motion', ...s(40, 20, 15) }, { topic: 'Relative Velocity', ...s(10, 0, 0) }] },
        { standard: '11th', chapter: 'Units', ...s(10, 0, 0), topics: [] },
      ],
    };
    const at = { standard: '11th', chapter: 'Motion in a Plane', topic: 'Projectile Motion' };

    // A first answer, right.
    const first = answerDelta(null, { correct: true });
    assert.deepEqual(first, { answered: 1, correct: 1 });
    const after = applyAnswer(tree, at, first);
    assert.deepEqual(after.chapters[0].topics[0], { topic: 'Projectile Motion', ...s(40, 21, 16) });
    assert.deepEqual({ ...after.chapters[0], topics: undefined }, { standard: '11th', chapter: 'Motion in a Plane', ...s(50, 21, 16), topics: undefined });
    assert.deepEqual(after.summary, { ...s(60, 21, 16), coveredTopics: 1, totalTopics: 4 });
    assert.equal(after.chapters[0].topics[1], tree.chapters[0].topics[1], 'other topics untouched');
    assert.equal(after.chapters[1], tree.chapters[1], 'other chapters untouched');
    assert.equal(tree.summary.answered, 20, 'the old tree is not changed');

    // Retrying a wrong one and getting it right: no new answer, one more right.
    const retry = answerDelta({ correct: false }, { correct: true });
    assert.deepEqual(retry, { answered: 0, correct: 1 });
    assert.deepEqual(applyAnswer(tree, at, retry).chapters[0].topics[0], { topic: 'Projectile Motion', ...s(40, 20, 16) });
    assert.deepEqual(answerDelta({ correct: true }, { correct: false }), { answered: 0, correct: -1 });

    // No change, or a chapter not listed: the same tree back.
    assert.equal(applyAnswer(tree, at, answerDelta({ correct: true }, { correct: true })), tree);
    assert.equal(applyAnswer(tree, { ...at, chapter: 'Elsewhere' }, first), tree);

    // A question without a listed topic counts for its chapter only.
    const untagged = applyAnswer(tree, { ...at, topic: '' }, first);
    assert.equal(untagged.chapters[0].answered, 21);
    assert.deepEqual(untagged.chapters[0].topics.map((t) => t.answered), [20, 0]);
  });

  test('session tally', () => {
    assert.deepEqual(sessionTally({}), { answered: 0, correct: 0, wrong: 0 });
    assert.deepEqual(sessionTally({ a: { correct: true }, b: { correct: false }, c: { correct: true } }), { answered: 3, correct: 2, wrong: 1 });
  });
});
