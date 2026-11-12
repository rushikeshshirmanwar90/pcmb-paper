import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { answerOf } from '../src/screens/teacher/question-selection/answer.ts';
import { sourceOptions, bankBody, EMPTY_BANK_SCOPE } from '../src/screens/teacher/make-pdf/bank-scope.ts';
import * as selection from '../src/screens/teacher/question-selection/model.ts';
import * as model from '../src/screens/teacher/make-pdf/model.ts';
import * as bankScope from '../src/screens/teacher/make-pdf/bank-scope.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = { ...EMPTY_BANK_SCOPE, course: 'Competitive', exam: 'JEE', standard: '11th', subject: 'Physics' };
const q = id => ({ _id: id, questionNumber: 1, subject: 'Physics', questionText: 'Find $v$.', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctAnswer: 'B', answerType: 'MCQ', explanation: '', chapter: 'Motion' });

test('audited selectors match the API and old scalar and multi-source requests keep their meaning', () => {
  assert.deepEqual(sourceOptions(base).map(s => s.value), ['regular', 'pyq']);
  assert.deepEqual(sourceOptions({ course: 'Foundation' }).map(s => s.value), ['regular']);
  assert.equal(bankBody({ ...base, source: 'pyq', years: ['2020'] }).source, 'pyq');
  assert.deepEqual(bankBody({ ...base, sources: ['pyq', 'regular'], years: ['2020'] }).years, []);
});

test('stored MCQ keys, multiple keys, numerical values and image-only options are mapped without guessing', () => {
  assert.deepEqual(answerOf(q('1')), { options: ['B'], summary: 'Correct: B' });
  for (const key of ['AC', 'A, C', 'a / c', 'A & C']) assert.deepEqual(answerOf({ ...q('1'), correctAnswer: key }).options, ['A', 'C']);
  assert.equal(answerOf({ ...q('1'), answerType: 'Numerical', correctAnswer: '0' }).summary, 'Expected answer: 0');
  assert.equal(answerOf({ ...q('1'), optionB: '', optionDiagramUrls: { B: ['image'] } }).summary, 'Correct: B');
  for (const key of ['', 'unknown', '2', 'Answer B maybe', 'A,E']) assert.equal(answerOf({ ...q('1'), correctAnswer: key }).summary, 'Answer unavailable');
  assert.equal(answerOf({ ...q('1'), optionB: '' }).summary, 'Answer unavailable');
});

// Exercise actual TSX handlers with a small React hook/element harness. No native
// renderer or new dependency: layout/gestures still require device acceptance.
function harness(path, mocks = {}, expose = '') {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const react = {
    memo: f => f,
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo: (f, deps) => { const i = cursor++; if (!slots[i] || deps.some((v, at) => v !== slots[i].deps[at])) slots[i] = { deps, value: f() }; return slots[i].value; },
    useEffect: (f, deps) => { const i = cursor++; if (!slots[i] || !deps || deps.some((v, at) => v !== slots[i][at])) { slots[i] = deps; effects.push(f); } },
  };
  const exports = {};
  const req = createRequire(import.meta.url);
  const kit = { usePalette: () => ({}), useLoad: () => ({ data: null }), ...Object.fromEntries(['Button', 'DetailSheet', 'ErrorView', 'Field', 'Icon', 'Muted', 'Notice'].map(name => [name, name])) };
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': Object.fromEntries(['ActivityIndicator', 'FlatList', 'Modal', 'Pressable', 'Text', 'View'].map(n => [n, n]).concat([['StyleSheet', { create: s => s }]])),
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-reorderable-list': { __esModule: true, default: 'ReorderableList', useReorderableDrag: () => () => {}, useIsActive: () => false },
    './reorder-list': { SelectedReorderList: 'SelectedReorderList' },
    './action-menu': { QuestionActionMenu: 'QuestionActionMenu' },
    '@/components/kit': kit,
    '@/hooks/use-cache-keys': { useCacheKeys: () => ({ bankOptions: (k) => `bank-options:${k}`, testBatches: 'test-batches' }) },
    '@/components/explanation': { Explanation: 'Explanation' },
    '@/components/diagrams': { Diagrams: 'Diagrams' },
    '@/components/math-text': { MathText: 'MathText' },
    '@/components/confirm-action': {},
    '@/components/dropdown-select': { DropdownSelect: 'DropdownSelect' },
    '@/components/multi-select-dropdown': { MultiSelectDropdown: 'MultiSelectDropdown' },
    '@/components/keyboard-safe-view': { KeyboardSafeView: 'KeyboardSafeView' },
    '@/screens/teacher/make-pdf/bank-scope': bankScope,
    '@/screens/teacher/make-pdf/model': model,
    '@/screens/teacher/make-pdf/question-preview': { QuestionPreview: 'QuestionPreview', questionMeta: q => q.chapter },
    '@/screens/teacher/make-pdf/ui': { CountField: 'CountField' },
    './question-card': { SelectionCard: 'SelectionCard', SelectedQuestionRow: 'SelectedQuestionRow' },
    './model': selection, './answer': { answerOf }, ...mocks,
    '@/screens/teacher/question-selection/answer': { answerOf },
  };
  const code = ts.transpileModule(read(path) + expose, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports, require: id => id in dependencies ? dependencies[id] : req(id), setTimeout, clearTimeout });
  return { exports, render: (component, props) => { cursor = 0; const tree = component(props); effects.splice(0).forEach(f => f()); return tree; } };
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children, tree.props?.ListHeaderComponent, tree.props?.footer].flat(Infinity).flatMap(nodes)];
const find = (tree, type, predicate = () => true) => nodes(tree).find(n => n.type === type && predicate(n.props));

