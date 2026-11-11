import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { equalTargets, remaining, selectSubjects, selectedQuestions, selectionProblem } from '../src/screens/teacher/question-selection/model.ts';
import { EMPTY_BANK_SCOPE, bankBody } from '../src/screens/teacher/make-pdf/bank-scope.ts';
import { addQuestions, moveQuestion, removeQuestion, replaceQuestion } from '../src/screens/teacher/make-pdf/model.ts';

const base = { ...EMPTY_BANK_SCOPE, course: 'Competitive', exam: 'JEE', standard: '11th' };
const question = (id, subject = 'Physics') => ({ _id: id, subject, standard: '11th', chapter: 'Kinematics', topic: 'Velocity', answerType: 'MCQ', questionText: 'Find the velocity.', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctAnswer: 'A', source: 'JEE MAIN 2020', difficulty: 'Mid', explanation: '' });
describe('subject sessions', () => {
  test('new selections are empty and equal targets preserve the total and remainder', () => {
    const sessions = selectSubjects([], ['Physics', 'Chemistry', 'Mathematics'], base, 76);
    assert.deepEqual(sessions.map(s => s.target), [26, 25, 25]);
    assert.deepEqual(selectedQuestions(sessions), []);
    assert.deepEqual(equalTargets(1, ['Physics', 'Chemistry']), [1, 0]);
  });
  test('subject switching/back/next and adding subjects preserve independent filters, allocations and questions', () => {
    const sessions = selectSubjects([], ['Physics', 'Chemistry'], base, 4);
    sessions[0] = { ...sessions[0], target: 3, scope: { ...sessions[0].scope, chapters: ['Kinematics'], sources: ['pyq'] }, questions: [question('p')] };
    const next = selectSubjects(sessions, ['Chemistry', 'Physics', 'Mathematics'], base, 6);
    assert.equal(next[1], sessions[0]);
    assert.deepEqual(next[0].scope.chapters, []);
    assert.equal(next[1].questions[0]._id, 'p');
    assert.equal(next[1].target, 3);
  });
  test('manual picks survive random refill, retries, pagination and removal', () => {
    const manual = question('p1');
    let selected = addQuestions([manual], [question('p2'), question('p1')]).list;
    selected = addQuestions(selected, [question('p2'), question('p3')]).list;
    assert.equal(selected[0], manual);
    assert.deepEqual(selected.map(q => q._id), ['p1', 'p2', 'p3']);
    const session = { ...selectSubjects([], ['Physics'], base, 4)[0], questions: selected };
    assert.equal(remaining(session), 1);
    assert.equal(remaining({ ...session, questions: removeQuestion(selected, 'p2') }), 2);
  });
  test('preview data, replacement and reorder retain the chosen question metadata', () => {
    const list = [question('p1'), question('p2')];
    assert.equal(replaceQuestion(list, 'p1', list[1]), null);
    const replaced = replaceQuestion(list, 'p1', question('p3'));
    assert.equal(replaced[0].subject, 'Physics');
    assert.deepEqual(moveQuestion(replaced, 0, 1).map(q => q._id), ['p2', 'p3']);
  });
  test('shortages and excess picks require targets to be resolved; single subject remains supported', () => {
    const sessions = selectSubjects([], ['Physics'], base, 1);
    assert.match(selectionProblem(sessions), /0\/1/);
    sessions[0].questions = [question('p1')];
    assert.equal(selectionProblem(sessions), null);
    sessions[0].questions.push(question('p2'));
    assert.match(selectionProblem(sessions), /2\/1/);
  });
  test('sources use the existing scalar or array selector without changing source text', () => {
    assert.equal(bankBody({ ...base, subject: 'Physics' }).source, 'regular');
    assert.deepEqual(bankBody({ ...base, subject: 'Physics', sources: ['regular', 'pyq'], years: ['2020'] }).source, ['regular', 'pyq']);
    assert.deepEqual(bankBody({ ...base, subject: 'Physics', sources: ['regular', 'pyq'], years: ['2020'] }).years, []);
  });
  test('both entry points use the shared virtualized dropdown browser, without subject chips or automatic picking', () => {
    const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    const shared = read('src/screens/teacher/question-selection/subject-selector.tsx');
    assert.match(shared, /showSelectedChips=\{false\}/);
    assert.match(shared, /<FlatList/);
    assert.match(shared, /onEndReached/);
    assert.match(shared, /slice\(-200\)/);
    assert.match(shared, /randomBusy\.current/);
    for (const p of ['src/screens/teacher/create-test/details-screen.tsx', 'src/screens/teacher/make-pdf/one-page.tsx']) assert.match(read(p), /<SubjectSelector/);
    assert.doesNotMatch(read('src/screens/teacher/make-pdf/one-page.tsx'), /fetchBankRandom/);
  });
});
