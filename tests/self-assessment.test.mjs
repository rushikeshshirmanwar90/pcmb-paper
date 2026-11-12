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
  resultTree,
  retakeSetup,
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
  answerRows,
  filterRows,
  quickSelection,
} from '../src/screens/student/self-assessment.ts';

describe('result answer rows', () => {
  const q = (index, topic, chapter = 'Kinematics') => ({ index, standard: '11th', chapter, topic });
  const questions = [q(0, 'Projectile Motion'), q(1, 'Relative Velocity'), q(2, 'Projectile Motion'), q(3, 'Heat', 'Thermal'), q(4, 'Relative Velocity')];
  const answers = [
    { index: 0, selected: 'A', correct: true },
    { index: 1, selected: 'B', correct: false },
    { index: 2, selected: null, correct: null },
    // 3: never answered
    { index: 4, selected: 'C', correct: false },
  ];

  test('every question once, in question order, with its outcome', () => {
    const rows = answerRows(questions, answers, null);
    assert.deepEqual(rows.map((r) => [r.q.index, r.outcome]), [[0, 'right'], [1, 'wrong'], [2, 'skipped'], [3, 'skipped'], [4, 'wrong']]);
  });

  test('filters keep order: wrong, skipped, all', () => {
    const rows = answerRows(questions, answers, null);
    assert.deepEqual(filterRows(rows, 'wrong').map((r) => r.q.index), [1, 4]);
    assert.deepEqual(filterRows(rows, 'skipped').map((r) => r.q.index), [2, 3]);
    assert.equal(filterRows(rows, 'all'), rows);
  });

  test('one topic only (names matched trimmed, any case), then filtered', () => {
    const rows = answerRows(questions, answers, { standard: '11th', chapter: ' kinematics', topic: 'RELATIVE velocity ' });
    assert.deepEqual(rows.map((r) => r.q.index), [1, 4]);
    assert.deepEqual(filterRows(rows, 'skipped'), []);
  });
});

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
    // The timer runs on while the student is away: the time left, rounded up to the minute.
    const now = Date.parse('2026-11-01T10:00:00Z');
    assert.equal(summaryLine({ ...base, state: 'in-progress', answeredCount: 1, deadline: '2026-11-01T10:17:20Z' }, now), 'Physics · In progress · 1 of 20 answered · 18 min left');
    assert.equal(summaryLine({ ...base, state: 'in-progress', answeredCount: 1, deadline: '2026-11-01T09:59:00Z' }, now), "Physics · In progress · 1 of 20 answered · Time's up");
    assert.equal(summaryLine({ ...base, state: 'in-progress', answeredCount: 1, deadline: null }, now), 'Physics · In progress · 1 of 20 answered');
    assert.equal(
      summaryLine({ ...base, state: 'submitted', result: { correct: 12, weakTopics: 2 } }),
      'Physics · 12/20 right · 2 weak topics'
    );
  });
});

describe('retakeSetup', () => {
  const from = { subject: 'Physics', questionCount: 30, durationMinutes: 60, negativeMarks: 1 };

  test('every weak topic, grouped by chapter, in the 30/30/40 Retake mix, same size, timed at exam pace', () => {
    const setup = retakeSetup(from, [
      { standard: '11th', chapter: 'Kinematics', topic: 'Projectile Motion' },
      { standard: '11th', chapter: 'Laws of Motion', topic: 'Friction' },
      { standard: '11th', chapter: 'Kinematics', topic: 'Relative Velocity' },
    ]);
    assert.deepEqual(setup, {
      subject: 'Physics',
      scope: [
        { standard: '11th', chapter: 'Kinematics', topics: ['Projectile Motion', 'Relative Velocity'] },
        { standard: '11th', chapter: 'Laws of Motion', topics: ['Friction'] },
      ],
      count: 30,
      mix: 'retake',
      durationMinutes: 60,
      negativeMarking: true,
    });
  });

  test('a chapter without named topics is taken whole; untimed and unmarked stay so; never under the minimum', () => {
    const setup = retakeSetup({ ...from, questionCount: 3, durationMinutes: null, negativeMarks: 0 }, [
      { standard: '12th', chapter: 'Optics', topic: 'Lenses' },
      { standard: '12th', chapter: 'Optics', topic: '' },
    ]);
    assert.deepEqual(setup.scope, [{ standard: '12th', chapter: 'Optics', topics: [] }]);
    assert.equal(setup.count, 5);
    assert.equal(setup.durationMinutes, null);
    assert.equal(setup.negativeMarking, false);
  });
});