test('question content opens details; checkbox toggles independently; compact row opens one menu', () => {
  const h = harness('src/screens/teacher/question-selection/question-card.tsx');
  const calls = [];
  const props = { question: q('1'), picked: false, disabled: false, onToggle: () => calls.push('toggle'), onDetails: () => calls.push('details'), onMenu: () => calls.push('menu'), index: 0 };
  const card = h.render(h.exports.SelectionCard, props);
  find(card, 'Pressable', p => p.accessibilityRole === 'checkbox').props.onPress();
  assert.deepEqual(calls, ['toggle']);
  find(card, 'Pressable', p => p.accessibilityRole === 'button').props.onPress();
  assert.deepEqual(calls, ['toggle', 'details']);
  const row = h.render(h.exports.SelectedQuestionRow, props);
  assert.equal(nodes(row).filter(n => n.type === 'Pressable').length, 2);
  const button = find(row, 'Pressable', p => p.accessibilityLabel.startsWith('Actions'));
  button.props.ref.current = { measureInWindow: f => f(300, 150, 48, 48) };
  button.props.onPress();
  assert.equal(calls.at(-1), 'menu');
});

test('answer highlights are opt-in and the original preview continues to hide keys', () => {
  const h = harness('src/screens/teacher/make-pdf/question-preview.tsx');
  const hidden = h.render(h.exports.QuestionPreview, { question: q('1') });
  assert.ok(!find(hidden, 'MathText', p => p.text === 'Correct: B'));
  const shown = h.render(h.exports.QuestionPreview, { question: q('1'), showAnswers: true });
  assert.ok(find(shown, 'MathText', p => p.text === 'Correct: B'));
  assert.ok(find(shown, 'Text', p => p.accessibilityLabel === 'B, correct option'));
});

