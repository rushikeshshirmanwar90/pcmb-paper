// Full-screen Create Test: what batches mean for the test, the draft that the two
// pages share, and the routes that hold them.
//   node --experimental-strip-types --test tests/create-test-flow.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { deriveScope, isDerived, scopeId, uniqueLabels } from '../src/screens/teacher/create-test/scope.ts';

const batch = (id, over = {}) => ({ id, name: id, program: 'JEE', standard: '12th', subjects: ['Physics', 'Chemistry', 'Mathematics'], questionBank: 'JEE', ...over });
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('batches decide the test scope', () => {
  test('nothing chosen derives nothing', () => assert.equal(deriveScope([]), null));

  test('two JEE 12th batches share Competitive / JEE / Class 12 and its subjects', () => {
    const d = deriveScope([batch('a'), batch('b')]);
    assert.ok(isDerived(d));
    assert.equal(d.label, 'Competitive / JEE / Class 12');
    assert.deepEqual(d.subjects, ['Physics', 'Chemistry', 'Mathematics']);
  });

  test('NEET offers Biology, not Mathematics', () => {
    const d = deriveScope([batch('n', { program: 'NEET', questionBank: 'NEET', subjects: ['Physics', 'Chemistry', 'Biology'] })]);
    assert.ok(isDerived(d));
    assert.deepEqual(d.subjects, ['Physics', 'Chemistry', 'Biology']);
  });

  test('subjects are those every chosen batch has', () => {
    const d = deriveScope([batch('a'), batch('b', { subjects: ['Physics'] })]);
    assert.ok(isDerived(d));
    assert.deepEqual(d.subjects, ['Physics']);
  });

  test('different exams or classes are rejected clearly', () => {
    assert.match(deriveScope([batch('a'), batch('n', { questionBank: 'NEET', program: 'NEET' })]).error, /can't share one test/);
    assert.match(deriveScope([batch('a'), batch('b', { standard: '11th' })]).error, /can't share one test/);
  });

  test('a program with no question bank never borrows JEE/NEET questions', () => {
    const d = deriveScope([batch('h', { program: 'HSC_SCIENCE', questionBank: null })]);
    assert.match(d.error, /no question bank/);
    assert.equal(isDerived(d), false);
  });

  test('changing the exam, class or subject changes the scope id; same choices keep it', () => {
    const jee = deriveScope([batch('a')]);
    assert.equal(scopeId(jee, 'Physics'), scopeId(deriveScope([batch('a'), batch('b')]), 'Physics'));
    assert.notEqual(scopeId(jee, 'Physics'), scopeId(jee, 'Chemistry'));
    assert.notEqual(scopeId(jee, 'Physics'), scopeId(deriveScope([batch('c', { standard: '11th' })]), 'Physics'));
  });

  test('duplicate names get a suffix so the dropdown can tell them apart', () => {
    const labels = uniqueLabels([{ id: 'x1111', name: 'A' }, { id: 'x2222', name: 'A' }, { id: 'y', name: 'B' }]);
    assert.notEqual(labels[0].label, labels[1].label);
    assert.equal(labels[2].label, 'B');
  });
});

describe('two full-screen routes share one draft', () => {
  test('both pages are routes under one layout that owns the draft', () => {
    for (const file of ['_layout.tsx', 'index.tsx', 'setup.tsx']) assert.ok(existsSync(new URL(`../src/app/create-test/${file}`, import.meta.url)), file);
    assert.match(read('src/app/create-test/_layout.tsx'), /CreateTestProvider/);
    assert.match(read('src/app/create-test/index.tsx'), /DetailsScreen/);
    assert.match(read('src/app/create-test/setup.tsx'), /SetupScreen/);
  });

  test('Create Test navigates to the page; it is no longer a sheet', () => {
    const tests = read('src/screens/teacher/teacher-tests.tsx');
    assert.match(tests, /router\.push\('\/create-test'/);
    assert.doesNotMatch(tests, /setWizard\(\{ kind: 'new' \}\)/);
  });

  test('headers, Next, Back and the discard confirmation are wired', () => {
    const one = read('src/screens/teacher/create-test/details-screen.tsx');
    const two = read('src/screens/teacher/create-test/setup-screen.tsx');
    assert.match(one, /Create Test \(1 of 2\)/);
    assert.match(two, /Test Setup \(2 of 2\)/);
    assert.match(one, /router\.push\('\/create-test\/setup'/);
    assert.match(two, /router\.back\(\)/);
    // Leaving the flow (Back on page 1, Close on page 2) asks first; Discard repeats the blocked action.
    const draft = read('src/screens/teacher/create-test/draft.tsx');
    assert.match(draft, /usePreventRemove\(dirty && !discarded/);
    assert.match(draft, /repeat\(\)/);
    assert.doesNotMatch(draft + one, /dispatch\(data\.action\)/, 'redispatching while the guard is on blocks itself');
    assert.match(read('src/app/create-test/_layout.tsx'), /<CreateTestLeaveGuard>/);
    assert.match(one, /onBack=\{leave\}/);
    assert.match(two, /onClose=\{leave\}/);
  });

  test('questions travel in the draft, not in the URL', () => {
    assert.doesNotMatch(read('src/screens/teacher/create-test/details-screen.tsx'), /params:|searchParams|JSON\.stringify\(draft/);
  });

  test('multi-selects apply on Done and show a count', () => {
    for (const file of ['details-screen.tsx', 'setup-screen.tsx', 'question-picker.tsx']) {
      const source = read(`src/screens/teacher/create-test/${file}`);
      assert.equal((source.match(/<MultiSelectDropdown/g) ?? []).length, (source.match(/applyOnDone/g) ?? []).length, file);
      assert.match(source, /selectedLabel/);
    }
  });
});