describe('resultTree', () => {
  const chapters = [
    { standard: '11th', chapter: 'Kinematics', strength: 40 },
    { standard: '12th', chapter: 'Optics', strength: 70 },
    { standard: '11th', chapter: 'Optics', strength: 90 },
  ];
  test('puts each topic under its chapter, keeping both orders', () => {
    const tree = resultTree(chapters, [
      { standard: '11th', chapter: 'Kinematics', topic: 'Projectile Motion' },
      { standard: '12th', chapter: 'Optics', topic: 'Lenses' },
      { standard: '11th', chapter: 'kinematics ', topic: 'Relative Velocity' },
      { standard: '11th', chapter: 'Optics', topic: '' },
    ]);
    assert.deepEqual(
      tree.map((n) => [n.chapter.standard, n.chapter.chapter, n.topics.map((t) => t.topic)]),
      [
        ['11th', 'Kinematics', ['Projectile Motion', 'Relative Velocity']],
        ['12th', 'Optics', ['Lenses']],
        ['11th', 'Optics', ['']],
      ]
    );
  });
  test('a chapter with no topics in the result keeps an empty list', () => {
    assert.deepEqual(resultTree(chapters.slice(0, 1), []), [{ chapter: chapters[0], topics: [] }]);
  });
});

describe('quickSelection (Quick start defaults)', () => {
  const topic = (name, questions, coveredOn = null) => ({ topic: name, questions, coveredOn });
  const chapter = (standard, name, topics, extra = {}) => ({
    standard, chapter: name, mine: standard === '11th', coveredOn: null, topics,
    questions: topics.reduce((n, t) => n + t.questions, 0), ...extra,
  });

  test('picks every covered topic that has questions; a chapter fully covered becomes the whole chapter', () => {
    const chapters = [
      chapter('11th', 'Kinematics', [topic('Projectile', 10, '2026-11-01'), topic('Graphs', 5), topic('Empty', 0, '2026-11-02')]),
      chapter('11th', 'Laws of Motion', [topic('Friction', 8, '2026-11-03'), topic('Newton', 6, '2026-11-04')]),
      chapter('12th', 'Optics', [], { questions: 12, coveredOn: '2026-11-05' }),
    ];
    const { selection, basis } = quickSelection(chapters);
    assert.equal(basis, 'covered');
    assert.deepEqual(selection, { '11th|Kinematics': ['Projectile'], '11th|Laws of Motion': 'all', '12th|Optics': 'all' });
  });

  test("nothing covered yet: the student's own class, whole chapters with questions", () => {
    const chapters = [chapter('11th', 'Kinematics', [topic('Projectile', 10)]), chapter('11th', 'Units', [topic('SI', 0)]), chapter('12th', 'Optics', [topic('Lenses', 9)])];
    const { selection, basis } = quickSelection(chapters);
    assert.equal(basis, 'class');
    assert.deepEqual(selection, { '11th|Kinematics': 'all' });
  });

  test('nothing to pick: basis none, empty selection (Customise is offered)', () => {
    assert.deepEqual(quickSelection([chapter('12th', 'Optics', [topic('Lenses', 9)])]), { selection: {}, basis: 'none' });
    assert.deepEqual(quickSelection([]), { selection: {}, basis: 'none' });
  });
});

describe('poolLabel (which questions a practice test used)', async () => {
  const { poolLabel } = await import('../src/screens/student/self-assessment.ts');
  test('in students\' words; tests from older servers count as PYQs only', () => {
    assert.equal(poolLabel('all'), 'PYQs + syllabus questions');
    assert.equal(poolLabel('others'), 'Syllabus questions only');
    assert.equal(poolLabel('pyqs'), 'PYQs only');
    assert.equal(poolLabel(undefined), 'PYQs only');
  });
});

describe('Start practice: picked topics and the question window', async () => {
  const { scopeFromPicked, questionWindow, MAX_QUESTIONS, PER_TOPIC_MIN, PER_TOPIC_MAX } = await import('../src/screens/student/self-assessment.ts');
  test('5 to 15 questions per topic picked, never past the server limit of 150', () => {
    assert.deepEqual(questionWindow(1), { min: 5, max: 15 });
    assert.deepEqual(questionWindow(3), { min: 15, max: 45 });
    assert.deepEqual(questionWindow(10), { min: 50, max: 150 });
    assert.deepEqual(questionWindow(12), { min: 60, max: 150 }, 'any number of topics: the top stops at 150');
    assert.deepEqual(questionWindow(40), { min: 150, max: 150 });
    assert.equal(MAX_QUESTIONS, 150);
    assert.equal(PER_TOPIC_MIN, 5);
    assert.equal(PER_TOPIC_MAX, 15);
  });
  test('topics from several subjects become one scope entry per subject and chapter', () => {
    const scope = scopeFromPicked([
      { subject: 'Physics', standard: '11th', chapter: 'Kinematics', topic: 'Projectile Motion' },
      { subject: 'Physics', standard: '11th', chapter: 'Kinematics', topic: 'Relative Velocity' },
      { subject: 'Chemistry', standard: '11th', chapter: 'Mole Concept', topic: 'Mole Fraction' },
      { subject: 'Physics', standard: '11th', chapter: 'Kinematics', topic: 'Projectile Motion' },
    ]);
    assert.deepEqual(scope, [
      { subject: 'Physics', standard: '11th', chapter: 'Kinematics', topics: ['Projectile Motion', 'Relative Velocity'] },
      { subject: 'Chemistry', standard: '11th', chapter: 'Mole Concept', topics: ['Mole Fraction'] },
    ]);
  });
  test('a chapter without named topics goes whole (no topics listed)', () => {
    assert.deepEqual(scopeFromPicked([{ subject: 'Biology', standard: '12th', chapter: 'Evolution', topic: '' }]), [
      { subject: 'Biology', standard: '12th', chapter: 'Evolution', topics: [] },
    ]);
  });
});

