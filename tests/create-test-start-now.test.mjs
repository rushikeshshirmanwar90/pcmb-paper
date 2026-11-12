import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as schedule from '../src/screens/teacher/test-schedule.ts';
import * as scope from '../src/screens/teacher/create-test/scope.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const nodes = t => !t || typeof t !== 'object' ? [] : [t, ...[t.props?.children, t.props?.footer].flat(Infinity).flatMap(nodes)];
function flow(startMode = 'now') {
  let cursor = 0;
  const slots = [];
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = v; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
  };
  const draft = { title: 'Keep my title', requestId: 'request', batchIds: ['b'], selections: [{ subject: 'Physics', target: 1, questions: [{}] }], questions: [{}], audienceMode: 'selected', studentIds: ['s'], excludedStudentIds: [], startMode, date: new Date(Date.now() + 86400000), start: '10:00', end: '13:00', minutes: '60', correct: '4', wrong: '0' };
  const calls = [];
  const kit = Object.fromEntries(['Button', 'Card', 'DetailRow', 'ErrorView', 'Field', 'Icon', 'LoadingView', 'Muted', 'Notice', 'SectionTitle', 'Segmented'].map(n => [n, n]));
  kit.usePalette = () => ({});
  let loads = 0;
  kit.useLoad = () => ({ data: ++loads % 2 ? [{ id: 'b', name: 'Batch', program: 'JEE', standard: '12th', subjects: ['Physics'], questionBank: 'JEE' }] : { students: [{ id: 's', name: 'Student' }] } });
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: s => s }, Text: 'Text', View: 'View' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    '@/components/kit': kit,
    '@/hooks/use-cache-keys': { useCacheKeys: () => ({ bankOptions: (k) => `bank-options:${k}`, testBatches: 'test-batches' }) },
    '@/components/dropdown-select': { DropdownSelect: 'DropdownSelect' },
    '@/components/multi-select-dropdown': { MultiSelectDropdown: 'MultiSelectDropdown' },
    '@/context/data-version': { bumpDataVersion() {} },
    '@/screens/teacher/create-test/flow-page': { FlowPage: 'FlowPage' },
    '@/screens/teacher/create-test/draft': { useTestDraft: () => ({ draft, update: patch => Object.assign(draft, patch), markSaved() {} }), useLeaveCreateTest: () => () => {} },
    '@/screens/teacher/create-test/scope': scope,
    '@/screens/teacher/date-field': { DateField: 'DateField' },
    '@/screens/teacher/test-schedule': schedule,
    '@/screens/tuition/time-field': { TimeField: 'TimeField' },
    '@/screens/teacher/question-selection/model': { selectionProblem: () => null },
    '@/services/school-api': { schoolApi: { createTest: async payload => { calls.push(JSON.parse(JSON.stringify(payload))); return { id: 'new' }; } } },
  };
  const exports = {};
  const code = ts.transpileModule(read('src/screens/teacher/create-test/setup-screen.tsx'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports, require: id => { assert.ok(id in deps, id); return deps[id]; } });
  const render = () => { cursor = 0; loads = 0; return exports.SetupScreen(); };
  const submit = async tree => { nodes(tree).find(n => n.type === 'Button' && n.props.label === 'Create Test').props.onPress(); await new Promise(resolve => setImmediate(resolve)); };
  return { draft, calls, render, submit };
}

test('new drafts default to now and mode participates in unsaved changes', () => {
  const code = read('src/screens/teacher/create-test/draft.tsx');
  assert.match(code, /startMode: 'now'/);
  assert.match(code, /draft.startMode !== base.startMode/);
});

test('switching preserves the schedule, questions, title and audience; now ignores stale times on submission', async () => {
  const f = flow();
  let tree = f.render();
  assert.equal(nodes(tree).find(n => n.type === 'Segmented').props.value, 'now');
  assert.equal(nodes(tree).filter(n => ['DateField', 'TimeField'].includes(n.type)).length, 0);
  const snapshot = JSON.stringify(f.draft);
  nodes(tree).find(n => n.type === 'Segmented').props.onChange('later');
  tree = f.render();
  assert.equal(nodes(tree).filter(n => ['DateField', 'TimeField'].includes(n.type)).length, 3);
  nodes(tree).find(n => n.type === 'Segmented').props.onChange('now');
  assert.equal(JSON.stringify(f.draft), snapshot);
  f.draft.date = new Date(2000, 0, 1);
  f.draft.end = '00:00';
  const before = Date.now();
  await f.submit(f.render());
  assert.equal(f.calls.length, 1);
  const payload = f.calls[0];
  assert.equal(payload.startNow, true);
  assert.equal('opensAt' in payload, false);
  assert.ok(Date.parse(payload.closesAt) >= before + 120 * 60000);
  assert.deepEqual(payload.studentIds, ['s']);
  assert.equal(payload.audienceMode, 'selected');
});

test('restored later and legacy drafts retain local timezone scheduling and reject past times', async () => {
  for (const mode of ['later', undefined]) {
    const f = flow(mode);
    f.draft.startMode = mode;
    const tree = f.render();
    assert.equal(nodes(tree).find(n => n.type === 'Segmented').props.value, 'later');
    await f.submit(tree);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].startNow, false);
    assert.equal(f.calls[0].opensAt, schedule.withTime(f.draft.date, f.draft.start).toISOString());
    assert.equal(f.calls[0].closesAt, schedule.withTime(f.draft.date, f.draft.end).toISOString());
  }
  const f = flow('later');
  f.draft.date = new Date(2000, 0, 1);
  await f.submit(f.render());
  assert.equal(f.calls.length, 0);
});

test('editing retains saved scheduling state rather than defaulting an existing test to now', () => {
  const edit = read('src/screens/teacher/teacher-tests.tsx');
  assert.match(edit, /useState<StartMode>\(edit \? 'later' : 'now'\)/);
  assert.match(edit, /edit \? new Date\(edit.test.opensAt\)/);
});

test('submitted immediate payload resolves at the backend clock and scheduled payload retains its dates', async () => {
  // Execute the existing server resolver without loading models or connecting to MongoDB.
  const source = read('../papers/src/lib/tests.ts');
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports, require: () => ({ badRequest: message => new Error(message) }) });
  for (const mode of ['now', 'later']) {
    const f = flow(mode);
    const serverNow = Date.now() + 10000;
    await f.submit(f.render());
    const payload = f.calls[0];
    const resolved = exports.resolveSchedule({ ...payload, opensAt: payload.opensAt ? new Date(payload.opensAt) : null, closesAt: new Date(payload.closesAt) }, serverNow);
    assert.equal(resolved.opensAt.getTime(), mode === 'now' ? serverNow : Date.parse(payload.opensAt));
    assert.equal(exports.statusOf(resolved, serverNow), mode === 'now' ? 'open' : 'scheduled');
    assert.equal(resolved.closesAt.toISOString(), payload.closesAt);
  }
});
