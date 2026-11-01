// Phase 4: how test results are worded, filtered and grouped on the phone — durations, percentages,
// ranking filters and search, question views, topic groups and the student's own figures.
// The server decides every figure; these only check what is shown of them.
//   node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  OUTCOME_WORDS,
  RANK_FILTERS,
  RESULT_SECTIONS,
  durationLabel,
  extremes,
  filterCounts,
  filterNotAttempted,
  filterRankings,
  groupTopics,
  marksLabel,
  matchesName,
  namesLabel,
  notEnoughReason,
  numberLabel,
  percentLabel,
  questionCounts,
  questionHeading,
  questionsForView,
  rankingLine,
  rankingSpoken,
  resultFigures,
  scoreOfLabel,
  toneOfPercent,
  topicLine,
  weakEvidence,
} from '../src/screens/shared/result-format.ts';

const row = (rank, name, over = {}) => ({
  rank,
  student: { id: name, name },
  state: 'submitted',
  score: 10,
  maxScore: 20,
  percentage: 50,
  accuracy: 75,
  correct: 3,
  incorrect: 1,
  unanswered: 1,
  negativeDeducted: 1,
  timeTakenSeconds: 600,
  band: 'average',
  ...over,
});

describe('durations', () => {
  test('seconds below a minute, minutes and seconds, hours and minutes', () => {
    assert.equal(durationLabel(30), '30 sec');
    assert.equal(durationLabel(0), '0 sec');
    assert.equal(durationLabel(59.6), '1 min');
    assert.equal(durationLabel(60), '1 min');
    assert.equal(durationLabel(272), '4 min 32 sec');
    assert.equal(durationLabel(720), '12 min');
    assert.equal(durationLabel(3600), '1 h');
    assert.equal(durationLabel(3900), '1 h 5 min');
    assert.equal(durationLabel(7200 + 59), '2 h');
  });
  test('a 30-second attempt is never shown as 0 minutes, and bad input is 0 seconds', () => {
    assert.ok(!/^0 min/.test(durationLabel(30)));
    for (const bad of [-5, NaN, undefined, null, Infinity]) assert.equal(durationLabel(bad), '0 sec');
  });
});

describe('numbers', () => {
  test('percentages keep one decimal at most, with a real minus sign', () => {
    assert.equal(percentLabel(68), '68%');
    assert.equal(percentLabel(62.5), '62.5%');
    assert.equal(percentLabel(33.333), '33.3%');
    assert.equal(percentLabel(-10), '−10%');
    assert.equal(percentLabel(0), '0%');
    assert.equal(percentLabel(-0.04), '0%');
  });
  test('nothing to divide by shows a dash, never NaN', () => {
    for (const none of [null, undefined, NaN, Infinity]) {
      assert.equal(percentLabel(none), '–');
      assert.equal(numberLabel(none), '–');
    }
  });
  test('scores: negative, zero, fractional and perfect', () => {
    assert.equal(numberLabel(-2), '−2');
    assert.equal(numberLabel(0), '0');
    assert.equal(numberLabel(4.5), '4.5');
    assert.equal(numberLabel(0.1 + 0.2), '0.3');
    assert.equal(scoreOfLabel(20, 20), '20 / 20');
    assert.equal(scoreOfLabel(-2, 20), '−2 / 20');
    assert.equal(marksLabel(4), '+4');
    assert.equal(marksLabel(-1), '−1');
    assert.equal(marksLabel(0), '0');
  });
  test('the tone follows the 70% and 40% marks', () => {
    assert.deepEqual([70, 69.9, 40, 39.9, null].map(toneOfPercent), ['success', 'warning', 'warning', 'danger', 'neutral']);
  });
});

