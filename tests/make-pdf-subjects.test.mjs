// Make PDF subject selection: one searchable subject dropdown (no Automatic/Manual),
// the PDF's subjects derived from the picked questions, a confirmation before
// questions are removed with their subject, and a read-only review.
//   node --experimental-strip-types --test tests/make-pdf-subjects.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, test } from 'node:test';
import ts from 'typescript';
import { deriveSubjects, subjectCounts, subjectHeader } from '../src/screens/teacher/make-pdf/pdf-subjects.ts';
import * as selection from '../src/screens/teacher/question-selection/model.ts';
import { EMPTY_BANK_SCOPE } from '../src/screens/teacher/make-pdf/bank-scope.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = { ...EMPTY_BANK_SCOPE, course: 'Competitive', exam: 'JEE', standard: '12th', subject: 'Physics' };
const q = (subject, id) => ({ _id: `${subject}-${id}`, subject });
const set = [q('Physics', 1), q('Physics', 2), q('Chemistry', 1), q('Mathematics', 1), q('chemistry', 2)];

describe('subjects of the picked questions', () => {
  test('first-appearance order with counts; one, two, three or more subjects', () => {
    assert.deepEqual(subjectCounts(set), [{ subject: 'Physics', count: 2 }, { subject: 'Chemistry', count: 2 }, { subject: 'Mathematics', count: 1 }]);
    assert.deepEqual(deriveSubjects([q('Biology', 1)]), ['Biology']);
    assert.deepEqual(deriveSubjects([q('Maths', 1), q('Science', 1)]), ['Maths', 'Science']);
    assert.deepEqual(deriveSubjects([{ subject: '' }, {}]), []);
  });

  test('the old Automatic/Manual machinery is gone from the model', async () => {
    const model = await import('../src/screens/teacher/make-pdf/pdf-subjects.ts');
    for (const gone of ['resolveSubjects', 'includeExcluded', 'conflictMessage']) assert.ok(!(gone in model), gone);
  });

  test('the header text fits the 80-character server limit and keeps order', () => {
    assert.equal(subjectHeader(['Physics', 'Chemistry']), 'Physics, Chemistry');
    const many = Array.from({ length: 12 }, (_, i) => `Subject number ${i}`);
    const text = subjectHeader(many);
    assert.ok(text.length <= 80);
    assert.match(text, /^Subject number 0, Subject number 1.* more$/);
  });

  test('the PDF subjects follow the teacher\'s subject order and each subject\'s question order', () => {
    const sessions = selection.selectSubjects([], ['Chemistry', 'Physics', 'Mathematics'], base, 6)
      .map((s, i) => ({ ...s, questions: [q(s.subject, 2), q(s.subject, 1)].slice(0, i === 2 ? 1 : 2) }));
    const picked = selection.selectedQuestions(sessions);
    assert.deepEqual(picked.map(x => x._id), ['Chemistry-2', 'Chemistry-1', 'Physics-2', 'Physics-1', 'Mathematics-2']);
    assert.equal(subjectHeader(deriveSubjects(picked)), 'Chemistry, Physics, Mathematics');
    // Reordering one subject's questions changes only that subject's order.
    const reordered = sessions.map(s => s.subject === 'Physics' ? { ...s, questions: [...s.questions].reverse() } : s);
    assert.deepEqual(selection.selectedQuestions(reordered).map(x => x._id), ['Chemistry-2', 'Chemistry-1', 'Physics-1', 'Physics-2', 'Mathematics-2']);
    assert.equal(subjectHeader(deriveSubjects(selection.selectedQuestions(reordered))), 'Chemistry, Physics, Mathematics');
  });
});