test('browser overflow removes, undoes, replaces and reorders; Add at random preserves manual picks and rejects rapid repeats', async () => {
  let resolvePick;
  let requests = 0;
  const random = new Promise(resolve => { resolvePick = resolve; });
  const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', {
    '@/services/pdf-questions': { fetchBankOptions: async () => ({}), fetchBankPage: async () => ({ questions: [q('3')], total: 1, hasMore: false }), fetchBankRandom: async (_body, count, exclude) => { requests++; assert.equal(count, 1); assert.deepEqual([...exclude], ['1', '2']); return random; } },
  }, '\nexports.Browser = SubjectBrowser;');
  let session = { ...selection.selectSubjects([], ['Physics'], base, 3)[0], questions: [q('1'), q('2')] };
  const props = () => ({ session, subjects: ['Physics'], totalSelected: session.questions.length, onChange: next => { session = next; }, onSubject: () => {}, onClose: () => {} });
  const render = () => h.render(h.exports.Browser, props());
  let tree = render();
  // Nothing is pre-set: the teacher types how many, then adds them.
  assert.equal(find(tree, 'Field', p => p.label === 'Number of questions').props.value, '');
  assert.equal(find(tree, 'Button', p => p.label === 'Add at random').props.disabled, true);
  find(tree, 'Field', p => p.label === 'Number of questions').props.onChangeText('1');
  tree = render();
  const fill = find(tree, 'Button', p => p.label === 'Add 1 at random');
  fill.props.onPress(); fill.props.onPress();
  assert.equal(requests, 1);
  resolvePick([q('2'), q('3'), q('4')]);
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.deepEqual(Array.from(session.questions, q => q._id), ['1', '2', '3']);
  find(tree, 'Pressable', p => nodes({ props: { children: p.children } }).some(n => n.props?.children === 'View Selected >')).props.onPress();
  tree = render();
  const openMenu = () => { const list = find(tree, 'FlatList'); list.props.renderItem({ item: session.questions[0], index: 0 }).props.onMenu(session.questions[0], { x: 300, y: 150, width: 48, height: 48 }); tree = render(); };
  openMenu();
  find(tree, 'QuestionActionMenu').props.onAction('details'); tree = render(); tree = render();
  assert.equal(find(tree, 'DetailSheet', p => p.title === 'Question Details').props.visible, true);
  assert.ok(find(tree, 'Muted', p => p.children === 'Explanation / solution unavailable.'));
  find(tree, 'DetailSheet', p => p.title === 'Question Details').props.onClose();
  tree = render(); openMenu();
  find(tree, 'QuestionActionMenu').props.onAction('remove'); tree = render(); tree = render();
  assert.deepEqual(Array.from(session.questions, q => q._id), ['2', '3']);
  find(tree, 'Button', p => p.label === 'Undo Remove').props.onPress(); tree = render();
  assert.deepEqual(Array.from(session.questions, q => q._id), ['1', '2', '3']);
  assert.equal(nodes(tree).filter(n => n.type === 'Button' && n.props.label === 'Reorder').length, 1);
  assert.equal(nodes(tree).filter(n => n.type === 'Button' && n.props.label.startsWith('Done')).length, 1, 'only the footer Done, which closes the list');
  find(tree, 'Button', p => p.label === 'Reorder').props.onPress(); tree = render();
  assert.equal(nodes(tree).filter(n => n.type === 'Button' && n.props.label === 'Reorder').length, 0);
  assert.equal(nodes(tree).filter(n => n.type === 'Button' && n.props.label.startsWith('Done')).length, 1);
  assert.equal(find(tree, 'QuestionActionMenu'), undefined);
  assert.equal(find(tree, 'Field', p => p.label === 'Number of questions'), undefined);
  find(tree, 'SelectedReorderList').props.onMove(0, 1); tree = render();
  assert.deepEqual(Array.from(session.questions, q => q._id), ['2', '1', '3']);
  find(tree, 'Button', p => p.label === 'Done').props.onPress(); tree = render(); openMenu();
  assert.equal(nodes(tree).filter(n => n.type === 'Button' && n.props.label === 'Reorder').length, 1);
  find(tree, 'QuestionActionMenu').props.onAction('replace'); tree = render(); tree = render();
  find(tree, 'FlatList').props.renderItem({ item: q('4'), index: 0 }).props.onToggle(q('4'));
  assert.deepEqual(Array.from(session.questions, q => q._id), ['4', '1', '3']);
});