describe('ranking filters and search', () => {
  const rows = [
    row(1, 'Asha', { band: 'top', percentage: 100, score: 20 }),
    row(2, 'Ben'),
    row(2, 'Bina'),
    row(4, 'Chitra', { band: 'needs-improvement', percentage: -10, score: -2 }),
  ];
  const absent = [{ id: 'z', name: 'Zoya' }, { id: 'y', name: 'Yash' }];

  test('All shows every ranked student; Top and Needs Improvement their own bands', () => {
    assert.equal(filterRankings(rows, 'all').length, 4);
    assert.deepEqual(filterRankings(rows, 'top').map((r) => r.student.name), ['Asha']);
    assert.deepEqual(filterRankings(rows, 'needs-improvement').map((r) => r.student.name), ['Chitra']);
  });
  test('Not Attempted has no ranked rows: those students are listed apart and never ranked', () => {
    assert.deepEqual(filterRankings(rows, 'not-attempted'), []);
    assert.deepEqual(filterNotAttempted(absent).map((s) => s.name), ['Zoya', 'Yash']);
  });
  test('search ignores case and spaces, and works within a filter', () => {
    assert.deepEqual(filterRankings(rows, 'all', '  BI ').map((r) => r.student.name), ['Bina']);
    assert.deepEqual(filterRankings(rows, 'top', 'ben'), []);
    assert.deepEqual(filterNotAttempted(absent, 'yas').map((s) => s.name), ['Yash']);
    assert.equal(matchesName('Asha', ''), true);
    assert.equal(matchesName('Asha', 'xyz'), false);
  });
  test('chip counts', () => {
    assert.deepEqual(filterCounts({ rankings: rows, notAttempted: absent }), { all: 4, top: 1, 'needs-improvement': 1, 'not-attempted': 2 });
    assert.deepEqual(RANK_FILTERS, ['all', 'top', 'needs-improvement', 'not-attempted']);
  });
  test('highest and lowest: ties share a place, and a class that all scored the same has no "lowest"', () => {
    const e = extremes(rows);
    assert.deepEqual(e.highest.map((r) => r.student.name), ['Asha']);
    assert.deepEqual(e.lowest.map((r) => r.student.name), ['Chitra']);
    const same = extremes([row(1, 'A'), row(1, 'B')]);
    assert.equal(same.highest.length, 2);
    assert.deepEqual(same.lowest, []);
    assert.deepEqual(extremes([]), { highest: [], lowest: [] });
    assert.deepEqual(extremes([row(1, 'Only')]).lowest, []);
  });
  test('names read well in a sentence', () => {
    assert.equal(namesLabel([row(1, 'A')]), 'A');
    assert.equal(namesLabel([row(1, 'A'), row(1, 'B')]), 'A and B');
    assert.equal(namesLabel([row(1, 'A'), row(1, 'B'), row(1, 'C'), row(1, 'D')]), 'A, B and 2 more');
  });
  test('row text: no accuracy when nothing was answered; negative scores read out in full', () => {
    assert.equal(rankingLine(row(1, 'A', { percentage: 55, accuracy: 75, timeTakenSeconds: 30 })), '55% · 75% accuracy · 30 sec');
    assert.equal(rankingLine(row(1, 'A', { percentage: 0, accuracy: null })), '0% · no answers · 10 min');
    assert.equal(
      rankingSpoken(row(4, 'Chitra', { score: -2, percentage: -10, state: 'violation' }), 20),
      'Rank 4, Chitra, −2 out of 20, −10%, accuracy 75%, time 10 min, Violation'
    );
  });
});

describe('question views', () => {
  const stat = (index, over = {}) => ({ index, topic: '', chapter: '', correct: 0, incorrect: 0, unanswered: 0, ...over });
  const results = {
    questions: [stat(0, { topic: 'Electric Field' }), stat(1, { chapter: 'Magnetism' }), stat(2)],
    highlights: { mostCorrect: [2, 0], mostIncorrect: [1], mostSkipped: [] },
  };
  test('All lists the questions in test order; the others follow the server\'s order', () => {
    assert.deepEqual(questionsForView(results, 'all').map((q) => q.index), [0, 1, 2]);
    assert.deepEqual(questionsForView(results, 'mostCorrect').map((q) => q.index), [2, 0]);
    assert.deepEqual(questionsForView(results, 'mostSkipped'), []);
  });
  test('headings and counts', () => {
    assert.equal(questionHeading(results.questions[0]), 'Question 1 — Electric Field');
    assert.equal(questionHeading(results.questions[1]), 'Question 2 — Magnetism');
    assert.equal(questionHeading(results.questions[2]), 'Question 3');
    assert.equal(questionCounts({ correct: 12, incorrect: 18, unanswered: 5 }), 'Correct: 12 · Incorrect: 18 · Unanswered: 5');
  });
  test('the four outcomes have words and tones', () => {
    assert.deepEqual(Object.keys(OUTCOME_WORDS), ['correct', 'incorrect', 'unanswered', 'unmarked']);
    assert.equal(OUTCOME_WORDS.incorrect.tone, 'danger');
  });
});