describe('Make PDF screens', () => {
  const page = read('src/screens/teacher/make-pdf/one-page.tsx');
  const flow = read('src/screens/teacher/make-pdf/flow.tsx');
  const selector = read('src/screens/teacher/question-selection/subject-selector.tsx');

  test('no Automatic/Manual toggle, explanation or leftover state remains', () => {
    for (const source of [page, flow]) assert.doesNotMatch(source, /Automatic|Manual|subjectMode|SubjectMode|onSubjectMode|resolveSubjects|conflictMessage|includeExcluded/);
  });

  test('exactly one subject dropdown, labelled "Select Subjects", searchable, from the shared selector', () => {
    assert.equal((page.match(/<SubjectSelector/g) ?? []).length, 1);
    assert.match(page, /label="Select Subjects" searchable/);
    assert.equal((selector.match(/<MultiSelectDropdown label=\{label\}/g) ?? []).length, 1);
    assert.match(selector, /showSelectedChips=\{false\}/);
    assert.doesNotMatch(page, /<MultiSelectDropdown/, 'no second subject dropdown on the Make PDF screen');
  });

  test('the request still carries the questions in order and the subject header; the settings steps do not ask for subjects', () => {
    assert.match(flow, /subjectHeader\(deriveSubjects\(selected\)\)/);
    assert.match(flow, /questions: selected,[\s\S]*subject,/);
    assert.match(flow, /<SubjectReview questions=\{selected\} onEdit=\{back\}/);
    for (const file of ['exam-settings.tsx', '../../../components/smart-pdf-screen.tsx']) assert.doesNotMatch(read('src/screens/teacher/make-pdf/' + file), /MultiSelectDropdown|SubjectSelector/);
  });
});

// A small React harness (no native renderer): exercises the actual TSX handlers.
function harness(path, mocks = {}) {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const react = {
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo: f => f(),
    useEffect: f => { effects.push(f); },
  };
  const names = list => Object.fromEntries(list.map(n => [n, n]));
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ...names(['ActivityIndicator', 'FlatList', 'Modal', 'Pressable', 'Text', 'View']), StyleSheet: { create: s => s } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    '@/hooks/use-cache-keys': { useCacheKeys: () => ({ bankOptions: (k) => `bank-options:${k}`, testBatches: 'test-batches' }) },
    '@/components/kit': { usePalette: () => ({}), useLoad: () => ({ data: null }), ...names(['Button', 'DetailSheet', 'ErrorView', 'Field', 'Icon', 'Muted', 'Notice']) },
    '@/components/explanation': {}, '@/components/diagrams': {}, '@/components/dropdown-select': { DropdownSelect: 'DropdownSelect' },
    '@/components/multi-select-dropdown': { MultiSelectDropdown: 'MultiSelectDropdown' },
    '@/components/keyboard-safe-view': { KeyboardSafeView: 'KeyboardSafeView' },
    '@/services/pdf-questions': {}, '@/screens/teacher/make-pdf/bank-scope': {}, '@/screens/teacher/make-pdf/model': {},
    '@/screens/teacher/make-pdf/question-preview': {}, '@/screens/teacher/make-pdf/ui': { CountField: 'CountField' },
    './action-menu': {}, './reorder-list': {}, './question-card': {}, './model': selection, './pdf-subjects': { subjectCounts }, ...mocks,
  };
  const req = createRequire(import.meta.url);
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports, require: id => id in dependencies ? dependencies[id] : req(id), setTimeout, clearTimeout });
  return { exports, render: (component, props) => { cursor = 0; const tree = component(props); effects.splice(0).forEach(f => f()); return tree; } };
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const find = (tree, type, predicate = () => true) => nodes(tree).find(n => n.type === type && predicate(n.props));
const texts = tree => nodes(tree).filter(n => n.type === 'Text').map(n => [n.props.children].flat(Infinity).join(''));

