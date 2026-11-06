// The one-page Make PDF form's rules (what a choice does to the ones after it,
// which picked questions may stay) and its compatibility with the existing PDF
// flow's pure model.
//   node --experimental-strip-types --test tests/make-pdf-one-page.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  bankBody,
  bankMissing,
  bankReady,
  EMPTY_BANK_SCOPE,
  hasPyqs,
  keepSelected,
  subjectsOf,
  withChapters,
  withClass,
  withCourse,
  withExam,
  withSource,
  withSubject,
} from '../src/screens/teacher/make-pdf/bank-scope.ts';
import { addQuestions, removeQuestion, standardsOf } from '../src/screens/teacher/make-pdf/model.ts';

const foundation = (standard, subject) => withSubject(withClass(withCourse(EMPTY_BANK_SCOPE, 'Foundation'), standard), subject);
const competitive = (exam, subject, standard = '11th') => withSubject(withExam(withClass(withCourse(EMPTY_BANK_SCOPE, 'Competitive'), standard), exam), subject);

describe('course, class, exam and subject', () => {
  test('Foundation 9th/10th Mathematics and Science, no exam, no Physics split', () => {
    for (const [standard, subject] of [['9th', 'Mathematics'], ['9th', 'Science'], ['10th', 'Mathematics'], ['10th', 'Science']]) {
      const scope = foundation(standard, subject);
      assert.ok(bankReady(scope));
      assert.equal(scope.exam, '');
      assert.deepEqual(subjectsOf(scope), ['Mathematics', 'Science']);
      const body = bankBody(scope);
      assert.equal(body.course, 'Foundation');
      assert.equal(body.exam, undefined);
      assert.deepEqual(body.years, []);
    }
    assert.equal(hasPyqs(foundation('9th', 'Science')), false);
  });

  test('JEE and NEET subjects are filtered', () => {
    assert.deepEqual(subjectsOf(competitive('JEE', 'Physics')), ['Physics', 'Chemistry', 'Mathematics']);
    assert.deepEqual(subjectsOf(competitive('NEET', 'Physics')), ['Physics', 'Chemistry', 'Biology']);
    assert.equal(bankMissing(withClass(withCourse(EMPTY_BANK_SCOPE, 'Competitive'), '12th')), 'Choose an exam.');
  });

  test('changing a parent clears only the choices that no longer fit', () => {
    let scope = competitive('JEE', 'Mathematics');
    scope = { ...scope, chapters: ['Limits'], topics: ['L1'] };
    const neet = withExam(scope, 'NEET');
    assert.equal(neet.subject, '', 'Mathematics is not a NEET subject');
    assert.deepEqual([neet.chapters, neet.topics], [[], []]);
    const physics = withExam({ ...competitive('JEE', 'Physics'), chapters: ['Optics'] }, 'NEET');
    assert.equal(physics.subject, 'Physics', 'Physics is in both exams');
    assert.deepEqual(physics.chapters, []);
    assert.equal(withCourse(scope, 'Foundation').exam, '');
    assert.equal(withCourse(scope, 'Foundation').subject, '');
    assert.equal(withCourse(scope, 'Competitive'), scope, 'the same course changes nothing');
    const pyq = withSource({ ...scope, years: ['2020'] }, 'pyq');
    assert.deepEqual(pyq.years, []);
    assert.equal(bankBody(withSource(scope, 'regular')).source, 'regular');
  });

  test('chapters take their topics with them', () => {
    const topics = [{ chapter: 'Optics', name: 'Lenses' }, { chapter: 'Kinematics', name: 'Velocity' }];
    const scope = { ...competitive('JEE', 'Physics'), chapters: ['Optics', 'Kinematics'], topics: ['lenses', 'Velocity'] };
    const next = withChapters(scope, ['Kinematics'], topics);
    assert.deepEqual(next.topics, ['Velocity']);
  });
});

describe('picked questions after a change', () => {
  const picked = (id, chapter, topic, source = '') => ({ _id: id, standard: '11th', subject: 'Physics', chapter, topic, source });
  const questions = [picked('a', 'Optics', 'Lenses', 'JEE MAIN 2020'), picked('b', 'Kinematics', 'Velocity', 'JEE MAIN 2021')];

  test('narrower chapters, topics or years drop only what falls outside', () => {
    const before = { ...competitive('JEE', 'Physics'), source: 'pyq' };
    assert.deepEqual(keepSelected(questions, before, { ...before, chapters: ['optics'] }).map((q) => q._id), ['a']);
    assert.deepEqual(keepSelected(questions, before, { ...before, topics: ['Velocity'] }).map((q) => q._id), ['b']);
    assert.deepEqual(keepSelected(questions, before, { ...before, years: ['2021'] }).map((q) => q._id), ['b']);
    assert.equal(keepSelected(questions, before, before).length, 2);
  });

  test('another course, class, exam, subject or source drops all', () => {
    const before = competitive('JEE', 'Physics');
    for (const after of [withExam(before, 'NEET'), withClass(before, '12th'), withSource(before, 'pyq'), withSubject(before, 'Chemistry'), withCourse(before, 'Foundation')]) {
      assert.deepEqual(keepSelected(questions, before, after), []);
    }
  });
});

describe('manual and random selection plus existing PDF compatibility', () => {
  test('manual selection never holds a question twice and removal works', () => {
    const one = { _id: 'a' };
    const list = addQuestions([], [one, one, { _id: 'b' }]);
    assert.equal(list.list.length, 2);
    assert.equal(list.duplicates, 1);
    assert.deepEqual(removeQuestion(list.list, 'a').map((q) => q._id), ['b']);
  });

  test('random picks of the server go through the same list rules, within the 300 limit', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ _id: String(i) }));
    assert.equal(addQuestions([], many, 3).list.length, 3);
  });

  test('the PDF title and class derive from the questions, as before', () => {
    assert.equal(standardsOf([{ standard: '10th' }, { standard: '9th' }]), '9th, 10th');
  });

  test('the flow keeps the existing PDF generation and settings screens', () => {
    const flow = readFileSync(new URL('../src/screens/teacher/make-pdf/flow.tsx', import.meta.url), 'utf8');
    for (const used of ['createPdfsFor', 'ExamSettingsStep', 'SmartPdfScreen', 'DoneStep', 'MARKS_PER_QUESTION']) assert.ok(flow.includes(used), used);
    const screen = readFileSync(new URL('../src/screens/teacher/make-pdf/one-page.tsx', import.meta.url), 'utf8');
    for (const used of ['MultiSelectDropdown', 'verifyBankQuestions', 'fetchBankRandom', 'fetchBankPage']) assert.ok(screen.includes(used), used);
    assert.ok(!screen.includes('setStep'), 'selection is one screen, with no steps of its own');
  });
});