test('details preserve image-only solutions and suppress legacy solution-inferred answer badges', () => {
  const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', {
    '@/services/pdf-questions': { fetchBankPage: async () => ({ questions: [], total: 0, hasMore: false }), fetchBankOptions: async () => ({}) },
  }, '\nexports.Browser = SubjectBrowser;');
  const session = selection.selectSubjects([], ['Physics'], base, 1)[0];
  const render = () => h.render(h.exports.Browser, { session, subjects: ['Physics'], totalSelected: 0, onChange: () => {}, onSubject: () => {}, onClose: () => {} });
  let tree = render();
  const openDetails = question => { find(tree, 'FlatList').props.renderItem({ item: question, index: 0 }).props.onDetails(question); tree = render(); };
  openDetails({ ...q('1'), explanationDiagramUrls: ['solution-image'] });
  assert.deepEqual(find(tree, 'Diagrams').props.urls, ['solution-image']);
  openDetails({ ...q('2'), correctAnswer: '', explanation: '(A) An existing solution.' });
  assert.equal(find(tree, 'Explanation').props.showAnswer, false);
});

test('pagination keeps manual picks and source changes keep filters and selections', async () => {
  const requestedPages = [];
  const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', {
    '@/services/pdf-questions': {
      fetchBankPage: async (_body, page) => { requestedPages.push(page); return { questions: page === 1 ? [q('1'), q('2')] : [q('2'), q('3')], total: 3, hasMore: page === 1 }; },
      fetchBankOptions: async () => ({}), fetchBankRandom: async () => [],
    },
  }, '\nexports.Browser = SubjectBrowser;');
  let session = { ...selection.selectSubjects([], ['Physics'], base, 3)[0], scope: { ...base, chapters: ['Motion'], topics: ['Velocity'], years: ['2020'] } };
  const render = () => h.render(h.exports.Browser, { session, subjects: ['Physics', 'Chemistry'], totalSelected: session.questions.length, onChange: next => { session = next; }, onSubject: () => {}, onClose: () => {} });
  render();
  await new Promise(resolve => setImmediate(resolve));
  let tree = render();
  find(tree, 'FlatList').props.renderItem({ item: q('1'), index: 0 }).props.onToggle(q('1'));
  tree = render();
  find(tree, 'FlatList').props.onEndReached();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(Array.from(find(tree, 'FlatList').props.data, q => q._id), ['1', '2', '3']);
  assert.equal(find(tree, 'FlatList').props.renderItem({ item: q('1'), index: 0 }).props.picked, true);
  const sources = find(tree, 'MultiSelectDropdown', p => p.label === 'Question Sources');
  sources.props.onSelect(['PYQs']);
  assert.deepEqual(Array.from(session.scope.chapters), ['Motion']);
  assert.deepEqual(Array.from(session.scope.topics), ['Velocity']);
  assert.deepEqual(Array.from(session.scope.years), ['2020']);
  assert.deepEqual(Array.from(session.questions, q => q._id), ['1']);
  assert.deepEqual(Array.from(bankBody(session.scope).source), ['pyq']);
});

test('random picks ask how many; shortages report what was actually added', async () => {
  const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', {
    '@/services/pdf-questions': {
      fetchBankPage: async () => ({ questions: [], total: 0, hasMore: false }), fetchBankOptions: async () => ({}),
      fetchBankRandom: async (_body, count, exclude) => { assert.equal(count, 3); assert.equal(exclude.length, 0); return [q('1')]; },
    },
  }, '\nexports.Browser = SubjectBrowser;');
  let session = selection.selectSubjects([], ['Physics'], base, 3)[0];
  const render = () => h.render(h.exports.Browser, { session, subjects: ['Physics'], totalSelected: session.questions.length, onChange: next => { session = next; }, onSubject: () => {}, onClose: () => {} });
  find(render(), 'Field', p => p.label === 'Number of questions').props.onChangeText('3');
  find(render(), 'Button', p => p.label === 'Add 3 at random').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  const tree = render();
  assert.equal(session.questions.length, 1);
  assert.match(find(tree, 'Notice').props.text, /Added 1 at random: only 1 more match these filters/);
  assert.equal(find(tree, 'Field', p => p.label === 'Number of questions').props.value, '', 'the number clears after adding');
  assert.ok(find(tree, 'Button', p => p.label === 'Done'), 'Done closes the list');
  assert.equal(find(tree, 'Button', p => p.label.startsWith('Next')), undefined, 'no Next: subject button');
  assert.equal(find(tree, 'Field', p => p.label === 'Search Questions'), undefined, 'no search box');
});