describe('removing a subject', () => {
  const picks = (subject, n) => Array.from({ length: n }, (_, i) => q(subject, i + 1));
  const sessions = () => selection.selectSubjects([], ['Physics', 'Chemistry', 'Mathematics'], base, 9).map((s, i) => ({ ...s, questions: picks(s.subject, [3, 2, 0][i]) }));

  function setup(current) {
    const confirms = [];
    const changes = [];
    const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', { '@/components/confirm-action': { confirmAction: (...args) => confirms.push(args) } });
    const tree = h.render(h.exports.SubjectSelector, { sessions: current, onChange: next => changes.push(next), subjects: ['Physics', 'Chemistry', 'Mathematics'], base, total: 9, label: 'Select Subjects', searchable: true });
    const dropdown = find(tree, 'MultiSelectDropdown');
    return { confirms, changes, dropdown };
  }

  test('one dropdown, labelled and searchable, lists the three subjects', () => {
    const { dropdown } = setup(sessions());
    assert.equal(dropdown.props.label, 'Select Subjects');
    assert.equal(dropdown.props.searchable, true);
    assert.deepEqual(dropdown.props.options, ['Physics', 'Chemistry', 'Mathematics']);
    assert.deepEqual(dropdown.props.selected, ['Physics', 'Chemistry', 'Mathematics']);
    assert.equal(dropdown.props.showSelectedChips, false);
  });

  test('adding subjects needs no confirmation and starts each empty, with no numbers pre-filled; one, two and three subjects work', () => {
    for (const names of [['Physics'], ['Physics', 'Chemistry'], ['Physics', 'Chemistry', 'Mathematics']]) {
      const { confirms, changes, dropdown } = setup([]);
      dropdown.props.onSelect(names);
      assert.equal(confirms.length, 0);
      assert.deepEqual(changes[0].map(s => s.subject), names);
      assert.deepEqual(changes[0].map(s => s.questions.length), names.map(() => 0));
      assert.ok(changes[0].every(s => !('target' in s)));
    }
  });

  test('removing a subject with picked questions asks first, says how many, and Cancel changes nothing', () => {
    const { confirms, changes, dropdown } = setup(sessions());
    dropdown.props.onSelect(['Physics', 'Mathematics']);
    assert.equal(changes.length, 0, 'nothing is removed before the answer');
    assert.equal(confirms.length, 1);
    const [title, message, label] = confirms[0];
    assert.equal(title, 'Remove subjects?');
    assert.match(message, /Chemistry/);
    assert.match(message, /2 selected questions/);
    assert.match(message, /other subjects are kept/i);
    assert.equal(label, 'Remove');
    assert.equal(confirms[0].length, 4, 'the shared confirmation supplies Cancel');
  });

  test('confirming removes only that subject\'s questions and keeps the others in order', () => {
    const current = sessions();
    const { confirms, changes, dropdown } = setup(current);
    dropdown.props.onSelect(['Physics', 'Mathematics']);
    confirms[0][3]();
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].map(s => s.subject), ['Physics', 'Mathematics']);
    assert.deepEqual(changes[0][0].questions.map(x => x._id), ['Physics-1', 'Physics-2', 'Physics-3']);
    assert.equal(selection.selectedQuestions(changes[0]).length, 3);
  });

  test('removing a subject with no picked questions needs no confirmation', () => {
    const { confirms, changes, dropdown } = setup(sessions());
    dropdown.props.onSelect(['Physics', 'Chemistry']);
    assert.equal(confirms.length, 0);
    assert.deepEqual(changes[0].map(s => s.subject), ['Physics', 'Chemistry']);
    assert.equal(selection.selectedQuestions(changes[0]).length, 5);
  });
});

describe('final review', () => {
  const questions = [...Array.from({ length: 20 }, (_, i) => q('Physics', i)), ...Array.from({ length: 15 }, (_, i) => q('Chemistry', i)), ...Array.from({ length: 15 }, (_, i) => q('Mathematics', i))];

  test('lists each subject with its count and the total, read-only, with a compact Edit', () => {
    const h = harness('src/screens/teacher/make-pdf/subject-review.tsx');
    let edited = 0;
    const tree = h.render(h.exports.SubjectReview, { questions, onEdit: () => { edited++; } });
    const all = texts(tree);
    for (const line of ['Physics', '20 Questions', 'Chemistry', 'Mathematics', '15 Questions', 'Total', '50 Questions']) assert.ok(all.includes(line), line);
    assert.equal(nodes(tree).filter(n => n.type === 'Pressable').length, 1, 'Edit is the only action');
    const edit = find(tree, 'Pressable');
    assert.equal(edit.props.accessibilityLabel, 'Edit subjects and questions');
    edit.props.onPress();
    assert.equal(edited, 1);
  });

  test('a single subject reads "1 Question"', () => {
    const h = harness('src/screens/teacher/make-pdf/subject-review.tsx');
    const all = texts(h.render(h.exports.SubjectReview, { questions: [q('Physics', 1)], onEdit: () => {} }));
    assert.ok(all.includes('1 Question'));
  });
});