describe('Start practice: chapters, then topics from those chapters', async () => {
  const { chaptersOfPicked, topicsInChapters, chapterKeyOf } = await import('../src/screens/student/self-assessment.ts');
  const t = (subject, chapter, topic, standard = '11th') => ({ subject, standard, chapter, topic });
  const picked = [t('Physics', 'Kinematics', 'Projectile'), t('Physics', 'Kinematics', 'Relative motion'), t('Chemistry', 'Mole concept', ''), t('Physics', 'Optics', 'Lenses', '12th')];
  test('chaptersOfPicked: each chapter once, in the order first picked', () => {
    assert.deepEqual(chaptersOfPicked(picked).map(chapterKeyOf), ['Physics|11th|Kinematics', 'Chemistry|11th|Mole concept', 'Physics|12th|Optics']);
    assert.deepEqual(chaptersOfPicked([]), []);
  });
  test('topicsInChapters: a chapter taken off takes its topics with it', () => {
    const left = topicsInChapters(picked, [{ subject: 'Physics', standard: '11th', chapter: 'Kinematics' }]);
    assert.deepEqual(left.map((p) => p.topic), ['Projectile', 'Relative motion']);
  });
  test('topicsInChapters: same chapter name in another subject or class does not count', () => {
    assert.deepEqual(topicsInChapters(picked, [{ subject: 'Physics', standard: '11th', chapter: 'Optics' }]), []);
    assert.deepEqual(topicsInChapters(picked, [{ subject: 'Mathematics', standard: '11th', chapter: 'Kinematics' }]), []);
  });
});

describe('readCount (a typed number of questions)', async () => {
  const { readCount } = await import('../src/screens/student/self-assessment.ts');
  test('a number inside the window for the topics is taken', () => {
    assert.deepEqual(readCount('20', 2), { count: 20, error: null });
    assert.deepEqual(readCount(' 10 ', 2), { count: 10, error: null });
    assert.deepEqual(readCount('30', 2), { count: 30, error: null });
    assert.deepEqual(readCount('5', 1), { count: 5, error: null });
    assert.deepEqual(readCount('150', 10), { count: 150, error: null });
  });
  test('outside the window: says the range', () => {
    assert.equal(readCount('9', 2).count, null);
    assert.equal(readCount('9', 2).error, 'Enter a number from 10 to 30 for 2 topics.');
    assert.equal(readCount('16', 1).error, 'Enter a number from 5 to 15 for 1 topic.');
    assert.equal(readCount('0', 1).count, null);
  });
  test('empty, decimals, signs and letters are not numbers', () => {
    assert.equal(readCount('', 2).error, 'Enter how many questions you want.');
    for (const t of ['12.5', '-12', '1e2', 'ten', '1 2']) assert.equal(readCount(t, 2).count, null, t);
  });
});

describe('test levels (Start practice)', async () => {
  const { TEST_LEVELS, levelSplitText, mixName, MIX_INFO } = await import('../src/screens/student/self-assessment.ts');
  test('easy 50/40/10, medium 40/40/20, challenging 30/40/30, each adding to 100', () => {
    assert.deepEqual(TEST_LEVELS.map((l) => [l.value, l.split.easy, l.split.medium, l.split.hard]), [
      ['easy', 50, 40, 10],
      ['medium', 40, 40, 20],
      ['challenging', 30, 40, 30],
    ]);
    for (const l of TEST_LEVELS) assert.equal(l.split.easy + l.split.medium + l.split.hard, 100, l.value);
  });
  test('labels', () => {
    assert.equal(levelSplitText(TEST_LEVELS[1].split), '40% easy · 40% medium · 20% hard');
    assert.equal(mixName('medium'), 'Medium level');
    assert.equal(mixName('challenging'), 'Challenging level');
    assert.equal(mixName('smart'), 'Smart mix');
    assert.equal(MIX_INFO.easy.text, '50% easy, 40% medium and 10% hard questions.');
  });
});