test('anchored popup dismisses outside and Android Back without closing the browser', () => {
  let closed = 0;
  const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', {
    '@/services/pdf-questions': { fetchBankPage: async () => ({ questions: [], total: 0, hasMore: false }) },
  }, '\nexports.Browser = SubjectBrowser;');
  const session = { ...selection.selectSubjects([], ['Physics'], base, 2)[0], questions: [q('1'), q('2')] };
  const render = () => h.render(h.exports.Browser, { session, subjects: ['Physics'], totalSelected: 2, onChange: () => {}, onSubject: () => {}, onClose: () => closed++ });
  let tree = render();
  find(tree, 'Pressable', p => nodes({ props: { children: p.children } }).some(n => n.props?.children === 'View Selected >')).props.onPress();
  tree = render();
  const open = question => { find(tree, 'FlatList').props.renderItem({ item: question, index: 0 }).props.onMenu(question, { x: 300, y: 200, width: 48, height: 48 }); tree = render(); };
  open(q('1')); open(q('2'));
  assert.equal(nodes(tree).filter(n => n.type === 'QuestionActionMenu').length, 1);
  find(tree, 'QuestionActionMenu').props.onClose(); tree = render();
  assert.equal(find(tree, 'QuestionActionMenu'), undefined);
  open(q('1')); find(tree, 'Modal').props.onRequestClose(); tree = render();
  assert.equal(find(tree, 'QuestionActionMenu'), undefined);
  assert.equal(closed, 0);
  find(tree, 'Modal').props.onRequestClose();
  assert.equal(closed, 1);
  find(tree, 'Button', p => p.label === 'Done').props.onPress();
  assert.equal(closed, 2, 'Done closes the question list');
});

test('popup measures its content and clamps above/below at phone screen edges', () => {
  const h = harness('src/screens/teacher/question-selection/action-menu.tsx');
  for (const anchor of [{ x: 300, y: 700, width: 48, height: 48 }, { x: 0, y: 0, width: 48, height: 48 }]) {
    const pos = h.exports.menuPosition(anchor, { x: 0, y: 24, width: 360, height: 720 }, { width: 185, height: 152 });
    assert.ok(pos.left >= 8 && pos.left + 185 <= 352);
    assert.ok(pos.top >= 8 && pos.top + 152 <= 712);
  }
  let dismissed = false;
  let chosen;
  const tree = h.render(h.exports.QuestionActionMenu, { anchor: { x: 300, y: 700, width: 48, height: 48 }, disabled: false, onClose: () => { dismissed = true; }, onAction: a => { chosen = a; } });
  find(tree, 'Pressable', p => p.accessibilityLabel === 'Dismiss question actions').props.onPress();
  assert.equal(dismissed, true);
  find(tree, 'Pressable', p => p.accessibilityLabel === 'Replace Question').props.onPress();
  assert.equal(chosen, 'replace');
  assert.equal(find(tree, 'Modal'), undefined);
});

test('drag list forwards drops; reorder rows hide menu/details and expose bounded accessible moves', () => {
  const h = harness('src/screens/teacher/question-selection/reorder-list.tsx');
  const moves = [];
  const tree = h.render(h.exports.SelectedReorderList, { questions: [q('1'), q('2')], onMove: (from, to) => moves.push([from, to]) });
  find(tree, 'ReorderableList').props.onReorder({ from: 0, to: 1 });
  assert.deepEqual(moves, [[0, 1]]);
  assert.ok(tree.props.autoscrollThreshold > 0);
  const rowHarness = harness('src/screens/teacher/question-selection/question-card.tsx');
  let drags = 0;
  const row = rowHarness.render(rowHarness.exports.SelectedQuestionRow, { question: q('2'), index: 1, count: 3, drag: () => drags++, onMove: o => moves.push(o), onDetails: () => assert.fail('details during drag') });
  assert.equal(find(row, 'Pressable', p => p.accessibilityLabel?.startsWith('Actions')), undefined);
  assert.equal(find(row, 'Pressable', p => p.accessibilityLabel?.includes('View Details')).props.disabled, true);
  const handle = find(row, 'Pressable', p => p.accessibilityRole === 'adjustable');
  handle.props.onLongPress();
  assert.equal(drags, 1);
  handle.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
  assert.equal(moves.at(-1), 1);
  assert.equal(handle.props.accessibilityValue.now, 2);
});


