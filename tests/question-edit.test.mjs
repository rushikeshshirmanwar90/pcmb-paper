import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyEdit, draftOf, editProblem, isChanged, keepEdits } from '../src/screens/teacher/question-selection/question-edit.ts';

const mcq = (over = {}) => ({ _id: 'q1', subject: 'Physics', standard: '11th', chapter: 'Kinematics', topic: 'Velocity', answerType: 'MCQ', questionText: 'Find the velocity.', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctAnswer: 'A', difficulty: 'Medium', explanation: 'Because.', ...over });

describe('editing a question for one paper or test', () => {
  test('an untouched draft changes nothing and is not marked edited', () => {
    const q = mcq();
    assert.equal(isChanged(q, draftOf(q)), false);
    assert.equal(applyEdit(q, draftOf(q)), q);
  });
  test('text, options and answer are applied, trimmed, and the copy is marked edited', () => {
    const q = mcq();
    const edited = applyEdit(q, { ...draftOf(q), questionText: '  Find the speed. ', optionB: ' 20 ', correctAnswer: 'b' });
    assert.equal(edited.questionText, 'Find the speed.');
    assert.equal(edited.optionB, '20');
    assert.equal(edited.correctAnswer, 'B');
    assert.equal(edited.edited, true);
    assert.equal(edited.explanation, 'Because.', 'fields the editor does not show are kept');
    assert.equal(q.questionText, 'Find the velocity.', 'the original is not modified');
  });
  test('problems a teacher can fix are named', () => {
    const q = mcq();
    assert.equal(editProblem(q, { ...draftOf(q), questionText: '   ' }), 'Enter the question text.');
    assert.equal(editProblem(q, { ...draftOf(q), correctAnswer: '' }), 'Choose the correct option.');
    assert.match(editProblem(q, { ...draftOf(q), optionC: '', correctAnswer: 'C' }), /Option C is empty/);
    assert.equal(editProblem(q, { ...draftOf(q), optionA: '', optionB: '', optionC: '' }), 'Give at least two options.');
    assert.equal(editProblem(q, draftOf(q)), null);
  });
  test('an option made only of a figure still counts as filled', () => {
    const q = mcq({ optionD: '', optionDiagramUrls: { D: ['https://x/d.png'] } });
    assert.equal(editProblem(q, { ...draftOf(q), correctAnswer: 'D' }), null);
  });
  test('a numerical question needs an answer, not options', () => {
    const q = mcq({ answerType: 'Numerical', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: '12' });
    assert.equal(editProblem(q, draftOf(q)), null);
    assert.equal(editProblem(q, { ...draftOf(q), correctAnswer: ' ' }), 'Enter the correct answer.');
    assert.equal(applyEdit(q, { ...draftOf(q), correctAnswer: ' 12.5 ' }).correctAnswer, '12.5');
  });
  test('a multi-answer key is kept unless the teacher changes it', () => {
    const q = mcq({ correctAnswer: 'A,C' });
    assert.equal(editProblem(q, draftOf(q)), null);
    assert.equal(applyEdit(q, { ...draftOf(q), questionText: 'New' }).correctAnswer, 'A,C');
  });
  test('checking questions against the bank never undoes an edit', () => {
    const edited = applyEdit(mcq(), { ...draftOf(mcq()), optionA: 'changed' });
    const fresh = [mcq(), mcq({ _id: 'q2' })];
    const kept = keepEdits(fresh, [edited, mcq({ _id: 'q2' })]);
    assert.equal(kept[0].optionA, 'changed');
    assert.equal(kept[0].edited, true);
    assert.equal(kept[1].edited, undefined);
    assert.deepEqual(kept.map(q => q._id), ['q1', 'q2'], 'order is the bank\'s answer order');
  });
});
