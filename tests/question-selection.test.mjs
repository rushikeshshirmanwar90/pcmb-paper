import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { MAX_SELECTED, selectSubjects, selectedCount, selectedQuestions, selectionProblem } from '../src/screens/teacher/question-selection/model.ts';
import { EMPTY_BANK_SCOPE, bankBody } from '../src/screens/teacher/make-pdf/bank-scope.ts';
import { addQuestions, moveQuestion, removeQuestion, replaceQuestion } from '../src/screens/teacher/make-pdf/model.ts';

const base = { ...EMPTY_BANK_SCOPE, course: 'Competitive', exam: 'JEE', standard: '11th' };
const question = (id, subject = 'Physics') => ({ _id: id, subject, standard: '11th', chapter: 'Kinematics', topic: 'Velocity', answerType: 'MCQ', questionText: 'Find the velocity.', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctAnswer: 'A', source: 'JEE MAIN 2020', difficulty: 'Mid', explanation: '' });
describe('subject sessions', () => {
  test('new selections are empty: no numbers are pre-filled', () => {
    const sessions = selectSubjects([], ['Physics', 'Chemistry', 'Mathematics'], base);
    assert.deepEqual(sessions.map(s => s.subject), ['Physics', 'Chemistry', 'Mathematics']);
    assert.deepEqual(selectedQuestions(sessions), []);
    assert.equal(selectedCount(sessions), 0);
    for (const s of sessions) assert.equal('target' in s, false, 'a subject has no target');
  });
  test('subject switching/back/next and adding subjects preserve independent filters, allocations and questions', () => {
    const sessions = selectSubjects([], ['Physics', 'Chemistry'], base);
    sessions[0] = { ...sessions[0], scope: { ...sessions[0].scope, chapters: ['Kinematics'], sources: ['pyq'] }, questions: [question('p')] };
    const next = selectSubjects(sessions, ['Chemistry', 'Physics', 'Mathematics'], base);
    assert.equal(next[1], sessions[0]);
    assert.deepEqual(next[0].scope.chapters, []);
    assert.equal(next[1].questions[0]._id, 'p');
    assert.equal(selectedCount(next), 1);
  });
  test('manual picks survive random refill, retries, pagination and removal', () => {
    const manual = question('p1');
    let selected = addQuestions([manual], [question('p2'), question('p1')]).list;
    selected = addQuestions(selected, [question('p2'), question('p3')]).list;
    assert.equal(selected[0], manual);
    assert.deepEqual(selected.map(q => q._id), ['p1', 'p2', 'p3']);
    const session = { ...selectSubjects([], ['Physics'], base)[0], questions: selected };
    assert.equal(selectedCount([session]), 3);
    assert.equal(selectedCount([{ ...session, questions: removeQuestion(selected, 'p2') }]), 2);
  });
  test('preview data, replacement and reorder retain the chosen question metadata', () => {
    const list = [question('p1'), question('p2')];
    assert.equal(replaceQuestion(list, 'p1', list[1]), null);
    const replaced = replaceQuestion(list, 'p1', question('p3'));
    assert.equal(replaced[0].subject, 'Physics');
    assert.deepEqual(moveQuestion(replaced, 0, 1).map(q => q._id), ['p2', 'p3']);
  });
  test('any number of questions per subject is fine; a subject with none, too many in all, or a repeat is not', () => {
    assert.equal(selectionProblem([]), 'Select at least one subject.');
    const sessions = selectSubjects([], ['Physics', 'Chemistry'], base);
    assert.equal(selectionProblem(sessions), 'Choose questions for Physics, or take Physics off the subjects.');
    sessions[0].questions = [question('p1')];
    assert.match(selectionProblem(sessions), /Chemistry/);
    sessions[1].questions = [question('c1', 'Chemistry'), question('c2', 'Chemistry'), question('c3', 'Chemistry')];
    assert.equal(selectionProblem(sessions), null, '1 and 3: no targets to match');
    sessions[0].questions.push(question('c1'));
    assert.equal(selectionProblem(sessions), 'A question is selected more than once.');
    const many = Array.from({ length: MAX_SELECTED + 2 }, (_, i) => question(`m${i}`));
    assert.equal(selectionProblem([{ ...sessions[0], questions: many }]), `A test can have at most ${MAX_SELECTED} questions. Remove 2.`);
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