test('long subject reorder survives reopen and flattening without changing IDs, keys or other subjects', () => {
  let sessions = selection.selectSubjects([], ['Physics', 'Chemistry'], base, 300);
  sessions[0] = { ...sessions[0], questions: Array.from({ length: 200 }, (_, i) => ({ ...q(`p${i}`), correctAnswer: ['A', 'B', 'C', 'D'][i % 4] })) };
  sessions[1] = { ...sessions[1], questions: [{ ...q('c1'), subject: 'Chemistry' }] };
  const otherSubject = sessions[1];
  const before = sessions[0].questions;
  const h = harness('src/screens/teacher/question-selection/subject-selector.tsx', {
    '@/services/pdf-questions': { fetchBankPage: async () => ({ questions: [], total: 0, hasMore: false }) },
  }, '\nexports.Browser = SubjectBrowser;');
  const render = () => h.render(h.exports.Browser, { session: sessions[0], subjects: ['Physics', 'Chemistry'], totalSelected: 201,
    onChange: next => { sessions = [next, sessions[1]]; }, onSubject: () => {}, onClose: () => {} });
  let tree = render();
  find(tree, 'Pressable', p => nodes({ props: { children: p.children } }).some(n => n.props?.children === 'View Selected >')).props.onPress(); tree = render();
  find(tree, 'Button', p => p.label === 'Reorder').props.onPress(); tree = render();
  find(tree, 'SelectedReorderList').props.onMove(0, 199); tree = render();
  find(tree, 'SelectedReorderList').props.onMove(150, 0); tree = render();
  find(tree, 'Button', p => p.label === 'Done').props.onPress(); tree = render();
  assert.equal(find(tree, 'SelectedReorderList'), undefined);
  assert.equal(sessions[1], otherSubject);
  assert.deepEqual(new Set(sessions[0].questions.map(q => q._id)), new Set(before.map(q => q._id)));
  assert.equal(sessions[0].questions.length, 200);
  const reopened = selection.selectSubjects(sessions, ['Physics', 'Chemistry'], base, 300);
  const final = selection.selectedQuestions(reopened);
  assert.deepEqual(final.slice(0, 200), sessions[0].questions);
  assert.equal(final[200], otherSubject.questions[0]);
  for (const question of final.slice(0, 200)) assert.equal(question, before.find(q => q._id === question._id));
  const row = find(tree, 'FlatList').props.renderItem({ item: final[0], index: 0 });
  assert.equal(row.props.index, 0);
  assert.equal(row.props.question.correctAnswer, final[0].correctAnswer);
});


test('Exam and Smart PDF requests preserve reordered question and answer-key pairs', () => {
  const h = harness('src/services/question-pdf.ts', {
    '@/services/api-client': {}, '@/services/apiService': {}, '@/services/pdf-library': {},
  }, '\nexports.requestBody = requestBody;');
  const questions = model.moveQuestion([
    { ...q('1'), questionText: 'First', correctAnswer: 'A' },
    { ...q('2'), questionText: 'Second', correctAnswer: 'C' },
    { ...q('3'), questionText: 'Third', correctAnswer: 'B' },
  ], 0, 2);
  for (const smart of [undefined, { theme: 'white' }]) {
    const body = JSON.parse(h.exports.requestBody({ questions, content: 'answers', smart }, 4));
    assert.deepEqual(body.questions.map(q => [q.questionText, q.correctAnswer]), [['Second', 'C'], ['Third', 'B'], ['First', 'A']]);
  }
});