describe('topics', () => {
  const topic = (over) => ({ subject: 'Physics', chapter: 'C', topic: 'T', label: 'T', classified: true, questions: 2, attempted: 8, correct: 6, marks: 22, maxMarks: 32, ...over });
  test('grouped by subject in the server\'s order, with unclassified questions apart', () => {
    const groups = groupTopics([
      topic({ label: 'A' }),
      topic({ subject: 'Chemistry', label: 'B' }),
      topic({ label: 'C' }),
      topic({ subject: '', label: 'Other', classified: false }),
      topic({ subject: '', label: 'No subject' }),
    ]);
    assert.deepEqual(groups.map((g) => [g.title, g.topics.map((t) => t.label)]), [
      ['Physics', ['A', 'C']],
      ['Chemistry', ['B']],
      ['Unclassified', ['Other']],
      ['Other', ['No subject']],
    ]);
  });
  test('lines state the denominators; a topic nobody answered says so', () => {
    assert.equal(topicLine(topic({})), '6 of 8 answered correct · 22 of 32 marks');
    assert.equal(topicLine(topic({ attempted: 0, questions: 1 })), 'Nothing answered · 1 question');
    assert.equal(weakEvidence({ accuracy: 38.5, correct: 5, attempted: 13 }), 'Accuracy: 38.5% · Correct: 5/13 attempted');
  });
  test('the minimum-sample rule is explained, for a batch and for one student', () => {
    assert.match(notEnoughReason('batch'), /2 of its questions.*5 answers/);
    assert.match(notEnoughReason('student'), /2 of its questions.*2 answers/);
  });
});

describe("a student's own result", () => {
  const exam = { marksPerQuestion: 4, negativeMarks: 1, durationMinutes: 60 };
  const result = { score: 11, maxScore: 20, correct: 3, wrong: 1, skipped: 1, timeTakenSeconds: 30 };

  test('the server\'s analytics are used when they came, with the rank as "n of m"', () => {
    const f = resultFigures(exam, result, { rank: 2, ranked: 4, percentage: 55, accuracy: 75, negativeDeducted: 1 });
    assert.deepEqual(f, { percentage: 55, accuracy: 75, negativeDeducted: 1, rank: '2 of 4', time: '30 sec of 60 min' });
  });
  test('an older server sends only counts: the same figures are worked out, with no rank', () => {
    const f = resultFigures(exam, result, null);
    assert.deepEqual(f, { percentage: 55, accuracy: 75, negativeDeducted: 1, rank: null, time: '30 sec of 60 min' });
  });
  test('negative, zero and unanswered results stay finite', () => {
    assert.equal(resultFigures(exam, { ...result, score: -3, correct: 0, wrong: 3, skipped: 2 }, undefined).percentage, -15);
    const none = resultFigures(exam, { ...result, score: 0, correct: 0, wrong: 0, skipped: 5 }, undefined);
    assert.deepEqual([none.percentage, none.accuracy, none.negativeDeducted], [0, null, 0]);
    assert.equal(resultFigures(exam, { ...result, maxScore: 0 }, undefined).percentage, null);
  });
  test('the three sections of the result screen', () => {
    assert.deepEqual(RESULT_SECTIONS.map((s) => s.label), ['Overview', 'Question Review', 'Topic Performance']);
  });
});
